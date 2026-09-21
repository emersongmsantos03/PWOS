# Dados compartilhados de mídia e preferências individuais

Google e Meta usam as conexões OAuth mantidas pelo backend. Qualquer usuário interno
com `media.view` pode selecionar um período e consultar campanhas, comparativos e
o dashboard sem uma sessão Master ou a permissão `media.sync`.

O backend reutiliza dados do intervalo exato. Abrir a tela **nunca** consulta o Google ou a
Meta: ela sempre recebe o histórico salvo, e todos os usuários compartilham o mesmo dado.

A coleta é feita pelo próprio backend, sem depender de usuário logado, uma vez por dia a partir
das 04:00 (São Paulo). Ela atualiza o último período usado, 7, 15 e 30 dias e o mês corrente. Se
a plataforma falhar, a coleta tenta de novo a cada 30 minutos (até 4 tentativas no dia), e só
conta como concluída quando todos os períodos foram atualizados. O log registra
`[Mídia] Coleta diária de AAAA-MM-DD concluída.`

Validade do dado: um período que inclui hoje vale até a próxima coleta das 04:00; um período
encerrado passa a ser definitivo depois da primeira coleta feita após seu último dia. Um dado
fora da validade continua sendo entregue (marcado como `stale`) até a próxima coleta.

Uma consulta ao vivo por pedido de usuário só ocorre quando o período **nunca foi salvo**. Nesse
caso coleta apenas métricas, reaproveitando anúncios, criativos, termos e geografia já salvos.
Consultas simultâneas do mesmo período compartilham o carregamento. Anúncios, criativos, páginas
de destino, termos e geografia do Google só são renovados pela coleta diária (`details=1`, uso
interno) e apenas em contas com veiculação no período, para respeitar a cota da API.

`media.sync` controla somente atualizações forçadas (botão Sincronizar, com intervalo mínimo de
5 minutos entre elas). `stored=1` e `fetch_missing=1` de clientes antigos não impedem o
carregamento de um período ausente.

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
