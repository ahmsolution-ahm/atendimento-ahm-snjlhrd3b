import pb from '@/lib/pocketbase/client'
import type { LeadRecord } from '@/types'
import type { CsvLeadRow, LinhaInvalida } from '@/lib/csvImport'
import { chaveDuplicidade, chavesDoRegistroBase, telefoneDaLinha } from '@/lib/csvImport'
import { comTentativas, lerTodasPaginas } from '@/lib/paginacao'

// Bloco 4: verificação de duplicidade da importação contra a BASE COMPLETA
const LOTE_CONTATOS = 30 // contatos por consulta (expressão de filtro com OR)
const LIMITE_POR_LOTES = 300 // acima disso, varre a base em páginas leves (só 2 campos)
const PAGINA_VARREDURA = 1000
// Bloco 5: criação paralela — quantas requisições de criação ao mesmo tempo
const CRIACOES_SIMULTANEAS = 10

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Bloco 5 (0.0.59, D2): verificação de duplicidade DETERMINÍSTICA.
// Cada página é buscada com requestKey null (o SDK não cancela consultas simultâneas à mesma
// coleção) e até 4 tentativas com espera crescente. Qualquer falha definitiva propaga o erro,
// e a tela trata como "verificação falhou" → importação bloqueada.
const TENTATIVAS_PAGINA = 4

type CamposBase = { contato?: string; empresa?: string; nome?: string }

const statusDoErro = (err: unknown) =>
  typeof err === 'object' && err !== null && 'status' in err
    ? Number((err as { status: number }).status)
    : 0

/**
 * Lê TODAS as páginas de uma consulta a leads com conferência de cobertura (lerTodasPaginas).
 * Ordenação por created,id: registros criados durante a leitura vão para o fim e não
 * deslocam as páginas já lidas. requestKey null: o SDK não cancela consultas simultâneas.
 */
async function lerTudo(
  porPagina: number,
  opcoes: { filter?: string; fields: string },
  aoLer: (itens: CamposBase[]) => void,
): Promise<void> {
  await lerTodasPaginas<CamposBase>(
    (pagina, comTotal) =>
      comTentativas(
        () =>
          pb.collection('leads').getList<LeadRecord & CamposBase>(pagina, porPagina, {
            filter: opcoes.filter,
            fields: opcoes.fields,
            sort: 'created,id',
            skipTotal: !comTotal,
            requestKey: null,
          }),
        TENTATIVAS_PAGINA,
        // 400–428 = consulta inválida: repetir não resolve
        (err) => {
          const s = statusDoErro(err)
          return s >= 400 && s < 429
        },
        (err, tentativa) => (statusDoErro(err) === 429 ? 1500 * tentativa : 500 * tentativa),
        esperar,
      ),
    porPagina,
    aoLer,
  )
}

export interface ImportPreview {
  total: number
  validas: CsvLeadRow[]
  invalidas: LinhaInvalida[]
  duplicadasNoArquivo: CsvLeadRow[]
  duplicadasNaBase: CsvLeadRow[]
  cabecalhos: string[]
}

export interface LeadsPaginados {
  itens: LeadRecord[]
  total: number
  totalPaginas: number
  pagina: number
  porPagina: number
}

