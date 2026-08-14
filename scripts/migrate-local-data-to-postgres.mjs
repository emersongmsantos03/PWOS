import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";

const prisma = new PrismaClient();
const organizationId = "00000000-0000-4000-8000-000000000001";
const connectionId = "00000000-0000-4000-8000-000000000002";
const read = (path, fallback) =>
  existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : fallback;
const master = read("data/master-user.local.json", null);
const users = [master, ...read("data/users.local.json", [])].filter(Boolean);
const clients = read("data/clients.local.json", []);
const assignments = read("data/media-assignments.local.json", []);
const cache = read("data/meta-dashboard-cache.local.json", {});
const accounts = cache.payload?.accounts || [];
const campaigns = cache.payload?.campaigns || [];
const since = cache.payload?.since || cache.since;
const until = cache.payload?.until || cache.until;
const syncedAt = new Date(
  cache.payload?.syncedAt || cache.cachedAt || Date.now(),
);

await prisma.organization.upsert({
  where: { id: organizationId },
  create: { id: organizationId, name: "PW OS" },
  update: { name: "PW OS" },
});

for (const user of users) {
  await prisma.user.upsert({
    where: { id: user.id },
    create: {
      id: user.id,
      organizationId,
      email: user.email.toLowerCase(),
      name: user.name,
      phone: user.phone || null,
      avatarDataUrl: user.avatarDataUrl || null,
      roleLabel: user.role || null,
      profile: ["MASTER", "ADMIN", "COLLABORATOR", "CLIENT"].includes(
        user.profile,
      )
        ? user.profile
        : "COLLABORATOR",
      status: "ACTIVE",
      mustChangePassword: Boolean(user.mustChangePassword),
    },
    update: {
      email: user.email.toLowerCase(),
      name: user.name,
      phone: user.phone || null,
      avatarDataUrl: user.avatarDataUrl || null,
      roleLabel: user.role || null,
      profile: ["MASTER", "ADMIN", "COLLABORATOR", "CLIENT"].includes(
        user.profile,
      )
        ? user.profile
        : "COLLABORATOR",
      status: "ACTIVE",
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  });
}

for (const client of clients) {
  await prisma.client.upsert({
    where: { id: client.id },
    create: {
      id: client.id,
      organizationId,
      name: client.name,
      legalName: client.legalName || null,
      document: client.document || null,
      status: client.status || "ACTIVE",
      segment: client.segment || null,
      website: client.website || null,
      primaryContactName: client.primaryContactName || null,
      primaryContactEmail: client.primaryContactEmail || null,
      primaryContactPhone: client.primaryContactPhone || null,
      owner: client.owner || null,
      notes: client.notes || null,
      createdAt: new Date(client.createdAt || Date.now()),
    },
    update: {
      name: client.name,
      legalName: client.legalName || null,
      document: client.document || null,
      status: client.status || "ACTIVE",
      segment: client.segment || null,
      website: client.website || null,
      primaryContactName: client.primaryContactName || null,
      primaryContactEmail: client.primaryContactEmail || null,
      primaryContactPhone: client.primaryContactPhone || null,
      owner: client.owner || null,
      notes: client.notes || null,
    },
  });
}

const actor = users.find((user) => user.profile === "MASTER") || users[0];
if (!actor)
  throw new Error(
    "Nenhum usuário disponível para registrar a conexão de mídia.",
  );
await prisma.integrationConnection.upsert({
  where: { id: connectionId },
  create: {
    id: connectionId,
    organizationId,
    platform: "META_ADS",
    name: "Meta Ads",
    status: "CONNECTED",
    externalId: "meta-primary",
    createdBy: actor.id,
    updatedBy: actor.id,
    lastSyncAt: syncedAt,
    lastSuccessAt: syncedAt,
  },
  update: {
    status: "CONNECTED",
    updatedBy: actor.id,
    lastSyncAt: syncedAt,
    lastSuccessAt: syncedAt,
  },
});

let accountCount = 0,
  campaignCount = 0,
  snapshotCount = 0;
for (const account of accounts) {
  const assignment = assignments.find(
    (item) => item.platform === "META_ADS" && item.accountId === account.id,
  );
  const dbAccount = await prisma.externalAdAccount.upsert({
    where: {
      connectionId_externalId: { connectionId, externalId: account.id },
    },
    create: {
      organizationId,
      connectionId,
      externalId: account.id,
      name: account.name || account.pageName || account.id,
      businessPortfolioId: account.businessPortfolioId || null,
      businessPortfolioName: account.pageName || null,
      pageName: account.pageName || null,
      profilePictureUrl: account.profilePictureUrl || null,
      currency: account.currency || "BRL",
      timezone: "America/Sao_Paulo",
      status: "ACTIVE",
      clientId: clients.some((item) => item.id === assignment?.clientId)
        ? assignment.clientId
        : null,
      responsibleId: users.some((item) => item.id === assignment?.responsibleId)
        ? assignment.responsibleId
        : null,
      identitySource: assignment?.identitySource || "UNLINKED",
      lastSyncedAt: syncedAt,
      rawPayload: account,
    },
    update: {
      name: account.name || account.pageName || account.id,
      businessPortfolioId: account.businessPortfolioId || null,
      businessPortfolioName: account.pageName || null,
      pageName: account.pageName || null,
      profilePictureUrl: account.profilePictureUrl || null,
      currency: account.currency || "BRL",
      clientId: clients.some((item) => item.id === assignment?.clientId)
        ? assignment.clientId
        : null,
      responsibleId: users.some((item) => item.id === assignment?.responsibleId)
        ? assignment.responsibleId
        : null,
      identitySource: assignment?.identitySource || "UNLINKED",
      lastSyncedAt: syncedAt,
      rawPayload: account,
    },
  });
  accountCount++;
  for (const campaign of campaigns.filter(
    (item) => item.accountId === account.id,
  )) {
    const dbCampaign = await prisma.externalCampaign.upsert({
      where: {
        accountId_externalId: {
          accountId: dbAccount.id,
          externalId: campaign.id,
        },
      },
      create: {
        organizationId,
        accountId: dbAccount.id,
        externalId: campaign.id,
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective || null,
        currency: campaign.currency || account.currency || "BRL",
        dailyBudget: campaign.dailyBudget || 0,
        lifetimeBudget: campaign.lifetimeBudget || 0,
        spend: campaign.spend || 0,
        reach: campaign.reach || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        leads: campaign.leads || 0,
        conversations: campaign.conversations || 0,
        cpl: campaign.cpl,
        frequency: campaign.frequency || 0,
        lastSyncedAt: syncedAt,
        rawPayload: campaign,
      },
      update: {
        name: campaign.name,
        status: campaign.status,
        objective: campaign.objective || null,
        currency: campaign.currency || account.currency || "BRL",
        dailyBudget: campaign.dailyBudget || 0,
        lifetimeBudget: campaign.lifetimeBudget || 0,
        spend: campaign.spend || 0,
        reach: campaign.reach || 0,
        impressions: campaign.impressions || 0,
        clicks: campaign.clicks || 0,
        leads: campaign.leads || 0,
        conversations: campaign.conversations || 0,
        cpl: campaign.cpl,
        frequency: campaign.frequency || 0,
        lastSyncedAt: syncedAt,
        rawPayload: campaign,
      },
    });
    campaignCount++;
    if (since && until) {
      await prisma.campaignMetricSnapshot.upsert({
        where: {
          campaignId_since_until: {
            campaignId: dbCampaign.id,
            since: new Date(`${since}T00:00:00.000Z`),
            until: new Date(`${until}T00:00:00.000Z`),
          },
        },
        create: {
          organizationId,
          campaignId: dbCampaign.id,
          since: new Date(`${since}T00:00:00.000Z`),
          until: new Date(`${until}T00:00:00.000Z`),
          spend: campaign.spend || 0,
          reach: campaign.reach || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          leads: campaign.leads || 0,
          conversations: campaign.conversations || 0,
          cpl: campaign.cpl,
          frequency: campaign.frequency || 0,
          capturedAt: syncedAt,
        },
        update: {
          spend: campaign.spend || 0,
          reach: campaign.reach || 0,
          impressions: campaign.impressions || 0,
          clicks: campaign.clicks || 0,
          leads: campaign.leads || 0,
          conversations: campaign.conversations || 0,
          cpl: campaign.cpl,
          frequency: campaign.frequency || 0,
          capturedAt: syncedAt,
        },
      });
      snapshotCount++;
    }
  }
}

console.log(
  JSON.stringify(
    {
      organizationId,
      users: users.length,
      clients: clients.length,
      accounts: accountCount,
      campaigns: campaignCount,
      snapshots: snapshotCount,
    },
    null,
    2,
  ),
);
await prisma.$disconnect();
