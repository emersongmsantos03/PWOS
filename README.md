# PW OS

Fundação do ERP + CRM da PW Media, com foco em decisões, exceções e performance de mídia.

## Executar localmente

Requisito: Node.js 22+. O projeto inclui PostgreSQL portátil para desenvolvimento,
portanto Docker e Homebrew não são obrigatórios.

```bash
npm install
npm run db:start
```

Mantenha esse terminal aberto. Em outro terminal:

```bash
npm run db:deploy
npm run dev
```

Acesse o endereço exibido pelo Vite. Para validar:

```bash
npm run build
npm test
npm run db:validate
```

O banco local fica em `data/postgres/`, não é versionado e preserva os dados
entre reinicializações. A conexão padrão é
`postgresql://postgres:postgres@127.0.0.1:5432/pw_os`.

## Estrutura

```text
apps/
  web/          PWA React responsivo
  api/          contratos iniciais da API
packages/
  database/     modelo PostgreSQL/Prisma
  permissions/  resolução de RBAC e isolamento
docs/           decisões de UX, dados e segurança
infrastructure/ preparação para recursos locais/Azure
```

## Segurança

Copie `.env.example` para `.env` e preencha os valores localmente. Nunca versione senhas ou tokens. A senha da conta master é lida apenas de `PW_OS_MASTER_INITIAL_PASSWORD` e deve exigir troca no primeiro acesso.

## Módulos disponíveis

- boards executivo e do colaborador;
- clientes, contatos, serviços e projetos;
- múltiplos CRM's com pipelines, etapas e acesso por setor;
- conversão rastreável de oportunidade em cliente;
- tarefas, agenda compartilhada e chamados internos;
- mídia paga preparada para integrações oficiais Meta Ads e Google Ads, sem métricas simuladas;
- relatórios operacionais;
- equipe, cargos e permissões granulares;
- temas claro e escuro em layout responsivo.

Consulte [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para decisões da primeira fase.