export const leadsService = {
  // F1-T09/desempenho: listagem PAGINADA server-side (a tela não carrega mais os 15k de uma vez)
  async listPaginado(
    pagina: number = 1,
    porPagina: number = 20,
    filter?: string,
    sort: string = '-created',
  ): Promise<LeadsPaginados> {
    const r = await pb.collection('leads').getList<LeadRecord>(pagina, porPagina, {
      filter,
      sort,
      expand: 'produto_interesse,responsavel',
    })
    return {
      itens: r.items,
      total: r.totalItems,
      totalPaginas: r.totalPages,
      pagina: r.page,
      porPagina: r.perPage,
    }
  },

  // F1-T09/desempenho: contadores agregados (3 requisições leves em vez de carregar tudo)
  async contadores(): Promise<{ total: number; novos: number; pendentes: number }> {
    const [total, novos, pendentes] = await Promise.all([
      pb.collection('leads').getList(1, 1, {}),
      pb.collection('leads').getList(1, 1, { filter: "status='novo'" }),
      pb.collection('leads').getList(1, 1, { filter: "status='pendente'" }),
    ])
    return { total: total.totalItems, novos: novos.totalItems, pendentes: pendentes.totalItems }
  },

  async list(filter?: string, sort: string = '-created'): Promise<LeadRecord[]> {
    return await pb.collection('leads').getFullList<LeadRecord>({
      filter,
      sort,
      expand: 'produto_interesse,responsavel',
    })
  },

  async getById(id: string): Promise<LeadRecord> {
    return await pb.collection('leads').getOne<LeadRecord>(id, {
      expand: 'produto_interesse,responsavel',
    })
  },

  async create(data: LeadInput): Promise<LeadRecord> {
    return await pb.collection('leads').create<LeadRecord>(data, {
      expand: 'produto_interesse,responsavel',
    })
  },

  // F1-T08: update parcial — campos com string vazia LIMPAM o valor no PocketBase;
  // campos undefined são omitidos (não alteram). O modal de edição depende disso.
  async update(id: string, data: Partial<LeadInput>): Promise<LeadRecord> {
    const payload: Record<string, unknown> = { ...data }
    // remover chaves undefined para não sobrescrever com null inesperado
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k])
    return await pb.collection('leads').update<LeadRecord>(id, payload, {
      expand: 'produto_interesse,responsavel',
    })
  },

  // F1-T07/F1-T08: gravar o resultado do motor de qualificação com histórico de reprocessamento.
  // O histórico é montado AQUI (frontend): lê o resultado anterior, anexa {em, por, status, resultado}
  // e envia o array no PATCH — a API do PocketBase aceita array direto em campo json
  // (o hook backend não consegue: r.set com array dá invalid_json, com string dá charcodes).
  async gravarQualificacao(
    id: string,
    resultado: { status: string; motivos: string[]; pendencias: string[] },
    justificativa: string,
    qualificadoPor?: string,
    leadAtual?: LeadRecord,
  ): Promise<LeadRecord> {
    // montar histórico: resultado anterior (se existir e for diferente) vai para o topo
    let historico: { em: string; por: string; status: string; resultado: string }[] = []
    const anterior = leadAtual?.qualificacao_historico
    if (anterior) {
      try {
        const parsed = typeof anterior === 'string' ? JSON.parse(anterior) : anterior
        if (Array.isArray(parsed)) historico = parsed
      } catch (_) {
        historico = []
      }
    }
    const resultadoAnterior = leadAtual?.qualificacao_resultado || ''
    if (resultadoAnterior && resultadoAnterior !== justificativa) {
      historico.unshift({
        em: leadAtual?.qualificado_em || leadAtual?.updated || '',
        por: leadAtual?.qualificado_por || '',
        status: leadAtual?.status || '',
        resultado: resultadoAnterior,
      })
      if (historico.length > 20) historico = historico.slice(0, 20)
    }
    return await pb.collection('leads').update<LeadRecord>(
      id,
      {
        status: resultado.status as LeadInput['status'],
        qualificacao_resultado: justificativa,
        qualificacao_pendencias: resultado.pendencias,
        qualificado_por: resultado.status === 'qualificado' ? qualificadoPor : undefined,
        qualificado_em: resultado.status === 'qualificado' ? new Date().toISOString() : '',
        qualificacao_historico: historico,
      },
      {
        expand: 'produto_interesse,responsavel',
      },
    )
  },

  // F1-T08: reprocessar a qualificação após edição do lead (histórico montado em gravarQualificacao)
  async requalificar(
    id: string,
    resultado: { status: string; motivos: string[]; pendencias: string[] },
    justificativa: string,
    qualificadoPor?: string,
    leadAtual?: LeadRecord,
  ): Promise<LeadRecord> {
    return await this.gravarQualificacao(id, resultado, justificativa, qualificadoPor, leadAtual)
  },

  // F1-T08: rollback auditável — voltar para pendente exige motivo (SPEC 1.3)
  // O resultado anterior vai para o histórico (montado aqui, mesmo mecanismo da qualificação).
  async voltarPendente(
    id: string,
    motivo: string,
    usuario?: string,
    leadAtual?: LeadRecord,
  ): Promise<LeadRecord> {
    const just = `rollback para pendente — motivo: ${motivo} (registrado por ${usuario || 'usuário'})`
    let historico: { em: string; por: string; status: string; resultado: string }[] = []
    const anterior = leadAtual?.qualificacao_historico
    if (anterior) {
      try {
        const parsed = typeof anterior === 'string' ? JSON.parse(anterior) : anterior
        if (Array.isArray(parsed)) historico = parsed
      } catch (_) {
        historico = []
      }
    }
    const resultadoAnterior = leadAtual?.qualificacao_resultado || ''
    if (resultadoAnterior && resultadoAnterior !== just) {
      historico.unshift({
        em: leadAtual?.qualificado_em || leadAtual?.updated || '',
        por: leadAtual?.qualificado_por || '',
        status: leadAtual?.status || '',
        resultado: resultadoAnterior,
      })
      if (historico.length > 20) historico = historico.slice(0, 20)
    }
    return await pb.collection('leads').update<LeadRecord>(
      id,
      {
        status: 'pendente',
        qualificacao_resultado: just,
        qualificacao_pendencias: [`rollback solicitado: ${motivo}`],
        qualificado_em: '',
        qualificado_por: '',
        qualificacao_historico: historico,
      },
      {
        expand: 'produto_interesse,responsavel',
      },
    )
  },

  // F1-T06 RN-1.5: consultar duplicidade local por contato+empresa (case-insensitive).  // Retorna os leads existentes com a mesma chave — usado no formulário manual para avisar
  // ANTES de confirmar. Não bloqueia: o usuário decide (RN-1.5).
  async buscarDuplicidade(contato: string, empresa: string): Promise<LeadRecord[]> {
    const c = (contato || '').trim()
    const e = (empresa || '').trim()
    if (!c || !e) return []
    const filtro =
      `((contato~'${c.replace(/'/g, "\\'")}' || contato~'${c.split('@')[0].replace(/'/g, "\\'")}') && ` +
      `empresa~'${e.replace(/'/g, "\\'")}')`
    try {
      return await pb.collection('leads').getFullList<LeadRecord>({
        filter: filtro,
        sort: '-created',
        expand: 'produto_interesse',
      })
    } catch (_) {
      return []
    }
  },

  /**
   * Bloco 4: chaves (contato|empresa) do arquivo que JÁ existem na base inteira — não só na
   * página visível. Poucas requisições em lote, sem uma requisição por linha:
   *  - até 300 contatos distintos: consultas de 30 contatos por vez (no máximo 10);
   *  - acima disso: varredura paginada da base trazendo só contato e empresa
   *    (~16 páginas de 1.000 para 15 mil leads), sem carregar registros completos.
   * A comparação final é exata (contato + empresa, sem diferenciar maiúsculas).
   */
  async chavesExistentesNaBase(
    linhas: Pick<CsvLeadRow, 'contato' | 'empresa' | 'nome'>[],
  ): Promise<Set<string>> {
    // Bloco 5: linhas sem contato também são verificadas (chave nome + empresa)
    const chavesArquivo = new Set(linhas.map((l) => chaveDuplicidade(l.contato, l.empresa, l.nome)))
    const existentes = new Set<string>()
    if (chavesArquivo.size === 0) return existentes

    // D1 (0.0.59): cada registro da base gera a chave principal E a secundária nome+empresa,
    // para que uma linha SEM e-mail reconheça um lead que existe COM e-mail.
    const registrar = (itens: CamposBase[]) => {
      for (const it of itens) {
        for (const k of chavesDoRegistroBase(it.contato || '', it.empresa || '', it.nome || '')) {
          if (chavesArquivo.has(k)) existentes.add(k)
        }
      }
    }

    const contatos = [...new Set(linhas.map((l) => l.contato.trim().toLowerCase()).filter(Boolean))]
    const temLinhaSemContato = linhas.some((l) => !l.contato.trim())

    // consulta por lotes só serve para linhas com contato; havendo linha sem contato,
    // a varredura (que traz também o nome) cobre todos os casos
    if (contatos.length <= LIMITE_POR_LOTES && !temLinhaSemContato) {
      const lotes: string[][] = []
      for (let i = 0; i < contatos.length; i += LOTE_CONTATOS) {
        lotes.push(contatos.slice(i, i + LOTE_CONTATOS))
      }
      await Promise.all(
        lotes.map((lote) =>
          lerTudo(
            500,
            {
              // "~" compara sem diferenciar maiúsculas; o filtro exato é feito em registrar()
              filter: lote.map((c) => pb.filter('contato ~ {:c}', { c })).join(' || '),
              fields: 'contato,empresa,nome',
            },
            registrar,
          ),
        ),
      )
      return existentes
    }

    await lerTudo(PAGINA_VARREDURA, { fields: 'contato,empresa,nome' }, registrar)
    return existentes
  },

  // F1-T05: importação em lote — recebe SOMENTE os leads novos (Bloco 5: a tela já removeu os
  // duplicados) e reporta falhas por linha.
  // Bloco 5: criação PARALELA (10 simultâneas) com 1 nova tentativa por item; falha definitiva
  // é registrada e a importação segue.
  // RN-1.4: linha sem nome+empresa+contato vai como rascunho (incompleto=true); RN-1.6 aplica pendente via hook.
  async importarLote(
    linhas: CsvLeadRow[],
    produtoPorNome: Map<string, string>,
    responsavel: string,
    onProgress?: (done: number, total: number) => void,
  ): Promise<{ criados: number; falhas: LinhaInvalida[] }> {
    let criados = 0
    const falhas: LinhaInvalida[] = []
    let done = 0
    let proximo = 0

    const criarUm = async (l: CsvLeadRow) => {
      const produtoId = l.produto_interesse
        ? produtoPorNome.get(l.produto_interesse.trim().toLowerCase())
        : undefined
      const completo = !!(l.nome && l.empresa && l.contato)
      // Bloco 4: telefone vai para o campo próprio (principal; na falta dele, o celular).
      // Se houver os dois, o celular fica registrado nas observações.
      const telefone = telefoneDaLinha(l)
      const celularExtra = l.telefone && l.celular && l.celular !== l.telefone ? l.celular : ''
      const dados = {
        nome: l.nome || '',
        empresa: l.empresa || '',
        contato: l.contato || '',
        telefone,
        origem: l.origem || 'Importação CSV',
        produto_interesse: produtoId,
        dor: l.dor,
        urgencia: l.urgencia,
        observacoes:
          [l.cargo ? `Cargo: ${l.cargo}` : '', celularExtra ? `Celular: ${celularExtra}` : '']
            .filter(Boolean)
            .join(' · ') || undefined,
        responsavel,
        status: completo ? 'novo' : 'pendente',
        incompleto: !completo,
      }
      for (let tentativa = 1; ; tentativa++) {
        try {
          // requestKey null: o SDK não cancela requisições paralelas à mesma coleção
          await pb.collection('leads').create(dados, { requestKey: null })
          criados++
          return
        } catch (err) {
          const status =
            typeof err === 'object' && err !== null && 'status' in err
              ? Number((err as { status: number }).status)
              : 0
          // erro de validação (400–428) não melhora com nova tentativa
          const definitivo = status >= 400 && status < 429
          if (tentativa >= 2 || definitivo) {
            const msg =
              typeof err === 'object' && err !== null && 'message' in err
                ? String((err as { message: string }).message)
                : 'Erro desconhecido.'
            falhas.push({ linha: l.linha, motivo: msg, dados: [l.nome, l.empresa, l.contato] })
            return
          }
          await esperar(status === 429 ? 1000 : 300)
        }
      }
    }

    const trabalhador = async () => {
      while (proximo < linhas.length) {
        const l = linhas[proximo++]
        await criarUm(l)
        done++
        if (onProgress && (done % 25 === 0 || done === linhas.length)) {
          onProgress(done, linhas.length)
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CRIACOES_SIMULTANEAS, linhas.length) }, () => trabalhador()),
    )
    if (onProgress) onProgress(linhas.length, linhas.length)
    return { criados, falhas }
  },
}

export interface LeadInput {
  nome: string
  empresa: string
  contato: string
  telefone?: string
  origem?: string
  produto_interesse?: string
  dor?: string
  urgencia?: 'Baixa' | 'Média' | 'Alta'
  observacoes?: string
  responsavel?: string
  status: 'novo' | 'em qualificação' | 'qualificado' | 'pendente' | 'fora do recorte' | 'transbordo'
  incompleto?: boolean
  qualificacao_resultado?: string
  qualificacao_pendencias?: string[]
  qualificado_em?: string
  qualificado_por?: string
  qualificacao_historico?: string
}
