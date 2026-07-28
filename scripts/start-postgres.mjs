import EmbeddedPostgres from "embedded-postgres";

const database = new EmbeddedPostgres({
  databaseDir: "./data/postgres",
  user: "postgres",
  password: "postgres",
  port: 5432,
  persistent: true,
  initdbFlags: ["--locale=C", "--encoding=UTF8"],
  onLog: message => process.stdout.write(`[postgres] ${String(message)}\n`),
  onError: error => process.stderr.write(`[postgres] ${String(error)}\n`)
});

await database.initialise();
await database.start();

try {
  await database.createDatabase("pw_os");
  process.stdout.write("[postgres] Banco pw_os criado.\n");
} catch (error) {
  const message = String(error);
  if (!message.includes("already exists") && !message.includes("42P04")) throw error;
}

process.stdout.write("[postgres] Pronto em postgresql://postgres:postgres@127.0.0.1:5432/pw_os\n");

const stop = async () => {
  await database.stop();
  process.exit(0);
};

process.on("SIGINT", stop);
process.on("SIGTERM", stop);
await new Promise(() => {});
