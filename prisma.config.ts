import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// Project convention is .env.local (Next.js), not dotenv's default .env.
loadEnv({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
