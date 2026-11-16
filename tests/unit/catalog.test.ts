import { describe, expect, it } from "vitest";
import {
    bookRouteEntries,
    bookRouteParams,
    bookStatus,
    catalogBooks,
    catalogIndexBooks,
    catalogPageNumbers,
    latestVolume,
    normalize,
    validateBooks,
    volumeGap,
    type Book,
} from "../../src/lib/catalog.ts";

const root: Book = {
    id: "original-publisher/manga/translation",
    data: {
        title: "Original",
        language: "ja",
        authors: ["A"],
        volumes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        lastPublishedDate: new Date("2024-01-01T00:00:00Z"),
        sources: [],
        fictional: true,
    },
};
const translation: Book = {
    id: "local-publisher/manga/translation",
    data: {
        ...root.data,
        sourcePublisher: "original-publisher",
        volumes: [1, 2, 3, 4],
    },
};

describe("book route parameters", () =>
{
    it("maps nested book IDs to route segments", () =>
    {
        expect(bookRouteParams("daylight/light-novel/lantern")).toStrictEqual({
            publisher: "daylight",
            type: "light-novel",
            title: "lantern",
        });
        for (const id of [
            "lantern",
            "publisher//title",
            "publisher/manga/title/extra",
            "publisher/../title",
        ])
        {
            expect(() => bookRouteParams(id)).toThrow(/publisher\/type\/title/);
        }
    });
});

it("validates source publishers and implicit root editions", () =>
{
    expect(validateBooks([root, translation]).get(root.id)).toBe(root);
    expect(() => validateBooks([translation])).toThrow(/existing/);
    expect(() =>
        validateBooks([
            { ...root, id: "original-publisher/manga/other-title" },
            translation,
        ]),
    ).toThrow(/existing/);
    expect(() =>
        validateBooks([
            { ...root, id: "original-publisher/light-novel/translation" },
            translation,
        ]),
    ).toThrow(/existing/);
    expect(() => validateBooks([root, root])).toThrow(/Duplicate/);
    expect(() =>
        validateBooks([
            {
                ...translation,
                data: {
                    ...translation.data,
                    sourcePublisher: "local-publisher",
                },
            },
        ]),
    ).toThrow(/existing/);
    expect(() => validateBooks([{ ...root, id: "original" }])).toThrow(
        /publisher\/type\/title/,
    );
    expect(() =>
        validateBooks([
            { ...root, data: { ...root.data, legacySlug: "old" } },
            {
                ...translation,
                data: { ...translation.data, legacySlug: "old" },
            },
        ]),
    ).toThrow(/Duplicate legacy slug/);
    expect(
        validateBooks([
            root,
            translation,
            { ...translation, id: "another-publisher/manga/translation" },
        ]).size,
    ).toBe(3);
    expect(() =>
        validateBooks([root, translation], new Set(["local-publisher"])),
    ).toThrow(/unknown publisher/);
    const chainedSource = {
        ...translation,
        id: "another-publisher/manga/translation",
        data: { ...translation.data, sourcePublisher: "local-publisher" },
    };
    expect(() => validateBooks([root, translation, chainedSource])).toThrow(
        /root book/,
    );
});

it("generates type-first aliases without overriding canonical book IDs", () =>
{
    const entries = bookRouteEntries([root, translation]);
    expect(
        entries.map(({ params, props }) => ({
            ...params,
            isLegacy: props.isLegacy,
        })),
    ).toStrictEqual([
        {
            publisher: "local-publisher",
            type: "manga",
            title: "translation",
            isLegacy: false,
        },
        {
            publisher: "manga",
            type: "local-publisher",
            title: "translation",
            isLegacy: true,
        },
    ]);
    const collision = {
        ...translation,
        id: "manga/local-publisher/translation",
        data: { ...translation.data, sourcePublisher: undefined },
    };
    const collisionEntries = bookRouteEntries([root, translation, collision]);
    expect(collisionEntries.length).toBe(2);
    expect(collisionEntries.every(({ props }) => !props.isLegacy)).toBe(true);
});

it("keeps independent root books in the catalog but hides referenced sources", () =>
{
    const standalone = {
        ...root,
        id: "independent-publisher/manga/standalone",
    };
    expect(catalogBooks([root, translation, standalone])).toStrictEqual([
        translation,
        standalone,
    ]);
});

it("creates an axed-only, oldest-first catalog index", () =>
{
    const publishers = [
        { id: "original-publisher", data: { name: "Original", origin: "JP" } },
        { id: "local-publisher", data: { name: "Local", origin: "TW" } },
        {
            id: "independent-publisher",
            data: { name: "Independent", origin: "US" },
        },
    ];
    const axedSource = {
        ...root,
        data: { ...root.data, status: "axed" as const },
    };
    const oldTranslation = {
        ...translation,
        data: {
            ...translation.data,
            lastPublishedDate: new Date("2020-01-01T00:00:00Z"),
        },
    };
    const ongoingBook = {
        ...root,
        id: "independent-publisher/manga/ongoing",
    };

    const index = catalogIndexBooks(
        [axedSource, oldTranslation, ongoingBook],
        publishers,
    );
    expect(index).toMatchObject([
        {
            id: oldTranslation.id,
            publisherName: "Local",
            origin: "TW",
            format: "manga",
            status: "axed",
            statusEstimated: true,
            gap: 6,
            sourceTitle: "Original",
        },
    ]);
    expect(index.map((book) => book.id)).not.toContain(axedSource.id);
    expect(index.map((book) => book.id)).not.toContain(ongoingBook.id);
});

