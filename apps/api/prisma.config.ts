import { defineConfig } from "prisma/config";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ quiet: true });
config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://evrakdar:evrakdar@localhost:5432/evrakdar";
const shadowDatabaseUrl =
  process.env.SHADOW_DATABASE_URL ?? "postgresql://evrakdar:evrakdar@localhost:5432/evrakdar_shadow";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "node --experimental-strip-types prisma/seed.ts"
  },
  datasource: {
    url: databaseUrl,
    shadowDatabaseUrl
  }
});
