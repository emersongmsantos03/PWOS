# Páginas públicas do PW OS

Publicado em Azure Storage Static Website, sem aplicação, login, API ou banco de dados.

- Resource group: `pw-os-prod`
- Storage account: `pwoslegal2026` (Standard LRS, Brazil South)
- Origem: `public/legal/`
- Política: https://pwoslegal2026.z15.web.core.windows.net/privacidade.html
- Termos: https://pwoslegal2026.z15.web.core.windows.net/termos.html
- Exclusão: https://pwoslegal2026.z15.web.core.windows.net/exclusao-de-dados.html

## Atualização

Com o Azure CLI autenticado na assinatura correspondente:

```sh
python3 scripts/deploy-legal-pages.py
```

O script publica exclusivamente os seis arquivos previstos no contêiner `$web`,
com tipos de conteúdo explícitos e cache de cinco minutos. Credenciais de storage
ficam somente na memória do processo. Não são copiados `.env`, dados operacionais,
backups ou arquivos de banco. A aplicação Container Apps existente não é atualizada.
O recurso de armazenamento tem cobrança por uso conforme a assinatura Azure.

As mesmas páginas são incluídas em `dist/legal/` pelo build do Vite para uma futura
publicação junto com o aplicativo.

## Conteúdo e atendimento

O contato usado é `comercial@pwmidia.com.br`, informado no cadastro Meta do PW OS API.
A exclusão é solicitada por e-mail e requer atendimento pela equipe; não há callback
automático de exclusão. Na Meta, selecionar **URL de instruções de exclusão de dados**.
Manter o conteúdo alinhado às práticas de operação, retenção e integrações habilitadas.
A publicação destas páginas não publica nem aprova automaticamente o aplicativo Meta.

Não usar o hostname destas páginas como domínio/callback OAuth do PW OS: esses campos
se referem ao endereço onde a aplicação e seu backend realmente são executados.

Referências consultadas:
- https://learn.microsoft.com/en-us/azure/storage/blobs/storage-blob-static-website
- https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm
