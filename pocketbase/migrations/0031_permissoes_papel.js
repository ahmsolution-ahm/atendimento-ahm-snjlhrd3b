// Fase 2 · Bloco 3 (F2-T11) — permissões por papel.
// 1) users.papel (admin | vendedor). Usuários existentes = vendedor; o owner = admin.
//    O padrão "vendedor" para usuário novo é aplicado no hook permissoes_papel.js.
// 2) Regras da coleção users (antes: cadastro PÚBLICO — qualquer pessoa sem login podia criar
//    conta e enxergar a base):
//    - listar/ver/editar: o próprio usuário ou um administrador;
//    - criar/excluir: só administrador.
//    A troca de papel e o cadastro por não-admin são recusados com 403 no hook.
// 3) Auditoria (exclusoes_auditoria, oportunidade_fechamentos): leitura só para administrador.
// As demais restrições de escrita do vendedor (exclusão, catálogo, demonstração) ficam nos hooks
// de requisição, que respondem 403 com mensagem clara — uma regra de coleção negada responde
// 404/400 genérico. O papel é lido do registro do usuário no banco (e.auth), nunca do cliente.
// A proteção PROVA/DEMO do Bloco 2 (protecao_exclusao.js) continua valendo para todos.
// Down: remove o campo e devolve as regras anteriores.
migrate(
  (app) => {
    const ADMIN = "@request.auth.papel = 'admin'"
    const users = app.findCollectionByNameOrId('users')
    if (!users.fields.getByName('papel')) {
      users.fields.add(
        new SelectField({ name: 'papel', values: ['admin', 'vendedor'], maxSelect: 1 }),
      )
    }
    users.listRule = 'id = @request.auth.id || ' + ADMIN
    users.viewRule = 'id = @request.auth.id || ' + ADMIN
    users.updateRule = 'id = @request.auth.id || ' + ADMIN
    users.createRule = ADMIN
    users.deleteRule = ADMIN
    app.save(users)

    for (const u of app.findAllRecords('users')) {
      const email = (u.getString('email') || '').toLowerCase()
      u.set('papel', email === 'afonso.moreira@ahmsolution.com' ? 'admin' : 'vendedor')
      app.saveNoValidate(u)
    }

    for (const nome of ['exclusoes_auditoria', 'oportunidade_fechamentos']) {
      const c = app.findCollectionByNameOrId(nome)
      c.listRule = ADMIN
      c.viewRule = ADMIN
      app.save(c)
    }
  },
  (app) => {
    const AUTH = "@request.auth.id != ''"
    for (const nome of ['exclusoes_auditoria', 'oportunidade_fechamentos']) {
      const c = app.findCollectionByNameOrId(nome)
      c.listRule = AUTH
      c.viewRule = AUTH
      app.save(c)
    }
    const users = app.findCollectionByNameOrId('users')
    users.listRule = 'id = @request.auth.id'
    users.viewRule = 'id = @request.auth.id'
    users.updateRule = 'id = @request.auth.id'
    users.createRule = ''
    users.deleteRule = 'id = @request.auth.id'
    users.fields.removeByName('papel')
    app.save(users)
  },
)
