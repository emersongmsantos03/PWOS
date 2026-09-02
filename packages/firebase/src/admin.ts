import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { watch } from "chokidar";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

const CHUNK_BYTES = 650_000;

export type FirebaseBackendConfig = {
  enabled: boolean;
  projectId: string;
  storageBucket: string;
  serviceAccountJson?: string;
};

export const firebaseBackendConfig = (
  env: Record<string, string | undefined> = process.env,
): FirebaseBackendConfig => ({
  enabled: env.FIREBASE_ENABLED === "true",
  projectId: env.FIREBASE_PROJECT_ID || "pw-os-9ddce",
  storageBucket:
    env.FIREBASE_STORAGE_BUCKET || "pw-os-9ddce.firebasestorage.app",
  serviceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON,
});

const appFor = (config: FirebaseBackendConfig) => {
  if (getApps().length) return getApps()[0]!;
  const credential = config.serviceAccountJson
    ? cert(JSON.parse(config.serviceAccountJson))
    : applicationDefault();
  return initializeApp({
    credential,
    projectId: config.projectId,
    storageBucket: config.storageBucket,
  });
};

const splitUtf8 = (content: string) => {
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    let end = Math.min(content.length, start + CHUNK_BYTES);
    while (end > start && Buffer.byteLength(content.slice(start, end)) > CHUNK_BYTES)
      end -= 1024;
    if (end === start) throw new Error("Não foi possível dividir o dataset Firebase.");
    chunks.push(content.slice(start, end));
    start = end;
  }
  return chunks.length ? chunks : [""];
};

const commitOperations = async (
  operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>,
  db: FirebaseFirestore.Firestore,
) => {
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = db.batch();
    operations.slice(offset, offset + 400).forEach((operation) => operation(batch));
    await batch.commit();
  }
};

export const uploadDataset = async (
  config: FirebaseBackendConfig,
  filePath: string,
) => {
  const app = appFor(config);
  const db = getFirestore(app);
  const content = await readFile(filePath, "utf8");
  JSON.parse(content);
  const chunks = splitUtf8(content);
  const datasetId = path.basename(filePath);
  const datasetRef = db.collection("pw_os_datasets").doc(datasetId);
  const previous = await datasetRef.collection("chunks").get();
  const operations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
  previous.docs.forEach((doc) => operations.push((batch) => batch.delete(doc.ref)));
  chunks.forEach((payload, index) => {
    const ref = datasetRef.collection("chunks").doc(String(index).padStart(6, "0"));
    operations.push((batch) => batch.set(ref, { index, payload }));
  });
  operations.push((batch) =>
    batch.set(datasetRef, {
      fileName: datasetId,
      bytes: Buffer.byteLength(content),
      chunks: chunks.length,
      sha256: createHash("sha256").update(content).digest("hex"),
      updatedAt: new Date().toISOString(),
    }),
  );
  await commitOperations(operations, db);
};

export const uploadDataDirectory = async (
  config: FirebaseBackendConfig,
  dataDir = "data",
) => {
  const names = (await readdir(dataDir)).filter((name) => name.endsWith(".json")).sort();
  for (const name of names) await uploadDataset(config, path.join(dataDir, name));
  return names;
};

export const hydrateDataDirectory = async (
  config: FirebaseBackendConfig,
  dataDir = "data",
) => {
  if (!config.enabled) return [] as string[];
  const app = appFor(config);
  const datasets = await getFirestore(app).collection("pw_os_datasets").get();
  if (datasets.empty) return [] as string[];
  await mkdir(dataDir, { recursive: true });
  const hydrated: string[] = [];
  for (const dataset of datasets.docs) {
    const chunks = await dataset.ref.collection("chunks").orderBy("index").get();
    const content = chunks.docs.map((doc) => String(doc.get("payload") || "")).join("");
    JSON.parse(content);
    const checksum = createHash("sha256").update(content).digest("hex");
    if (checksum !== dataset.get("sha256"))
      throw new Error(`Checksum inválido no dataset Firebase ${dataset.id}.`);
    await writeFile(path.join(dataDir, dataset.id), content, { mode: 0o600 });
    hydrated.push(dataset.id);
  }
  return hydrated;
};

export const uploadAttachments = async (
  config: FirebaseBackendConfig,
  attachmentDir = "data/task-attachments",
) => {
  const app = appFor(config);
  const bucket = getStorage(app).bucket();
  let names: string[] = [];
  try { names = await readdir(attachmentDir); } catch { return [] as string[]; }
  const uploaded: string[] = [];
  for (const name of names) {
    const localPath = path.join(attachmentDir, name);
    if (!(await stat(localPath)).isFile()) continue;
    await bucket.upload(localPath, { destination: `task-attachments/${name}`, resumable: false });
    uploaded.push(name);
  }
  return uploaded;
};

export const hydrateAttachments = async (
  config: FirebaseBackendConfig,
  attachmentDir = "data/task-attachments",
) => {
  if (!config.enabled) return [] as string[];
  const app = appFor(config);
  const [files] = await getStorage(app).bucket().getFiles({ prefix: "task-attachments/" });
  await mkdir(attachmentDir, { recursive: true });
  const hydrated: string[] = [];
  for (const file of files) {
    const name = path.basename(file.name);
    if (!name) continue;
    await file.download({ destination: path.join(attachmentDir, name) });
    hydrated.push(name);
  }
  return hydrated;
};

export const startFirebaseMirror = (
  config: FirebaseBackendConfig,
  dataDir = "data",
) => {
  if (!config.enabled) return { close: async () => undefined };
  const app = appFor(config);
  const db = getFirestore(app);
  const bucket = getStorage(app).bucket();
  const watcher = watch(
    [path.join(dataDir, "*.json"), path.join(dataDir, "task-attachments", "*")],
    { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 500, pollInterval: 100 } },
  );
  watcher.on("add", (filePath) => {
    if (filePath.endsWith(".json")) void uploadDataset(config, filePath);
    else void bucket.upload(filePath, {
      destination: `task-attachments/${path.basename(filePath)}`,
      resumable: false,
    });
  });
  watcher.on("change", (filePath) => {
    if (filePath.endsWith(".json")) void uploadDataset(config, filePath);
    else void bucket.upload(filePath, {
      destination: `task-attachments/${path.basename(filePath)}`,
      resumable: false,
    });
  });
  watcher.on("unlink", (filePath) => {
    if (filePath.endsWith(".json"))
      void db.recursiveDelete(db.collection("pw_os_datasets").doc(path.basename(filePath)));
    else void bucket.file(`task-attachments/${path.basename(filePath)}`).delete({ ignoreNotFound: true });
  });
  watcher.on("error", (cause) => console.error("[Firebase] Falha no espelhamento:", cause));
  return watcher;
};
