export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { getDb } = await import("./lib/db/client");
  getDb(); // opens the database and applies migrations

  if (process.env.SYNC_ENABLED === "true") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
