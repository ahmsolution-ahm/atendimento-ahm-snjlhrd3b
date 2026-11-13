// Bloco A (estabilidade) — correção do Bloco 3: com a regra "o próprio usuário ou administrador"
// na leitura de users, o vendedor deixou de enxergar os colegas. Efeitos na tela: transbordo
// atribuído a outra pessoa aparecia como "Sem especialista atribuído", a lista de especialistas
// trazia só o próprio vendedor e os históricos perdiam o "por quem".
// Agora: qualquer usuário logado lista/vê os colegas (nome; o e-mail segue a visibilidade do
// próprio registro). Editar continua sendo o próprio usuário ou administrador; criar/excluir,
// só administrador; a troca de papel segue protegida no hook permissoes_papel.js.
// Sem login: nada é listado.
// Down: volta à regra da migration 0031.
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = "@request.auth.id != ''"
    users.viewRule = "@request.auth.id != ''"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.listRule = "id = @request.auth.id || @request.auth.papel = 'admin'"
    users.viewRule = "id = @request.auth.id || @request.auth.papel = 'admin'"
    app.save(users)
  },
)
