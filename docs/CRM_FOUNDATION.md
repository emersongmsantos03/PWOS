# Fundação do CRM

## Compatibilidade

O CRM foi adicionado de forma incremental. Clientes, usuários, cargos, chamados,
autenticação e integrações existentes não foram substituídos.

Enquanto a API PostgreSQL não é ativada, o ambiente local mantém os dados do CRM
em arquivos separados:

- `data/crm-pipelines.local.json`
- `data/crm-opportunities.local.json`
- `data/client-services.local.json`
- `data/projects.local.json`

Esses arquivos não contêm dados de demonstração. O pipeline inicial é apenas uma
configuração operacional.

## Fluxo implementado

1. O usuário autorizado pode criar vários CRM's, cada um com seu próprio Kanban.
2. Cada CRM pode ter quantas etapas operacionais forem necessárias.
3. Nome, cor, probabilidade e ordem das etapas são configuráveis.
4. Uma oportunidade é cadastrada no CRM selecionado.
5. Toda mudança de etapa gera uma atividade com autor e horário.
6. A etapa de perda exige motivo.
7. A etapa de ganho abre o fluxo de conversão.
8. A conversão verifica CPF/CNPJ, e-mail, telefone, nome e domínio.
9. A confirmação cria cliente e serviço contratado, sem excluir a oportunidade.
10. Opcionalmente, cria um projeto de onboarding e tarefas iniciais.
11. A oportunidade recebe a referência permanente do cliente criado.
12. Uma oportunidade convertida não pode ser convertida ou movimentada novamente.

## Acesso por setor

Cada CRM pode ser associado a um ou mais setores cadastrados em Equipe. Quando
nenhum setor é selecionado, o CRM fica disponível para todos os setores.

- colaboradores visualizam apenas CRM's liberados para o seu setor;
- criação, edição, movimentação, conversão e exclusão repetem essa validação na API;
- usuários com `crm.manage_pipelines` podem visualizar e administrar todos os CRM's;
- uma oportunidade de um CRM não é retornada para usuários sem acesso ao setor;
- oportunidades convertidas não podem ser editadas ou excluídas.

O modelo relacional usa `CrmPipelineDepartment` para representar a relação
muitos-para-muitos entre CRM's e setores.

## Atividades e qualificação

As oportunidades suportam:

- notas, ligações, mensagens, e-mails, reuniões e comentários;
- propostas com valor, validade, estado e observações;
- equipe participante;
- tags;
- campos obrigatórios definidos individualmente em cada etapa.

A API bloqueia a movimentação quando um campo exigido pela etapa de destino não
estiver preenchido. A conversão também pode vincular a oportunidade a um cliente
existente, evitando cadastros duplicados.

Reversões exigem `crm.reverse_conversion` e uma justificativa. O cliente, serviços,
projetos e tarefas derivados permanecem preservados, e o impacto é registrado no
histórico da oportunidade.

## Workspace do cliente

O detalhe do cliente reutiliza o cadastro existente e acrescenta:

- múltiplos contatos, com indicação de contato principal;
- serviços contratados, valor e forma de cobrança;
- projetos, objetivo, prazo, status e progresso;
- resumo de receita recorrente;
- timeline comercial ligada à oportunidade convertida.

Clientes que possuem conversão, serviços ou projetos não podem ser excluídos. O
fluxo correto é alterar o status, preservando o histórico operacional.

## Tarefas, agenda e indicadores

O módulo de tarefas possui visualizações em lista e Kanban, vínculo opcional com
cliente/projeto/oportunidade, responsável, participantes, prioridade, prazo,
estimativa, tempo registrado, tags, comentários e menções.

A agenda possui eventos pessoais e compartilhados, participantes, categoria,
local/link, recorrência e lembrete. A API limita a consulta ao proprietário e aos
participantes, exceto quando o usuário possui `calendar.view_team`.

Relatórios usam os registros persistidos de CRM, clientes, tarefas e agenda para
calcular funil, conversão, receitas, clientes ativos, atrasos e compromissos. Não
há geração de valores fictícios nesses indicadores operacionais.

## Migração para PostgreSQL

O schema em `packages/database/prisma/schema.prisma` contém a fundação relacional:

- `Lead`, `Opportunity`, `Pipeline` e `PipelineStage`;
- `StageTransition` e `CommercialActivity`;
- `LeadConversion` e `ConversionReversal`;
- `ClientService`.

A ativação em produção deve ser feita com uma migração aditiva:

1. criar as novas tabelas sem remover as atuais;
2. importar os JSONs com um script idempotente;
3. comparar contagens e identificadores;
4. ativar a API persistente por feature flag;
5. manter backup dos JSONs durante o período de validação;
6. aplicar restrições únicas somente depois da conferência dos dados.

`LeadConversion.leadId` e `LeadConversion.opportunityId` são únicos para impedir
conversões duplicadas no banco.

## Permissões

O catálogo agora inclui:

- `crm.*`;
- `tasks.*`;
- `calendar.*`.

O backend valida as permissões de visualização, criação, movimentação e conversão.
Cargos existentes devem receber explicitamente as novas permissões; os cargos
protegidos Desenvolvedor e CEO recebem o catálogo completo.
