import "@ariaskit/astro-i18n";
import type messages from "../i18n/en.json";
import type { Locale } from "./lib/i18n";

declare module "@ariaskit/astro-i18n"
{
    interface I18nRegistry
    {
        schema: typeof messages;
        locales: Locale;
    }
}
