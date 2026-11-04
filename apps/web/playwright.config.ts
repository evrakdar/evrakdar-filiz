import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const configDir = __dirname;
const rootDir = resolve(configDir, "../..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:3002",
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: `${npmCommand} --workspace @evrakdar/api run start:dev`,
      cwd: rootDir,
      url: "http://127.0.0.1:3001/health",
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: `${npxCommand} next dev -p 3002`,
      cwd: configDir,
      url: "http://127.0.0.1:3002",
      reuseExistingServer: true,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:3001",
        NEXT_PUBLIC_DATA_SOURCE: "api",
        NODE_OPTIONS: "--max-old-space-size=4096"
      }
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
