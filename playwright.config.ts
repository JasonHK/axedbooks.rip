import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    testMatch: "**/*.spec.ts",
    use: { baseURL: "http://localhost:4321", browserName: "chromium" },
    webServer: {
        command:
            "pnpm --pm-on-fail=ignore exec astro dev --ignore-lock --host localhost --port 4321",
        url: "http://localhost:4321",
        reuseExistingServer: true,
        timeout: 30000,
    },
});
