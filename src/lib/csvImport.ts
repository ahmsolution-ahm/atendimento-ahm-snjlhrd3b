// F1-T05 — SPEC 1.2: parser e validador de importação de leads (CSV/TSV).
// Aceita: UTF-8 e UTF-16 (com/sem BOM), separadores , ; \t, cabeçalhos em PT/EN
// (inclui o formato de exportação do RD Station: Email|Nome|Telefone Principal|Celular|Cargo|Empresa).
// Retorna prévia: linhas válidas, inválidas (com motivo) e duplicidades — nada é gravado aqui.

export interface CsvLeadRow {
  nome: string
  empresa: string
  contato: string
  origem?: string
  produto_interesse?: string
  dor?: string
  urgencia?: string
  cargo?: string
  telefone?: string
  celular?: string
  // F2-T01 — emenda 1.2a: campos de entrada (colunas opcionais)
  area_interesse?: string
  pais?: string
  idioma?: string
  modelo_compra?: string
  linha: number
}

// F2-T01: valores aceitos nas colunas novas — comparação sem acento e sem maiúsculas,
// com apelidos comuns; valor fora da lista torna a linha inválida (como a urgência).
const semAcento = (s: string) =>
  (s || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')

const AREAS: Record<string, string> = {
  'qualidade no transporte': 'Qualidade no Transporte',
  'qualidade do transporte': 'Qualidade no Transporte',
  transporte: 'Qualidade no Transporte',
  'cadeia do frio': 'Cadeia do Frio',
  'cadeia de frio': 'Cadeia do Frio',
  frio: 'Cadeia do Frio',
  'seguranca e logistica': 'Segurança e Logística',
  seguranca: 'Segurança e Logística',
  logistica: 'Segurança e Logística',
}
const IDIOMAS: Record<string, string> = {
  'pt-br': 'pt-BR',
  pt: 'pt-BR',
  portugues: 'pt-BR',
  portuguese: 'pt-BR',
  es: 'es',
  espanhol: 'es',
  spanish: 'es',
  en: 'en',
  ingles: 'en',
  english: 'en',
}
const MODELOS: Record<string, string> = {
  nacional: 'Nacional',
  importacao: 'Importação',
  importado: 'Importação',
}

export const normalizarArea = (v?: string) => (v ? AREAS[semAcento(v)] : undefined)
export const normalizarIdioma = (v?: string) => (v ? IDIOMAS[semAcento(v)] : undefined)
export const normalizarModeloCompra = (v?: string) => (v ? MODELOS[semAcento(v)] : undefined)

export interface LinhaInvalida {
  linha: number
  motivo: string
  dados: string[]
}

export interface PreviaImportacao {
  total: number
  validas: CsvLeadRow[]
  invalidas: LinhaInvalida[]
  duplicadasNoArquivo: CsvLeadRow[]
  duplicadasNaBase: CsvLeadRow[]
  // Bloco 5: só os novos são gravados; sem verificação da base, a importação fica bloqueada
  novos: CsvLeadRow[]
  verificacaoBase: boolean
  cabecalhos: string[]
}

// mapeamento de cabeçalhos conhecidos → campos do sistema
const HEADER_MAP: Record<string, keyof CsvLeadRow> = {
  nome: 'nome',
  'nome do contato': 'nome',
  name: 'nome',
  empresa: 'empresa',
  'nome da empresa': 'empresa',
  company: 'empresa',
  'empresa (nome)': 'empresa',
  contato: 'contato',
  email: 'contato',
  'e-mail': 'contato',
  'e-mail principal': 'contato',
  'email principal': 'contato',
  'e-mail (principal)': 'contato',
  origem: 'origem',
  'origem do lead': 'origem',
  source: 'origem',
  produto: 'produto_interesse',
  'produto de interesse': 'produto_interesse',
  produto_interesse: 'produto_interesse',
  dor: 'dor',
  'dor / necessidade': 'dor',
  necessidade: 'dor',
  urgencia: 'urgencia',
  urgência: 'urgencia',
  'telefone principal': 'telefone',
  telefone: 'telefone',
  telefone_1: 'telefone',
  'telefone fixo': 'telefone',
  fone: 'telefone',
  phone: 'telefone',
  'phone number': 'telefone',
  celular: 'celular',
  'telefone celular': 'celular',
  mobile: 'celular',
  whatsapp: 'celular',
  cargo: 'cargo',
  'cargo / função': 'cargo',
  job: 'cargo',
  // F2-T01
  'área de interesse': 'area_interesse',
  'area de interesse': 'area_interesse',
  area_interesse: 'area_interesse',
  área: 'area_interesse',
  area: 'area_interesse',
  país: 'pais',
  pais: 'pais',
  country: 'pais',
  idioma: 'idioma',
  language: 'idioma',
  'modelo de compra': 'modelo_compra',
  modelo_compra: 'modelo_compra',
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s
}

function decodeText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  // BOM UTF-16 LE (FF FE) ou BE (FE FF)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(bytes)
  // BOM UTF-8 (EF BB BF) — TextDecoder já remove
  try {
    return stripBom(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch (_) {
    // fallback latin-1 (comum em exports do Excel PT-BR)
    return new TextDecoder('latin-1').decode(bytes)
  }
}

function detectarSeparador(cabecalho: string): string {
  const counts: Record<string, number> = {
    ';': (cabecalho.match(/;/g) || []).length,
    '\t': (cabecalho.match(/\t/g) || []).length,
    ',': (cabecalho.match(/,/g) || []).length,
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

// parser CSV simples com suporte a aspas duplas
function parseCsv(text: string, sep: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === sep) {
      row.push(field)
      field = ''
    } else if (ch === '\r') {
      // ignore (tratado no \n)
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += ch
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

export function parseCsvFile(buffer: ArrayBuffer): { cabecalhos: string[]; rows: string[][] } {
  const text = decodeText(buffer)
  const firstLine = text.slice(0, text.indexOf('\n') > 0 ? text.indexOf('\n') : text.length)
  const sep = detectarSeparador(stripBom(firstLine))
  const rows = parseCsv(text, sep)
  if (rows.length === 0) throw new Error('Arquivo vazio ou ilegível.')
  const cabecalhos = rows[0].map((h) => h.trim())
  return { cabecalhos, rows: rows.slice(1) }
}

export function mapearCabecalhos(cabecalhos: string[]): (keyof CsvLeadRow | null)[] {
  return cabecalhos.map((h) => {
    const key = h.trim().toLowerCase()
    return HEADER_MAP[key] ?? null
  })
}

export function validarLinhas(
  rows: string[][],
  mapa: (keyof CsvLeadRow | null)[],
  inicioLinha = 2,
): { validas: CsvLeadRow[]; invalidas: LinhaInvalida[] } {
  const validas: CsvLeadRow[] = []
  const invalidas: LinhaInvalida[] = []

  rows.forEach((row, idx) => {
    const linha = inicioLinha + idx
    const rec: Partial<CsvLeadRow> = {}
    mapa.forEach((campo, colIdx) => {
      if (!campo) return
      const val = (row[colIdx] ?? '').trim()
      if (val) rec[campo] = val as never
    })

    const semNada = Object.values(rec).every((v) => !v || !String(v).trim())
    if (semNada) return // linha em branco: ignorada silenciosamente

    const faltando: string[] = []
    if (!rec.nome) faltando.push('nome')
    if (!rec.empresa) faltando.push('empresa')
    if (!rec.contato) faltando.push('contato')

    if (faltando.length === 3) {
      invalidas.push({
        linha,
        motivo: 'sem nome, empresa e contato (obrigatórios)',
        dados: row.slice(0, 4),
      })
      return
    }
    if (rec.contato && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rec.contato)) {
      // contato pode ser telefone também; só valida formato se parecer e-mail
      if (rec.contato.includes('@')) {
        invalidas.push({ linha, motivo: `e-mail inválido: ${rec.contato}`, dados: row.slice(0, 4) })
        return
      }
    }
    if (rec.urgencia && !['Baixa', 'Média', 'Alta'].includes(rec.urgencia)) {
      invalidas.push({
        linha,
        motivo: `urgência inválida: ${rec.urgencia} (use Baixa, Média ou Alta)`,
        dados: row.slice(0, 4),
      })
      return
    }
    // F2-T01: colunas novas opcionais — valor fora da lista torna a linha inválida
    const area = normalizarArea(rec.area_interesse)
    if (rec.area_interesse && !area) {
      invalidas.push({
        linha,
        motivo: `Área de interesse inválida: ${rec.area_interesse} (use Qualidade no Transporte, Cadeia do Frio ou Segurança e Logística)`,
        dados: row.slice(0, 4),
      })
      return
    }
    const idioma = normalizarIdioma(rec.idioma)
    if (rec.idioma && !idioma) {
      invalidas.push({
        linha,
        motivo: `Idioma inválido: ${rec.idioma} (use pt-BR, es ou en)`,
        dados: row.slice(0, 4),
      })
      return
    }
    const modelo = normalizarModeloCompra(rec.modelo_compra)
    if (rec.modelo_compra && !modelo) {
      invalidas.push({
        linha,
        motivo: `Modelo de compra inválido: ${rec.modelo_compra} (use Nacional ou Importação)`,
        dados: row.slice(0, 4),
      })
      return
    }

    validas.push({
      nome: rec.nome || '',
      empresa: rec.empresa || '',
      contato: rec.contato || '',
      origem: rec.origem || 'Importação CSV',
      produto_interesse: rec.produto_interesse || undefined,
      dor: rec.dor || undefined,
      urgencia: rec.urgencia || undefined,
      cargo: rec.cargo || undefined,
      telefone: rec.telefone || undefined,
      celular: rec.celular || undefined,
      area_interesse: area,
      pais: rec.pais || undefined,
      idioma,
      modelo_compra: modelo,
      linha,
    })
  })

  return { validas, invalidas }
}

// chave de duplicidade (contato + empresa, sem diferenciar maiúsculas/espaços nas pontas) —
// a mesma usada no arquivo e na comparação com a base.
// Bloco 5: linha SEM contato usa nome + empresa (senão um rascunho sem e-mail seria
// gravado de novo a cada reimportação da mesma base).
export function chaveDuplicidade(contato: string, empresa: string, nome: string = ''): string {
  const c = (contato || '').trim().toLowerCase()
  const e = (empresa || '').trim().toLowerCase()
  if (c) return `${c}|${e}`
  return `nome:${(nome || '').trim().toLowerCase()}|${e}`
}

/**
 * D1 (0.0.59): chaves que um registro JÁ EXISTENTE na base representa. Além da chave
 * principal, um registro com nome gera a chave secundária nome + empresa — assim uma linha
 * do arquivo SEM e-mail reconhece o lead que existe na base COM e-mail.
 */
export function chavesDoRegistroBase(contato: string, empresa: string, nome: string): string[] {
  const principal = chaveDuplicidade(contato, empresa, nome)
  const chaves = [principal]
  if ((nome || '').trim()) {
    const secundaria = chaveDuplicidade('', empresa, nome)
    if (secundaria !== principal) chaves.push(secundaria)
  }
  return chaves
}

export interface SelecaoImportacao {
  novos: CsvLeadRow[]
  duplicadasNaBase: CsvLeadRow[]
  duplicadasNoArquivo: CsvLeadRow[]
}

/**
 * Bloco 5: separa o que será gravado. Já existe na base → ignorada; repetida dentro do
 * arquivo → a primeira ocorrência grava, as seguintes são ignoradas. Toda linha válida cai
 * em exatamente um dos três grupos (novos + duplicadas = válidas).
 */
export function selecionarNovos(validas: CsvLeadRow[], chavesBase: Set<string>): SelecaoImportacao {
  const vistas = new Set<string>()
  const r: SelecaoImportacao = { novos: [], duplicadasNaBase: [], duplicadasNoArquivo: [] }
  for (const l of validas) {
    const k = chaveDuplicidade(l.contato, l.empresa, l.nome)
    if (chavesBase.has(k)) r.duplicadasNaBase.push(l)
    else if (vistas.has(k)) r.duplicadasNoArquivo.push(l)
    else {
      // a linha aceita passa a "existir": registra as mesmas chaves de um registro da base
      for (const kk of chavesDoRegistroBase(l.contato, l.empresa, l.nome)) vistas.add(kk)
      r.novos.push(l)
    }
  }
  return r
}

// Bloco 5: relatório final da importação, com plural correto
export function mensagemImportacao(criados: number, ignorados: number, falhas: number): string {
  const partes: string[] = []
  partes.push(
    criados === 0
      ? 'Nenhum lead novo importado.'
      : criados === 1
        ? '1 novo lead importado.'
        : `${criados.toLocaleString('pt-BR')} novos leads importados.`,
  )
  if (ignorados > 0) {
    partes.push(
      ignorados === 1
        ? '1 já existente foi ignorado.'
        : `${ignorados.toLocaleString('pt-BR')} já existentes foram ignorados.`,
    )
  }
  if (falhas > 0) {
    partes.push(
      falhas === 1
        ? '1 não importado por erro.'
        : `${falhas.toLocaleString('pt-BR')} não importados por erro.`,
    )
  }
  return partes.join(' ')
}

// Bloco 4: telefone do lead — usa o telefone principal; se não houver, o celular
export function telefoneDaLinha(l: Pick<CsvLeadRow, 'telefone' | 'celular'>): string {
  return (l.telefone || l.celular || '').trim()
}

export function detectarDuplicadasNoArquivo(validas: CsvLeadRow[]): CsvLeadRow[] {
  const seen = new Map<string, CsvLeadRow>()
  const dups: CsvLeadRow[] = []
  for (const l of validas) {
    const key = chaveDuplicidade(l.contato, l.empresa, l.nome)
    if (seen.has(key)) dups.push(l)
    else seen.set(key, l)
  }
  return dups
}
