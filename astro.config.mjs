import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import astroI18n from "@ariaskit/astro-i18n/integration";

export default defineConfig({
    site: "https://axedbooks.rip",
    trailingSlash: "always",
    vite: { plugins: [tailwindcss()] },
    devToolbar: { enabled: false },
    integrations: [astroI18n({ generateTypes: false })],
    redirects: {
        "/[publisher]/[type]/[title]": "/en/[publisher]/[type]/[title]",
    },
    i18n: {
        defaultLocale: "en",
        locales: ["zh-hant", "zh-hans", "en"],
        routing: { prefixDefaultLocale: true },
    },
});
