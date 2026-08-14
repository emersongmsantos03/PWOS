import { readFileSync } from "node:fs";
import { createDecipheriv } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    }),
);
if (!env.GOOGLE_ADS_DEVELOPER_TOKEN) {
  const encrypted = JSON.parse(
      readFileSync("data/google-developer-token.local.json", "utf8"),
    ),
    decipher = createDecipheriv(
      "aes-256-gcm",
      readFileSync("data/integration.local.key"),
      Buffer.from(encrypted.iv, "base64"),
    );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  env.GOOGLE_ADS_DEVELOPER_TOKEN = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

const tokenResponse = await fetch("https://www.googleapis.com/oauth2/v3/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
  }),
});
const token = await tokenResponse.json();
if (!tokenResponse.ok) throw new Error(token.error_description || token.error);

const headers = (loginCustomerId) => ({
  authorization: `Bearer ${token.access_token}`,
  "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
  "content-type": "application/json",
  ...(loginCustomerId ? { "login-customer-id": loginCustomerId } : {}),
});
const accessibleResponse = await fetch(
  "https://googleads.googleapis.com/v25/customers:listAccessibleCustomers",
  { headers: headers() },
);
const accessible = await accessibleResponse.json();
if (!accessibleResponse.ok) throw new Error(accessible.error?.message);

const customers = new Map();
let hierarchyOk = 0;
let hierarchyFailed = 0;
for (const resourceName of accessible.resourceNames || []) {
  const rootId = resourceName.replace("customers/", "");
  const response = await fetch(
    `https://googleads.googleapis.com/v25/customers/${rootId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: headers(rootId),
      body: JSON.stringify({
        query:
          "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code, customer_client.manager, customer_client.status FROM customer_client WHERE customer_client.status != 'CANCELED'",
      }),
    },
  );
  if (!response.ok) {
    hierarchyFailed += 1;
    continue;
  }
  hierarchyOk += 1;
  for (const page of await response.json()) {
    for (const row of page.results || []) {
      const customer = row.customerClient || {};
      if (customer.id && !customer.manager)
        customers.set(String(customer.id), rootId);
    }
  }
}

let campaignOk = 0;
let campaignFailed = 0;
let campaignRows = 0;
let firstError = null;
const until = new Date().toISOString().slice(0, 10);
const since = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
for (const [customerId, loginCustomerId] of customers) {
  const response = await fetch(
    `https://googleads.googleapis.com/v25/customers/${customerId}/googleAds:searchStream`,
    {
      method: "POST",
      headers: headers(loginCustomerId),
      body: JSON.stringify({
        query: `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign_budget.amount_micros, campaign_budget.period, metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions, metrics.average_cpc FROM campaign WHERE segments.date BETWEEN '${since}' AND '${until}'`,
      }),
    },
  );
  const payload = await response.json();
  if (!response.ok) {
    campaignFailed += 1;
    firstError ??=
      payload.error?.details?.[0]?.errors?.[0]?.message || payload.error?.message;
    continue;
  }
  campaignOk += 1;
  campaignRows += payload.reduce(
    (total, page) => total + (page.results?.length || 0),
    0,
  );
}

console.log(
  JSON.stringify({
    oauth: "ok",
    accessibleCustomers: accessible.resourceNames?.length || 0,
    hierarchyOk,
    hierarchyFailed,
    clientAccounts: customers.size,
    campaignOk,
    campaignFailed,
    campaignRows,
    firstError,
  }),
);
if (hierarchyFailed || campaignFailed) process.exitCode = 1;
