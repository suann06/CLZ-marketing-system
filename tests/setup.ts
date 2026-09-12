import { config } from "dotenv";

// dataset-service.ts (and other server modules under test) import the
// Prisma client singleton at module load time, which requires DATABASE_URL
// to be set even for tests that never touch the database — so load the same
// .env.local the app itself uses before any test module is imported.
config({ path: ".env.local" });
