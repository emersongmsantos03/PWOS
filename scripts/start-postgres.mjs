import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, unlinkSync } from "node:fs";

const database = new EmbeddedPostgres({
  databaseDir: "./data/postgres",
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  onLog: (message) => process.stdout.write(`[postgres] ${String(message)}\n`),
  onError: (error) => process.stderr.write(`[postgres] ${String(error)}\n`),
});

if (!existsSync("./data/postgres/PG_VERSION")) await database.initialise();
const pidPath = "./data/postgres/postmaster.pid";
if (existsSync(pidPath)) {
  const pid = Number(readFileSync(pidPath, "utf8").split("\n")[0]);
  try {
    process.kill(pid, 0);
  } catch {
    unlinkSync(pidPath);
  }
}
await database.start();

try {
  await database.createDatabase("pw_os");
  process.stdout.write("[postgres] Banco pw_os criado.\n");
} catch (error) {
  const message = String(error);
  if (!message.includes("already exists") && !message.includes("42P04"))
    throw error;
}

process.stdout.write(
  "[postgres] Pronto em postgresql://postgres:postgres@127.0.0.1:5432/pw_os\n",
);

const stop = async () => {
  await database.stop();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
