# OAuth em produção

O service worker não deve tratar navegações para `/api` como rotas da SPA.
Antes da correção, o NavigationRoute do Workbox devolvia `index.html` para os
callbacks de Meta/Google. O navegador mostrava o aplicativo, mas o servidor não
recebia o código e não persistia a nova conexão.

`VitePWA.workbox.navigateFallbackDenylist` exclui `/api` e `/legal`. Os callbacks
continuam sendo processados no backend, com validação de state e sessão. Rotas
normais, inclusive `/configuracoes/integracoes`, mantêm o fallback da SPA.

Em 11/09/2026, a correção pontual de produção usa a imagem já implantada como base
e substitui exclusivamente `/app/dist/sw.js`. Imagem:
`pwosprodregistry.azurecr.io/pw-os-prod:oauth-sw-fix-20260911`.
O código-fonte do Vite contém a mesma regra para futuros builds completos.

Verificações: sintaxe do worker; execução do registro Workbox com callbacks e
rotas normais; build Vite; callbacks sem state retornam erro à Central de Conexões.
A confirmação completa requer uma nova autorização interativa do usuário.

Após atualizar o worker no navegador, começar uma NOVA tentativa pela Central de
Conexões. Uma autorização que foi interceptada anteriormente não é recuperada
automaticamente. Uma janela anônima permite testar sem o worker antigo instalado.
