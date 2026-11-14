// Fase 2 · Bloco D — importação do histórico do Pipedrive (decisões do owner em
// 06_notas/analise-bloco-d-pipedrive.md, aprovadas em 14/11/2026):
//  1. etapa "Fechamento" → 5. Negociação;  2. todo o Comercial na trilha alta;
//  3. Pré-vendas vira LEAD;  4. Conversa Abandonada e Testes não entram;
//  5. motivos: lista de 25 + sinônimos óbvios; o resto fica sem classificação (texto guardado);
//  6. moedas fora de BRL/USD: só o valor original guardado (nunca converter);  7. tudo desde 2011.
// Funções puras (leitura do .xlsx sem dependências + mapeamento) — testadas com a planilha real.

export type Linha = Record<string, string>

// ------------------------------------------------------------------ leitura do .xlsx
// .xlsx = zip; lê o diretório central e descomprime com DecompressionStream (navegador/Node 18+)

const u16 = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8)
const u32 = (b: Uint8Array, o: number) =>
  (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

async function inflar(dados: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw')
  const fluxo = new Blob([dados as BlobPart]).stream().pipeThrough(ds)
  return new Uint8Array(await new Response(fluxo).arrayBuffer())
}

export async function lerZip(buf: ArrayBuffer): Promise<Map<string, string>> {
  const b = new Uint8Array(buf)
  let fim = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (u32(b, i) === 0x06054b50) {
      fim = i
      break
    }
  }
  if (fim < 0) throw new Error('O arquivo não é uma planilha do Excel (.xlsx) válida.')
  const total = u16(b, fim + 10)
  let p = u32(b, fim + 16)
  const arquivos = new Map<string, string>()
  const dec = new TextDecoder('utf-8')
  for (let n = 0; n < total; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('A planilha está corrompida.')
    const metodo = u16(b, p + 10)
    const tamComp = u32(b, p + 20)
    const lenNome = u16(b, p + 28)
    const lenExtra = u16(b, p + 30)
    const lenCom = u16(b, p + 32)
    const offLocal = u32(b, p + 42)
    const nome = dec.decode(b.subarray(p + 46, p + 46 + lenNome))
    p += 46 + lenNome + lenExtra + lenCom
    if (!/^xl\/(sharedStrings\.xml|worksheets\/sheet1\.xml)$/.test(nome)) continue
    const inicio = offLocal + 30 + u16(b, offLocal + 26) + u16(b, offLocal + 28)
    const bruto = b.subarray(inicio, inicio + tamComp)
    const conteudo = metodo === 0 ? bruto : await inflar(bruto)
    arquivos.set(nome, dec.decode(conteudo))
  }
  return arquivos
}

const decXml = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&')

const textos = (xml: string) =>
  [...xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => decXml(t[1])).join('')