it("generates only numbered routes after the first page", () =>
{
    expect(catalogPageNumbers(0)).toStrictEqual([]);
    expect(catalogPageNumbers(12)).toStrictEqual([]);
    expect(catalogPageNumbers(13)).toStrictEqual([2]);
    expect(catalogPageNumbers(37)).toStrictEqual([2, 3, 4]);
});

it("compares linked volume counts automatically", () =>
{
    expect(volumeGap(translation, root)).toBe(6);
    expect(
        volumeGap(
            { ...translation, data: { ...translation.data, volumes: 4 } },
            { ...root, data: { ...root.data, volumes: 10 } },
        ),
    ).toBe(6);
    expect(
        volumeGap(
            {
                ...translation,
                data: { ...translation.data, volumes: [1, 2, null, 4] },
            },
            root,
        ),
    ).toBe(6);
    expect(volumeGap(translation)).toBeUndefined();
});

it("uses integer volume counts as the latest numbered volume", () =>
{
    expect(latestVolume({ ...root, data: { ...root.data, volumes: 9 } })).toBe(
        9,
    );
});

it("derives edition status from linked sources and calendar-month thresholds", () =>
{
    const now = new Date("2026-11-14T12:00:00Z");
    const edition = (date: string, volume = 4) => ({
        ...translation,
        data: {
            ...translation.data,
            lastPublishedDate: new Date(`${date}T00:00:00Z`),
            volumes: Array.from({ length: volume }, (_, index) => index + 1),
        },
    });
    const original = (
        status: NonNullable<Book["data"]["status"]>,
        date = "2025-11-13",
    ) => ({
        ...root,
        data: {
            ...root.data,
            status,
            lastPublishedDate: new Date(`${date}T00:00:00Z`),
        },
    });
    expect(bookStatus(root, undefined, now)).toBe("ongoing");
    expect(
        bookStatus(
            { ...root, data: { ...root.data, status: "ongoing" } },
            undefined,
            now,
        ),
    ).toBe("ongoing");
    expect(
        bookStatus(
            { ...root, data: { ...root.data, status: "axed" } },
            undefined,
            now,
        ),
    ).toBe("axed");
    expect(
        bookStatus({ ...root, data: { ...root.data, status: "finished" } }),
    ).toBe("finished");
    expect(
        bookStatus(
            { ...translation, data: { ...translation.data, status: "hiatus" } },
            root,
            now,
        ),
    ).toBe("hiatus");
    expect(bookStatus(translation, undefined, now)).toBe("ongoing");
    expect(bookStatus(edition("2020-01-01", 10), original("axed"), now)).toBe(
        "finished",
    );
    expect(bookStatus(edition("2020-01-01", 11), original("hiatus"), now)).toBe(
        "hiatus",
    );
    expect(bookStatus(edition("2025-11-14"), original("axed"), now)).toBe(
        "ongoing",
    );
    expect(bookStatus(edition("2025-11-13"), original("axed"), now)).toBe(
        "axed",
    );
    expect(bookStatus(edition("2025-05-14"), original("finished"), now)).toBe(
        "ongoing",
    );
    expect(bookStatus(edition("2025-05-13"), original("finished"), now)).toBe(
        "axed",
    );
    expect(
        bookStatus(
            edition("2025-05-13"),
            original("finished", "2025-11-14"),
            now,
        ),
    ).toBe("hiatus");
    expect(
        bookStatus(
            edition("2024-11-13", 9),
            original("finished", "2026-11-01"),
            now,
        ),
    ).toBe("axed");
    expect(bookStatus(edition("2025-05-14"), original("hiatus"), now)).toBe(
        "ongoing",
    );
    expect(bookStatus(edition("2025-05-13"), original("hiatus"), now)).toBe(
        "hiatus",
    );
    expect(bookStatus(edition("2024-11-14"), original("hiatus"), now)).toBe(
        "hiatus",
    );
    expect(bookStatus(edition("2024-11-13"), original("hiatus"), now)).toBe(
        "axed",
    );
    expect(bookStatus(edition("2025-11-14"), original("ongoing"), now)).toBe(
        "ongoing",
    );
    expect(bookStatus(edition("2025-11-13"), original("ongoing"), now)).toBe(
        "hiatus",
    );
    expect(bookStatus(edition("2024-11-14"), original("ongoing"), now)).toBe(
        "hiatus",
    );
    expect(bookStatus(edition("2024-11-13"), original("ongoing"), now)).toBe(
        "axed",
    );
    expect(bookStatus(edition("2020-01-01", 9), original("ongoing"), now)).toBe(
        "ongoing",
    );
    expect(
        bookStatus(
            edition("2024-02-29"),
            original("hiatus"),
            new Date("2026-02-28T12:00:00Z"),
        ),
    ).toBe("hiatus");
    expect(
        bookStatus(
            edition("2024-02-29"),
            original("hiatus"),
            new Date("2026-03-01T00:00:00Z"),
        ),
    ).toBe("axed");
});

it("normalizes full-width and case variants", () =>
{
    expect(normalize(" ＡＢＣ ")).toBe("abc");
});
