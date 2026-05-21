import { startWorkers } from "./workers/index.js";

async function main() {
  console.log("🚀 Starting InternHunter Background Workers...");
  await startWorkers();
}

main().catch((err) => {
  console.error("Worker startup failed:", err);
  process.exit(1);
});