export function lerPlanilha(arquivos: Map<string, string>): {
  cabecalho: string[]
  linhas: Linha[]
} {
  const sheet = arquivos.get('xl/worksheets/sheet1.xml')
  if (!sheet) throw new Error('A planilha não tem a primeira aba com os negócios.')
  const ss = arquivos.get('xl/sharedStrings.xml') || ''
  const compartilhados = [...ss.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textos(m[1]))
  const coluna = (ref: string) => {
    const letras = (ref.match(/^[A-Z]+/) || ['A'])[0]
    let n = 0
    for (const c of letras) n = n * 26 + (c.charCodeAt(0) - 64)
    return n - 1
  }
  const linhas: string[][] = []
  for (const rm of sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const linha: string[] = []
    for (const cm of rm[1].matchAll(/<c ([^>]*?)(\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1]
      const interno = cm[3] || ''
      const ref = (attrs.match(/r="([A-Z]+\d+)"/) || [])[1]
      if (!ref) continue
      const tipo = (attrs.match(/t="([^"]+)"/) || [])[1]
      let v = (interno.match(/<v>([\s\S]*?)<\/v>/) || [])[1]
      if (tipo === 's') v = compartilhados[Number(v)]
      else if (tipo === 'inlineStr') v = textos(interno)
      else if (v !== undefined) v = decXml(v)
      linha[coluna(ref)] = v ?? ''
    }
    linhas.push(linha)
  }
  const cabecalho = (linhas[0] || []).map((h) => (h || '').trim())
  const dados = linhas
    .slice(1)
    .map((l) => Object.fromEntries(cabecalho.map((h, i) => [h, (l[i] ?? '').toString()])))
  return { cabecalho, linhas: dados }
}

// ------------------------------------------------------------------ normalização
// mapa manual de acentos (o servidor usa o MESMO mapa — o JSVM não garante normalize())
const ACENTOS: Record<string, string> = {
  á: 'a',
  à: 'a',
  â: 'a',
  ã: 'a',
  ä: 'a',
  é: 'e',
  è: 'e',
  ê: 'e',
  ë: 'e',
  í: 'i',
  ì: 'i',
  î: 'i',
  ï: 'i',
  ó: 'o',
  ò: 'o',
  ô: 'o',
  õ: 'o',
  ö: 'o',
  ú: 'u',
  ù: 'u',
  û: 'u',
  ü: 'u',
  ç: 'c',
  ñ: 'n',
}

export function normalizar(s: string | undefined | null): string {
  return String(s || '')
    .toLowerCase()
    .replace(/[áàâãäéèêëíìîïóòôõöúùûüçñ]/g, (c) => ACENTOS[c] || c)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export const chaveLead = (empresa: string, pessoa: string) =>
  `${normalizar(empresa)}|${normalizar(pessoa)}`

// ------------------------------------------------------------------ regras de mapeamento
export const FUNIS_OPORTUNIDADE = [
  '[PD] Comercial',
  '[PD] Pós-Venda',
  '[PD] Comercial LATAM',
  '[PD] Post-Ventas LATAM',
]
export const FUNIS_LEAD = ['[PD] Pré-vendas', '[PD] Pre-Ventas LATAM']
export const FUNIS_IGNORADOS = ['Conversa Abandonada', 'Testes de Automação']

// etapa do Pipedrive (normalizada) → ordem da etapa na trilha alta (Site Assessment)
export const ETAPA_PARA_ORDEM: Record<string, number> = {
  refinamento: 3,
  refinamiento: 3,
  'apresentacao de projeto': 4,
  'presentacion de proyecto': 4,
  negociacao: 5,
  negociacion: 5,
  fechamento: 5, // decisão 1 do owner
  implementacao: 6,
  implementacion: 6,
  realidade: 7,
  realidad: 7,
  'adocao corporativa': 8,
  'adopcion corporativa': 8,
}

export const MOTIVOS_LISTA = [
  'Desistência',
  'Sem retorno do cliente',
  'Curiosidade',
  'Duplicidade',
  'Não consegui contato',
  'Qualificação inadequada MKT',
  'Inviabilidade técnica',
  'Preço',
  'Optou por outra solução',
  'Suspenso pelo cliente',
  'Cliente do cliente',
  'Empresa não está no momento',
  'Projeto não aprovado',
  'Características técnicas',
  'Oferta de fornecimento',
  'Prazo de entrega',
  'Aprovação financeira',
  'Barreira tecnológica',
  'Decisão gerencial',
  'Política de priorização',
  'Solução do concorrente',
  'Dados de contato incorretos',
  'Percepção de valor agregado',
  'Prazo de implantação',
  'Relacionamento com fornecedor atual',
]

// sinônimos óbvios aprovados pelo owner (decisão 5) — chave normalizada → motivo da lista
export const SINONIMOS_MOTIVO: Record<string, string> = {
  duplicado: 'Duplicidade',
  'negocio duplicado': 'Duplicidade',
  'barreira tecnogica': 'Barreira tecnológica',
  'empresa nao esta no momento para implantacao': 'Empresa não está no momento',
  'sem retorno': 'Sem retorno do cliente',
  'sem contato': 'Não consegui contato',
  'nao e possivel estabelecer contato': 'Não consegui contato',
  'desistiu do projeto': 'Desistência',
  'cliente desistiu do projeto': 'Desistência',
  desistiu: 'Desistência',
}

const MOTIVO_POR_CHAVE = new Map(MOTIVOS_LISTA.map((m) => [normalizar(m), m]))

export function classificarMotivo(texto: string): { motivo: string | null; observacao: string } {
  const original = (texto || '').trim()
  const k = normalizar(original)
  if (!k) return { motivo: null, observacao: '' }
  const motivo = MOTIVO_POR_CHAVE.get(k) || SINONIMOS_MOTIVO[k] || null
  // classificado: o texto original só vira observação se diferir do nome do motivo
  if (motivo) return { motivo, observacao: normalizar(motivo) === k ? '' : original }
  return { motivo: null, observacao: original }
}

// "AAAA-MM-DD HH:MM:SS" → formato de data do PocketBase (UTC); vazio se inválido
export function dataPb(s: string | undefined): string {
  const m = String(s || '')
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/)
  return m ? `${m[1]} ${m[2]}.000Z` : ''
}

export interface ItemImportacao {
  pipedrive_id: string
  tipo: 'oportunidade' | 'lead'
  funil: string
  etapa: string
  status: 'Aberto' | 'Ganho' | 'Perdido' | string
  empresa: string
  pessoa: string
  chave: string
  titulo: string
  proprietario: string
  criado_em: string
  fechado_em: string
  etapa_desde: string
  ordem_etapa: number // só oportunidade (trilha alta)
  resultado: '' | 'ganha' | 'perdida'
  motivo_perda: string | null
  observacao: string
  valor: number // só BRL/USD
  moeda: '' | 'BRL' | 'USD'
  valor_original: number
  moeda_original: string
  produto: string
}

export interface Descarte {
  pipedrive_id: string
  motivo: string
}

export interface ResultadoMapeamento {
  itens: ItemImportacao[]
  descartes: Descarte[]
}

export function mapearNegocios(linhas: Linha[]): ResultadoMapeamento {
  const itens: ItemImportacao[] = []
  const descartes: Descarte[] = []
  for (const l of linhas) {
    const id = (l['ID'] || '').trim()
    const funil = (l['Funil'] || '').trim()
    if (!id) {
      descartes.push({ pipedrive_id: '', motivo: 'Linha sem número do negócio' })
      continue
    }
    if (FUNIS_IGNORADOS.includes(funil)) {
      descartes.push({ pipedrive_id: id, motivo: `Funil não importado: ${funil}` })
      continue
    }
    const ehOp = FUNIS_OPORTUNIDADE.includes(funil)
    const ehLead = FUNIS_LEAD.includes(funil)
    if (!ehOp && !ehLead) {
      descartes.push({
        pipedrive_id: id,
        motivo: `Funil sem regra de importação: ${funil || '(vazio)'}`,
      })
      continue
    }
    const etapa = (l['Etapa'] || '').trim()
    let ordem = 0
    if (ehOp) {
      ordem = ETAPA_PARA_ORDEM[normalizar(etapa)] || 0
      if (!ordem) {
        descartes.push({ pipedrive_id: id, motivo: `Etapa sem equivalência: ${funil} > ${etapa}` })
        continue
      }
    }
    const status = (l['Status'] || '').trim()
    const resultado = status === 'Ganho' ? 'ganha' : status === 'Perdido' ? 'perdida' : ''
    const motivo =
      resultado === 'perdida'
        ? classificarMotivo(l['Motivo da perda'])
        : { motivo: null, observacao: '' }
    const moedaOriginal = (l['Moeda de Valor'] || '').trim().toUpperCase()
    const valorOriginal = Number(String(l['Valor'] || '').replace(',', '.')) || 0
    const moedaAceita = moedaOriginal === 'BRL' || moedaOriginal === 'USD'
    const fechado =
      resultado === 'ganha'
        ? dataPb(l['Ganho em']) || dataPb(l['Negócio fechado em'])
        : resultado === 'perdida'
          ? dataPb(l['Data de perda']) || dataPb(l['Negócio fechado em'])
          : ''
    const empresa = (l['Organização'] || '').trim()
    const pessoa = (l['Contact'] || '').trim()
    itens.push({
      pipedrive_id: id,
      tipo: ehOp ? 'oportunidade' : 'lead',
      funil,
      etapa,
      status,
      empresa,
      pessoa,
      chave: chaveLead(empresa || pessoa, pessoa || empresa),
      titulo: (l['Título'] || '').trim(),
      proprietario: (l['Proprietário'] || '').trim(),
      criado_em: dataPb(l['Negócio criado em']),
      fechado_em: fechado,
      etapa_desde: dataPb(l['Última alteração de etapa']) || dataPb(l['Negócio criado em']),
      ordem_etapa: ordem,
      resultado,
      motivo_perda: motivo.motivo,
      observacao: motivo.observacao,
      valor: moedaAceita ? valorOriginal : 0,
      moeda: moedaAceita && valorOriginal > 0 ? (moedaOriginal as 'BRL' | 'USD') : '',
      valor_original: valorOriginal,
      moeda_original: moedaOriginal,
      produto: (l['Produto'] || l['Nome do produto'] || '').trim(),
    })
  }
  return { itens, descartes }
}

export interface ResumoImportacao {
  total: number
  oportunidades: number
  leads: number
  descartados: number
  porStatus: Record<string, number>
  porEtapa: Record<string, number>
  descartesPorMotivo: Record<string, number>
  motivos: { classificados: number; semClassificacao: number; vazios: number }
  outrasMoedas: number
  semValor: number
}

export function resumir(r: ResultadoMapeamento, totalLinhas: number): ResumoImportacao {
  const inc = (m: Record<string, number>, k: string) => {
    m[k] = (m[k] || 0) + 1
  }
  const porStatus: Record<string, number> = {}
  const porEtapa: Record<string, number> = {}
  const descartesPorMotivo: Record<string, number> = {}
  const motivos = { classificados: 0, semClassificacao: 0, vazios: 0 }
  let outrasMoedas = 0
  let semValor = 0
  for (const it of r.itens) {
    inc(
      porStatus,
      `${it.tipo === 'oportunidade' ? 'Oportunidade' : 'Lead'} · ${it.status || 'sem status'}`,
    )
    if (it.tipo === 'oportunidade') inc(porEtapa, String(it.ordem_etapa))
    if (it.resultado === 'perdida') {
      if (it.motivo_perda) motivos.classificados++
      else if (it.observacao) motivos.semClassificacao++
      else motivos.vazios++
    }
    if (it.moeda_original && it.moeda_original !== 'BRL' && it.moeda_original !== 'USD')
      outrasMoedas++
    if (it.tipo === 'oportunidade' && !(it.valor > 0)) semValor++
  }
  for (const d of r.descartes)
    inc(
      descartesPorMotivo,
      d.motivo.replace(/: .*/, (m) => (m.length > 60 ? ': (vários)' : m)),
    )
  return {
    total: totalLinhas,
    oportunidades: r.itens.filter((i) => i.tipo === 'oportunidade').length,
    leads: r.itens.filter((i) => i.tipo === 'lead').length,
    descartados: r.descartes.length,
    porStatus,
    porEtapa,
    descartesPorMotivo,
    motivos,
    outrasMoedas,
    semValor,
  }
}
