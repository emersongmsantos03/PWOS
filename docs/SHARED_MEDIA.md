# Dados compartilhados de mídia e preferências individuais

Google e Meta usam as conexões OAuth mantidas pelo backend. Qualquer usuário interno
com `media.view` pode selecionar um período e consultar campanhas, comparativos e
o dashboard sem uma sessão Master ou a permissão `media.sync`.

O backend reutiliza dados do intervalo exato. Se o período ainda não estiver salvo,
consulta a plataforma com as credenciais compartilhadas e persiste contas e campanhas
para os próximos acessos. Consultas simultâneas do mesmo período compartilham o
carregamento. O cache vale por 15 minutos nos intervalos que incluem o dia atual
e por 24 horas nos períodos anteriores. A atualização diária continua disponível.

`media.sync` controla somente atualizações forçadas. `stored=1` e `fetch_missing=1`
de clientes antigos não impedem o carregamento de um período ausente.

A interface preserva as datas escolhidas. Um erro da plataforma nunca devolve dados
de outro intervalo. Se existir cache do período exato, ele pode ser retornado com
um aviso de desatualização; sem cache, a resposta informa a falha da conexão ou da API.

Datas, plataforma, cliente, responsável e preferências da tabela usam chaves de
localStorage com o ID do usuário. A troca de usuário remonta as rotas para descartar
o estado da sessão anterior.

Conectar ou renovar uma autorização OAuth requer Master ou `integrations.authorize`.
A Central de Conexões exige `integrations.view`; desconectar exige
`integrations.revoke`. Consultar campanhas não exige essas permissões.

## Validação

```sh
npm test
npm run build
node scripts/test-shared-media.mjs
node scripts/test-media-periods.mjs
node scripts/test-media-permissions.mjs
```

Os testes usam servidores e dados temporários. O teste de períodos substitui as APIs
externas por respostas controladas e verifica funcionários sem permissão de sync,
mês atual, históricos, comparativos, cache persistente, acessos concorrentes e falhas
dos provedores. Não usa contas ou credenciais de produção.
