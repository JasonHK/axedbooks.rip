import { getRelativeLocaleUrl } from "astro:i18n";
import { createFormatters } from "@ariaskit/astro-i18n";

export const locales = ["zh-hant", "zh-hans", "en"] as const;
export type Locale = (typeof locales)[number];

export function htmlLang(locale: Locale)
{
    return locale === "zh-hant"
        ? "zh-Hant"
        : locale === "zh-hans"
          ? "zh-Hans"
          : "en";
}
export function formatAuthors(authors: readonly string[], locale: Locale)
{
    const formatter = new Intl.ListFormat(htmlLang(locale), {
        type: locale === "en" ? "unit" : "conjunction",
    });
    return formatter
        .formatToParts(authors)
        .map(({ type, value }) =>
            type === "literal" && locale !== "en" ? "、" : value,
        )
        .join("");
}
export function formatLanguage(value: string, locale: Locale)
{
    return (
        new Intl.DisplayNames([htmlLang(locale)], { type: "language" }).of(
            value,
        ) || value
    );
}
export function formatCountry(value: string, locale: Locale)
{
    const style = value === "HK" ? "short" : "long";
    return (
        new Intl.DisplayNames([htmlLang(locale)], { type: "region", style }).of(
            value,
        ) || value
    );
}
export function localePath(locale: Locale, path = "")
{
    return getRelativeLocaleUrl(locale, path);
}
export function formatDate(date: Date, locale: Locale)
{
    return createFormatters(htmlLang(locale)).d(date, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}
export function formatLabel(
    value: string | undefined,
    translate: (key: "manga" | "lightNovel" | "unknown") => string,
)
{
    return translate(
        value === "manga"
            ? "manga"
            : value === "light-novel"
              ? "lightNovel"
              : "unknown",
    );
}
export function gapLabel(
    gap: number | undefined,
    translate: (key: "unavailable" | "caughtUp") => string,
    plural: (key: "behind" | "ahead", count: number) => string,
)
{
    return gap === undefined
        ? translate("unavailable")
        : gap === 0
          ? translate("caughtUp")
          : plural(gap > 0 ? "behind" : "ahead", Math.abs(gap));
}
