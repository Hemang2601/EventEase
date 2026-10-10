import { app } from "./app";
import { getDb } from "./mongo";
import { seedDatabase } from "./seed";

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    const db = await getDb();
    console.log(`[MongoDB] Initialized database: ${db.databaseName}`);
    await seedDatabase(false);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`=======================================================`);
      console.log(`🚀 EventEase MongoDB API Server running on port ${PORT}`);
      console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`💾 Database: ${db.databaseName} at mongodb://127.0.0.1:27017`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error("[Backend] Failed to start server:", err);
    process.exit(1);
  }
}

startServer();
