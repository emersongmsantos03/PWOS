import {
  firebaseBackendConfig,
  uploadAttachments,
  uploadDataDirectory,
} from "../packages/firebase/src/admin.ts";

const config = firebaseBackendConfig({
  ...process.env,
  FIREBASE_ENABLED: "true",
});

const datasets = await uploadDataDirectory(config);
const attachments = await uploadAttachments(config);

process.stdout.write(
  `${JSON.stringify({
    projectId: config.projectId,
    datasets: datasets.length,
    attachments: attachments.length,
  }, null, 2)}\n`,
);
