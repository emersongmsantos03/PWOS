# Dados compartilhados de mídia e preferências individuais

A conexão OAuth de Google Ads pertence ao backend. Usuários internos com
`media.view` consultam o mesmo cache e histórico por plataforma e período.
Credenciais não são escolhidas pelo usuário conectado. `media.sync` continua
sendo exigida para uma sincronização manual.

Abrir a gestão de mídia, alterar datas e consultar comparativos não renova tokens
nem dispara a importação do Google. Uma sincronização manual autorizada ou a rotina
interna publica os dados na base compartilhada. A interface consulta a base ao
recuperar foco e a cada 60 segundos enquanto estiver visível, preservando os filtros.

Quando não há dados para o período pedido, o backend responde
`MEDIA_PERIOD_NOT_STORED` e informa o período do último cache. A tela oferece
"Ver período salvo"; não apresenta métricas de outra data como se fossem do
período solicitado. `fetch_missing=1` de clientes antigos não inicia mais uma
sincronização implícita.

Datas, plataforma, cliente, responsável e preferências da tabela usam chaves de
localStorage com o ID do usuário. Preferências antigas sem identificação não são
importadas, pois podem pertencer a outra pessoa no mesmo navegador. A troca de
usuário também remonta as rotas para descartar o estado da sessão anterior.

Um token compartilhado expirado requer uma reconexão pelo Master ou por um perfil
com a permissão `integrations.authorize`. A Central de Conexões exige
`integrations.view` para acesso; desconectar contas exige `integrations.revoke`. Os dados já
armazenados permanecem disponíveis a todos os usuários autorizados.

## Validação

```sh
npx vitest run apps/web/src/mediaPreferences.test.ts apps/web/src/mediaPeriodRequest.test.ts mediaConnectionSummary.test.ts
npm run build
node scripts/test-shared-media.mjs
```

O teste de integração cria um diretório temporário e duas sessões (Master e
colaboradora) em um servidor isolado: verifica igualdade dos dados, leitura de uma
atualização compartilhada, período ausente sem credenciais e bloqueio de sync sem
permissão. Não usa contas, dados ou credenciais de produção.
