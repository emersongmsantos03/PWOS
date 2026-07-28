# PW OS — decisões da primeira fase

## UX e design

- A visão geral começa por quatro KPIs contextualizados e três exceções acionáveis. Detalhes aparecem sob demanda.
- Desktop usa navegação lateral persistente; mobile usa barra inferior e cards horizontais com alvos de toque confortáveis.
- Status combina texto, ícone e cor. Métricas exibem período, comparação e atualização.
- “Todos”, “Meta Ads” e “Google Ads” filtram KPIs e tabela com a mesma fonte de estado. “Analisar” preserva a campanha selecionada na URL.

## Dados

O modelo é multi-organização desde a origem. Entidades operacionais recebem `organizationId`, UUID, timestamps e exclusão lógica quando aplicável. Campanhas pertencem a conta, cliente e plataforma; snapshots são imutáveis por período e fonte. Relatórios armazenam filtros e seções; links públicos guardam somente hash do token, validade, revogação e auditoria.

## Permissões

Ordem efetiva: negação individual, concessão individual, cargo, hierarquia configurada e negar por padrão. Perfil técnico não é cargo. Toda consulta da API exige organização; usuários externos exigem também vínculo explícito com cliente e campanha. A origem de cada decisão é retornável para auditoria e simulação.

## Autenticação e segurança

Senha master vem exclusivamente de `PW_OS_MASTER_INITIAL_PASSWORD`, recebe hash Argon2id e exige troca. Tokens de recuperação são aleatórios, de uso único, armazenados por hash e expiram. Sessões podem expirar ou ser revogadas. Eventos sensíveis registram ator, alvo, organização, IP resumido e metadados sem segredos.

## Migração Azure

Banco acessado por adaptador PostgreSQL; arquivos por interface `FileStorage`. As implementações locais podem ser trocadas por Azure Database for PostgreSQL e Azure Blob Storage. Configuração permanece em variáveis de ambiente, compatível futuramente com Key Vault.
