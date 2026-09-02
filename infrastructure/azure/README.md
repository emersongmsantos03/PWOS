# PW OS na Azure — implantação compatível

Esta etapa preserva o funcionamento atual. O contêiner usa os mesmos arquivos em `data/`, montados em um Azure File Share persistente. Não aumente `maxReplicas` enquanto a persistência JSON não for substituída integralmente por PostgreSQL: duas réplicas poderiam gravar o mesmo arquivo ao mesmo tempo.

## 1. Backup obrigatório

Pare apenas as edições no sistema durante a cópia e execute:

```bash
npm run data:backup
pg_dump "$DATABASE_URL" --format=custom --file="backups/pw-os-postgres.dump"
```

O primeiro comando copia os dados operacionais e gera `manifest.json` com SHA-256 de cada arquivo. O diretório bruto `data/postgres/` não é copiado; o `pg_dump` é o backup consistente do PostgreSQL.

## 2. Recursos

Crie um Resource Group, Azure Container Registry, Container Apps Environment, Storage Account e File Share. Registre o compartilhamento no ambiente do Container Apps com o nome `pw-os-data` e monte-o em `/app/data`.

Antes de iniciar a aplicação, envie para a raiz do compartilhamento o conteúdo de `backups/pw-os-data-.../data/`. Confira quantidade, tamanho e hashes do manifesto. O contêiner deliberadamente não inclui `data/`, evitando publicar dados e segredos dentro da imagem.

O exemplo também define `PW_OS_REQUIRE_DATA=true`. Com essa proteção, uma revisão sem os
arquivos operacionais mínimos não fica saudável e não substitui silenciosamente a revisão
anterior mostrando dashboards vazios.

Para recuperar uma implantação que subiu vazia, envie novamente o último backup ao File
Share (sem incluir a pasta intermediária `data`) e reinicie a revisão:

```bash
az storage file upload-batch \
  --account-name SEU_STORAGE_ACCOUNT \
  --source backups/pw-os-data-AAAA-MM-DDTHH-MM-SS-sssZ/data \
  --destination SEU_FILE_SHARE \
  --auth-mode login

az containerapp revision restart \
  --name pw-os-prod \
  --resource-group SEU_RESOURCE_GROUP \
  --revision NOME_DA_REVISAO
```

Depois da reinicialização, valide no mínimo as contagens de usuários, cargos, setores,
clientes e campanhas antes de direcionar tráfego para a revisão.

Construa uma imagem imutável e versionada:

```bash
az acr build --registry SEU_ACR --image pw-os:VERSAO .
```

Use [container-app.yaml.example](container-app.yaml.example) como base. Cadastre os valores secretos pelo Portal/CLI; nunca grave os valores reais no YAML ou no Git. Mantenha uma réplica mínima e máxima nesta fase.

## 3. Azure Communication Services Email

No Azure, crie Email Communication Service e Communication Services, conecte os recursos e valide o domínio próprio com os registros TXT, SPF e DKIM solicitados.

Crie uma aplicação Microsoft Entra para SMTP e configure:

- host `smtp.azurecomm.net`;
- porta `587` com TLS;
- usuário SMTP associado à aplicação Entra;
- senha igual ao client secret da aplicação;
- remetente previamente cadastrado no domínio verificado.

O PW OS usa o e-mail Azure para recuperação de senha e como fallback de relatórios/convites quando o usuário não configurou Gmail. O Gmail individual existente continua funcionando sem alteração.

## 4. Validação e corte

1. Implante primeiro com hostname temporário.
2. Confirme `GET /api/health`.
3. Compare usuários, clientes, tarefas, finanças, CRM, anexos e conexões com o servidor local.
4. Teste login, recuperação de senha, envio de relatório e download de anexo.
5. Só então aponte o domínio oficial.
6. Preserve o servidor local e os backups sem alterações até a conferência final.

O PostgreSQL gerenciado pode ser criado e receber `pw-os-postgres.dump`, mas a aplicação ainda não deve abandonar os JSONs: o schema Prisma atual não cobre todos os módulos. Essa mudança deve acontecer posteriormente, módulo a módulo, com reconciliação de contagens.
