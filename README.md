# PW OS

Fundação do ERP + CRM da PW Media, com foco em decisões, exceções e performance de mídia.

## Executar localmente

Requisitos: Node.js 22+.

```bash
npm install
npm run dev
```

Acesse o endereço exibido pelo Vite. Para validar:

```bash
npm run build
npm test
```

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

## O que está navegável

- board executivo com indicadores, alertas e recomendações;
- carteira e saúde dos clientes;
- mídia paga com filtros Todos, Meta Ads e Google Ads;
- detalhe de análise por campanha;
- relatórios e simulação de link protegido;
- equipe, cargos e visualização da precedência de permissões;
- layout responsivo para desktop e celular.

Consulte [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para decisões da primeira fase.
