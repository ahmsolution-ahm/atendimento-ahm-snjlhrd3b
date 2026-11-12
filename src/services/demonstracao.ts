import pb from '@/lib/pocketbase/client'
import { qualificar, justificativa } from '@/lib/qualificacao'
import type { ProdutoRecord } from '@/types'

// F1-T18 — SPEC 1.6: massa de demonstração do painel (10 leads do recorte piloto).
// Desenho: 7 qualificados + 2 pendentes + 1 transbordo → qualificação automática de 70%;
// 3 leads com proposta após 3, 4 e 5 interações (uma cancelada fora da conta) → média 4.
// O status de cada lead é calculado pelo PRÓPRIO motor de qualificação (não é fixado aqui).
// Tudo é identificável (origem "Demonstração", nome "DEMO — …") e removível pelo painel;
// a remoção apaga também as oportunidades, transbordos e interações criados para a demonstração.

export const ORIGEM_DEMO = 'Demonstração'
const FILTRO_DEMO = `origem = '${ORIGEM_DEMO}' && nome ~ 'DEMO —'`

const DOR_PADRAO = 'Avarias frequentes no transporte de cargas sensíveis'

// 10 leads: dor vazia → pendente; dor com sinal técnico → transbordo; demais → qualificado
const LEADS_DEMO: { dor: string; urgencia: 'Baixa' | 'Média' | 'Alta' }[] = [
  { dor: DOR_PADRAO, urgencia: 'Alta' },
  { dor: DOR_PADRAO, urgencia: 'Alta' },
  { dor: DOR_PADRAO, urgencia: 'Média' },
  { dor: 'Perdas por variação de temperatura na cadeia do frio', urgencia: 'Média' },
  { dor: 'Necessidade de comprovar o manuseio correto da carga', urgencia: 'Baixa' },
  { dor: DOR_PADRAO, urgencia: 'Média' },
  { dor: 'Reclamações de clientes sobre avarias na entrega', urgencia: 'Alta' },
  { dor: '', urgencia: 'Média' },
  { dor: '', urgencia: 'Baixa' },
  { dor: 'Integração do monitoramento com o sistema da empresa', urgencia: 'Alta' },
]

// interações por lead qualificado (índice do lead → nº de interações até a proposta)
const INTERACOES_DEMO: { lead: number; ateProposta: number; cancelada?: boolean }[] = [
  { lead: 0, ateProposta: 3 },
  { lead: 1, ateProposta: 4 },
  { lead: 2, ateProposta: 5, cancelada: true },
]
const TIPOS = ['Ligação', 'E-mail', 'Reunião', 'WhatsApp', 'Visita'] as const

const dataDiasAtras = (dias: number) => {
  const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
  return `${d.toISOString().slice(0, 10)} 12:00:00.000Z`
}

const apagarVinculados = async (colecao: string, leadId: string) => {
  const r = await pb
    .collection(colecao)
    .getList(1, 200, { filter: pb.filter('lead = {:id}', { id: leadId }), fields: 'id' })
  for (const item of r.items) await pb.collection(colecao).delete(item.id)
}

export const demonstracaoService = {
  async quantidade(): Promise<number> {
    const r = await pb.collection('leads').getList(1, 1, { filter: FILTRO_DEMO })
    return r.totalItems
  },

  async carregar(responsavel: string): Promise<number> {
    if ((await this.quantidade()) > 0) {
      throw new Error(
        'Os dados de demonstração já estão carregados. Remova-os antes de carregar novamente.',
      )
    }
    let produto: ProdutoRecord
    try {
      produto = await pb
        .collection('produtos')
        .getFirstListItem<ProdutoRecord>("status = 'Ativo' && complexidade = 'Baixa'")
    } catch {
      throw new Error(
        'Cadastre ao menos um produto ativo de baixa complexidade para carregar a demonstração.',
      )
    }

    const ids: string[] = []
    for (let i = 0; i < LEADS_DEMO.length; i++) {
      const def = LEADS_DEMO[i]
      const n = String(i + 1).padStart(2, '0')
      const lead = await pb.collection('leads').create({
        nome: `DEMO — Contato ${n}`,
        empresa: `DEMO Empresa ${n}`,
        contato: `demo${n}@exemplo.com.br`,
        origem: ORIGEM_DEMO,
        produto_interesse: produto.id,
        dor: def.dor,
        urgencia: def.urgencia,
        responsavel,
        status: 'novo',
        incompleto: false,
      })
      // qualificação pelo motor real, registrada como automática (simula o motor no servidor)
      const resultado = qualificar(
        {
          id: lead.id,
          nome: lead.nome,
          empresa: lead.empresa,
          contato: lead.contato,
          produto_interesse: produto.id,
          dor: def.dor,
          urgencia: def.urgencia,
          status: 'novo',
        },
        {
          id: produto.id,
          nome: produto.nome,
          status: produto.status,
          complexidade: produto.complexidade,
        },
      )
      await pb.collection('leads').update(lead.id, {
        status: resultado.status,
        qualificacao_resultado: justificativa(resultado),
        qualificacao_pendencias: resultado.pendencias,
        qualificacao_origem: 'automatica',
      })
      ids.push(lead.id)
    }

    for (const def of INTERACOES_DEMO) {
      const leadId = ids[def.lead]
      const total = def.ateProposta + (def.cancelada ? 1 : 0)
      for (let k = 0; k < total; k++) {
        const ultima = k === total - 1
        const cancelar = def.cancelada && k === 1
        await pb.collection('interacoes').create({
          lead: leadId,
          tipo: ultima ? 'E-mail' : TIPOS[k % TIPOS.length],
          data: dataDiasAtras(total - k),
          responsavel,
          observacao: ultima
            ? 'Proposta comercial enviada (demonstração).'
            : `Contato de acompanhamento ${k + 1} (demonstração).`,
          proposta: ultima,
          cancelada: !!cancelar,
          cancelada_motivo: cancelar ? 'Registro duplicado (demonstração).' : '',
        })
      }
    }
    return ids.length
  },

  async remover(): Promise<number> {
    const r = await pb.collection('leads').getList(1, 200, { filter: FILTRO_DEMO, fields: 'id' })
    for (const lead of r.items) {
      await apagarVinculados('interacoes', lead.id)
      await apagarVinculados('oportunidades', lead.id)
      await apagarVinculados('transbordos', lead.id)
      await pb.collection('leads').delete(lead.id)
    }
    return r.items.length
  },
}
