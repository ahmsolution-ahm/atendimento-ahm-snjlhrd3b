// F1-T16 — SPEC 1.6 (CA-1-018, RN-1.19): capacidade por vendedor, agregada no servidor.
// Motivo: a coleção users só permite a cada usuário ver o próprio cadastro, então o
// navegador não consegue listar os vendedores. A rota agrega as contagens e devolve apenas
// nome + quantidade (nunca e-mail ou outros dados de usuário).
// Entrada (query): dias = 7 | 30 | 90 | todos; fonte = todas | manual | csv | lp | demo | outras.
// F2-T09: "lp" = origem LP (Landing Page); "outras" = qualquer origem fora das demais fatias,
// para que a soma das fatias feche com o total.
// Valores fora da lista são recusados; a consulta usa parâmetros (sem SQL montado do cliente).
// Processado = lead que passou pela qualificação (não é novo, não está em qualificação,
// não é rascunho). Sem responsável = pendência de dados.
routerAdd(
  'GET',
  '/backend/v1/metricas/capacidade',
  (e) => {
    const q = e.request.url.query()
    const diasTxt = q.get('dias') || 'todos'
    const fonte = q.get('fonte') || 'todas'

    const diasPermitidos = { 7: true, 30: true, 90: true }
    let inicio = ''
    if (diasTxt !== 'todos') {
      const dias = parseInt(diasTxt, 10)
      if (!diasPermitidos[dias]) {
        throw new BadRequestError('Período inválido para o cálculo das métricas.')
      }
      const d = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
      inicio = d.toISOString().slice(0, 10) + ' 00:00:00'
    }

    const fontes = {
      todas: '',
      manual: " AND COALESCE(origem, '') = ''",
      csv: " AND origem = 'Importação CSV'",
      lp: " AND origem = 'LP'",
      demo: " AND origem = 'Demonstração'",
      outras: " AND COALESCE(origem, '') NOT IN ('', 'Importação CSV', 'LP', 'Demonstração')",
    }
    if (!Object.prototype.hasOwnProperty.call(fontes, fonte)) {
      throw new BadRequestError('Fonte inválida para o cálculo das métricas.')
    }

    const where =
      "status NOT IN ('novo', 'em qualificação') AND COALESCE(incompleto, 0) = 0" +
      (inicio ? ' AND created >= {:inicio}' : '') +
      fontes[fonte]

    const linhas = arrayOf(new DynamicModel({ responsavel: '', n: 0 }))
    $app
      .db()
      .newQuery(
        "SELECT COALESCE(responsavel, '') AS responsavel, COUNT(*) AS n FROM leads WHERE " +
          where +
          " GROUP BY COALESCE(responsavel, '')",
      )
      .bind({ inicio: inicio })
      .all(linhas)

    const vendedores = []
    let semResponsavel = 0
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i]
      if (l.responsavel === '') {
        semResponsavel += l.n
        continue
      }
      let nome = 'Usuário removido'
      try {
        const u = $app.findRecordById('users', l.responsavel)
        nome = u.getString('name') || 'Usuário sem nome'
      } catch (_) {
        nome = 'Usuário removido'
      }
      vendedores.push({ id: l.responsavel, nome: nome, processados: l.n })
    }

    return e.json(200, { vendedores: vendedores, semResponsavel: semResponsavel })
  },
  $apis.requireAuth(),
)
