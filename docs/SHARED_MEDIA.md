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

## Google Ads: histórico diário

O Google não guarda mais um cache por período. Cada dia fica salvo (gasto, impressões, cliques
e conversões por campanha) em `data/google-daily-history.local.json`, e qualquer período pedido
pela tela é montado **somando os dias já guardados**, sem consultar o Google. Trocar datas,
comparar períodos e abrir a tela por vários usuários não gera nenhuma chamada.

A coleta diária das 04:00 (São Paulo) busca só o que pode mudar: os últimos 7 dias (hoje ainda
parcial; os anteriores se ajustam por atraso de conversões) e qualquer dia que falte. Uma consulta
por conta traz o intervalo inteiro, então buscar 1 ou 7 dias custa o mesmo número de chamadas.
Na primeira execução ela reúne 12 meses de histórico, em blocos de 31 dias, do mais recente ao
mais antigo; se for interrompida, continua de onde parou. Um dia só conta como salvo quando todas
as contas foram coletadas nele.

- **Botão Sincronizar** (`media.sync`): coleta leve dos 3 últimos dias, no mínimo 5 minutos entre
  cliques. Não baixa anúncios nem criativos.
- **Detalhes** (anúncios, criativos, termos de busca, geografia, páginas de destino): renovados
  uma vez por dia, só em contas com veiculação nos últimos 30 dias. Mostram a janela de 30 dias,
  não o período escolhido.
- **Alcance e frequência** não somam entre dias e aparecem como indisponíveis. A "posição no
  leilão" é a média das parcelas diárias ponderada pelas impressões (aproximação).
- **Período fora do histórico** (mais antigo que o início coletado) usa o caminho antigo: consulta
  pontual do período exato, apenas com métricas.
- **Cota diária esgotada:** quando o Google responde "Retry in N seconds", o horário de liberação
  é salvo, nenhuma nova chamada é feita até lá e a tela mostra a mensagem com o horário. O log
  registra qual cota esgotou (`[Google Ads] Cota diária esgotada (...)`). A coleta diária espera
  esse horário em vez de repetir a cada 30 minutos.

Meta continua guardando períodos inteiros, pelas regras da seção anterior.

### Meta Ads: resiliência por login e por conta

A sincronização soma as contas de todos os logins do Facebook conectados. Um login cujo
aplicativo foi apagado ou desconectado (`Error validating application`) é identificado
pelo nome e ignorado nesta execução; as contas dos demais logins seguem normalmente. Se
**todos** os logins estiverem quebrados, a sincronização não grava um painel vazio: falha
com uma mensagem que nomeia qual login reconectar, preservando o histórico salvo.

Dentro de uma conta, uma rejeição da Meta com um código de erro específico (permissão
revogada, conta desativada, parâmetro inválido) isola só aquela conta; as demais
continuam. Uma falha sem código de erro (rede, tempo esgotado) é tratada como sistêmica e
aborta a sincronização inteira, preservando o histórico salvo — nunca mistura dados de
períodos diferentes. Uma falha passageira ao buscar anúncios e criativos é tentada mais
uma vez antes de aparecer como "ainda não sincronizado".

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
node scripts/test-google-daily.mjs
node scripts/test-meta-resilience.mjs
```

Os testes usam servidores e dados temporários. O teste de períodos substitui as APIs
externas por respostas controladas e verifica funcionários sem permissão de sync,
mês atual, históricos, comparativos, cache persistente, acessos concorrentes e falhas
dos provedores. Não usa contas ou credenciais de produção.
