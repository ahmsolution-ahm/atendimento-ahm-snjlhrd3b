import { sugestaoFamilias } from '@/lib/qualificacao'

// F2-T01 — emenda 1.2a §3: campos de entrada do lead (usados no Novo Lead e no Editar Lead).
// A área de interesse sugere as famílias de diagnóstico candidatas (sugestão, não bloqueio).

export interface CamposEntrada {
  area_interesse: string
  pais: string
  idioma: string
  modelo_compra: string
}

export const CAMPOS_ENTRADA_PADRAO: CamposEntrada = {
  area_interesse: '',
  pais: 'Brasil',
  idioma: 'pt-BR',
  modelo_compra: '',
}

const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-[#030507] mb-1'
const campoCls =
  'w-full px-3 py-2.5 rounded-xl border border-[#E5E7EB] text-xs text-[#030507] bg-white outline-none focus:border-[#DE6464]'

export default function CamposEntradaLead({
  valores,
  onChange,
}: {
  valores: CamposEntrada
  onChange: (parcial: Partial<CamposEntrada>) => void
}) {
  const sugestao = sugestaoFamilias(valores.area_interesse)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Área de interesse</label>
          <select
            value={valores.area_interesse}
            onChange={(e) => onChange({ area_interesse: e.target.value })}
            className={campoCls}
          >
            <option value="">— não informada</option>
            <option value="Qualidade no Transporte">Qualidade no Transporte</option>
            <option value="Cadeia do Frio">Cadeia do Frio</option>
            <option value="Segurança e Logística">Segurança e Logística</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Modelo de compra</label>
          <select
            value={valores.modelo_compra}
            onChange={(e) => onChange({ modelo_compra: e.target.value })}
            className={campoCls}
          >
            <option value="">— a definir</option>
            <option value="Nacional">Nacional</option>
            <option value="Importação">Importação</option>
          </select>
        </div>
      </div>
      {sugestao && <p className="-mt-2 text-[11px] text-[#6B7280]">{sugestao}.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>País</label>
          <input
            type="text"
            value={valores.pais}
            onChange={(e) => onChange({ pais: e.target.value })}
            placeholder="Brasil"
            className={campoCls}
          />
        </div>
        <div>
          <label className={labelCls}>Idioma</label>
          <select
            value={valores.idioma}
            onChange={(e) => onChange({ idioma: e.target.value })}
            className={campoCls}
          >
            <option value="">— não informado</option>
            <option value="pt-BR">Português (pt-BR)</option>
            <option value="es">Espanhol (es)</option>
            <option value="en">Inglês (en)</option>
          </select>
        </div>
      </div>
    </div>
  )
}
