import { describe, expect, it } from "vitest";
import {
    catalogUrl,
    filterCatalog,
    parseCatalogState,
    type CatalogRow,
} from "../../src/lib/catalog-query.ts";

const options = {
    format: ["manga", "light-novel"],
    status: ["releasing", "hiatus", "cancelled", "finished"],
    origin: ["JP", "TW"],
    publisher: ["local", "original"],
    language: ["ja", "zh-Hant"],
};

const rows: CatalogRow[] = Array.from({ length: 44 }, (_, index) => ({
    id: `publisher/manga/book-${String(index + 1).padStart(2, "0")}`,
    title: `Book ${index + 1}`,
    search: `Book ${index + 1} Author Publisher`,
    publisher: index < 17 ? "local" : "original",
    format: index < 17 ? "manga" : "light-novel",
    origin: index % 2 ? "TW" : "JP",
    status: index < 5 ? "cancelled" : "releasing",
    language: index % 2 ? "zh-Hant" : "ja",
    date: `2026-01-${String((index % 28) + 1).padStart(2, "0")}`,
    volume: String(index + 1),
    gap: String(index % 7),
}));

describe("catalog query state", () =>
{
    it("filters and paginates server-rendered rows", () =>
    {
        const state = parseCatalogState(
            new URLSearchParams("status=all&page=2&perPage=12&sort=title-asc"),
            options,
        );
        const result = filterCatalog(rows, state, "en");

        expect(result).toMatchObject({
            total: 44,
            page: 2,
            pages: 4,
            perPage: 12,
            start: 12,
        });
        expect(result.rows).toHaveLength(12);
        expect(result.rows[0].title).toBe("Book 13");
        expect(result.rows.at(-1)?.title).toBe("Book 24");
    });

    it("normalizes invalid values and clamps out-of-range pages", () =>
    {
        const state = parseCatalogState(
            new URLSearchParams(
                "status=invalid&format=not-a-format&page=999&perPage=13&sort=invalid",
            ),
            options,
        );
        const result = filterCatalog(rows, state, "en");

        expect(state).toMatchObject({
            sort: "date-desc",
            page: 999,
            perPage: 12,
            filters: {
                format: "",
                status: "cancelled",
            },
        });
        expect(result).toMatchObject({
            total: 5,
            page: 1,
            pages: 1,
            start: 0,
        });
        expect(result.rows).toHaveLength(5);
    });

    it("searches, filters, sorts, and builds stable pagination URLs", () =>
    {
        const state = parseCatalogState(
            new URLSearchParams(
                "q=book%204&status=all&format=manga&sort=title-desc&view=list&perPage=24",
            ),
            options,
        );
        const result = filterCatalog(rows, state, "en");

        expect(result.total).toBe(1);
        expect(result.rows[0].title).toBe("Book 4");
        expect(catalogUrl("/en/", state, 2)).toBe(
            "/en/?q=book+4&sort=title-desc&view=list&page=2&perPage=24&status=all&format=manga",
        );
    });
});
