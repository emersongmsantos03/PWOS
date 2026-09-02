import { existsSync, readFileSync } from "node:fs";

const required = [
  ["users.local.json", "users"],
  ["roles.local.json", "roles"],
  ["departments.local.json", "departments"],
  ["clients.local.json", "clients"],
];

const problems = [];
for (const [file, label] of required) {
  const path = `data/${file}`;
  if (!existsSync(path)) {
    problems.push(`${label}: arquivo ausente (${path})`);
    continue;
  }
  try {
    const value = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(value)) problems.push(`${label}: conteúdo inválido`);
  } catch {
    problems.push(`${label}: JSON inválido`);
  }
}

if (problems.length) {
  const message = [
    "Persistência operacional não está pronta.",
    ...problems.map((problem) => `- ${problem}`),
    "Monte e restaure o Azure File Share em /app/data antes de liberar a revisão.",
  ].join("\n");
  if (process.env.PW_OS_REQUIRE_DATA === "true") {
    console.error(message);
    process.exit(1);
  }
  console.warn(message);
} else {
  console.log("Persistência operacional validada em /app/data.");
}
