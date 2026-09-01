import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const source = "data", stamp = new Date().toISOString().replace(/[:.]/g, "-"), destination = join("backups", `pw-os-data-${stamp}`);
if (!existsSync(source)) throw new Error("Diretório data/ não encontrado; nada foi alterado.");
mkdirSync(destination, { recursive: true });
const skip = new Set(["postmaster.pid", "postmaster.opts"]);
cpSync(source, join(destination, "data"), { recursive: true, filter: path => {
  const sourceRelative = relative(source, path);
  return sourceRelative !== "postgres" && !sourceRelative.startsWith(`postgres/`) && !skip.has(path.split("/").at(-1) || "");
} });
const files = [];
const walk = directory => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name), info = statSync(path);
    if (info.isDirectory()) walk(path);
    else files.push({ path: relative(destination, path), bytes: info.size, sha256: createHash("sha256").update(readFileSync(path)).digest("hex") });
  }
};
walk(join(destination, "data"));
writeFileSync(join(destination, "manifest.json"), JSON.stringify({ createdAt: new Date().toISOString(), source, files }, null, 2));
console.log(`Backup criado em ${destination} (${files.length} arquivos).`);
