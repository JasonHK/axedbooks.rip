export type BookStatus = "releasing" | "hiatus" | "cancelled" | "finished";

export interface BookData
{
    title: string;
    language: string;
    authors: string[];
    volumes: number | (number | string | null)[];
    lastPublishedDate: Date;
    status?: BookStatus;
    sourcePublisher?: string;
    legacySlug?: string;
    cover?: string;
    sources: string[];
    fictional: boolean;
}

export interface Book
{
    id: string;
    data: BookData;
}

export function bookRouteParams(id: string)
{
    const segments = id.split("/");
    if (
        segments.length !== 3 ||
        segments.some(
            (segment) => !segment || segment === "." || segment === "..",
        )
    )
    {
        throw new Error(
            `Book ID must have publisher/type/title segments: ${id}`,
        );
    }
    const [publisher, type, title] = segments;
    return { type, publisher, title };
}

export function sourceBookId(book: Book): string | undefined
{
    if (!book.data.sourcePublisher) return undefined;
    const { type, title } = bookRouteParams(book.id);
    return `${book.data.sourcePublisher}/${type}/${title}`;
}

export function validateBooks<Entry extends Book>(
    books: Entry[],
    publisherIds?: Set<string>,
): Map<string, Entry>
{
    const byId = new Map<string, Entry>();
    const legacySlugs = new Set<string>();
    for (const book of books)
    {
        bookRouteParams(book.id);
        const publisher = bookRouteParams(book.id).publisher;
        if (publisherIds && !publisherIds.has(publisher))
            throw new Error(
                `Book ${book.id} references an unknown publisher: ${publisher}`,
            );
        if (byId.has(book.id)) throw new Error(`Duplicate book ID: ${book.id}`);
        if (book.data.legacySlug)
        {
            if (legacySlugs.has(book.data.legacySlug))
                throw new Error(
                    `Duplicate legacy slug: ${book.data.legacySlug}`,
                );
            legacySlugs.add(book.data.legacySlug);
        }
        byId.set(book.id, book);
    }
    for (const book of books)
    {
        const sourceId = sourceBookId(book);
        if (!sourceId) continue;
        const source = byId.get(sourceId);
        if (!source || sourceId === book.id || source.data.sourcePublisher)
        {
            throw new Error(
                `Book ${book.id} must reference an existing, different root book: ${sourceId}`,
            );
        }
    }
    return byId;
}

export function catalogBooks<Entry extends Book>(books: Entry[]): Entry[]
{
    const sourceIds = new Set(
        books.map(sourceBookId).filter((id): id is string => !!id),
    );
    return books.filter((book) => !sourceIds.has(book.id));
}

export function bookRouteEntries<Entry extends Book>(
    books: Entry[],
    publisherIds?: Set<string>,
)
{
    const byId = validateBooks(books, publisherIds);
    return catalogBooks(books).flatMap((book) =>
    {
        const params = bookRouteParams(book.id);
        const sourceId = sourceBookId(book);
        const source = sourceId ? byId.get(sourceId) : undefined;
        const entries = [{ params, props: { book, source, isLegacy: false } }];
        const oldId = `${params.type}/${params.publisher}/${params.title}`;
        if (!byId.has(oldId))
        {
            entries.push({
                params: {
                    publisher: params.type,
                    type: params.publisher,
                    title: params.title,
                },
                props: { book, source, isLegacy: true },
            });
        }
        return entries;
    });
}

export function volumeGap(book: Book, source?: Book): number | undefined
{
    if (!source || sourceBookId(book) !== source.id) return undefined;
    const volumeCount = (volumes: BookData["volumes"]) =>
        typeof volumes === "number" ? volumes : volumes.length;
    return volumeCount(source.data.volumes) - volumeCount(book.data.volumes);
}

export function latestVolume(book: Book): number | string
{
    if (typeof book.data.volumes === "number") return book.data.volumes;
    const latest = book.data.volumes.at(-1);
    if (latest === null || latest === undefined)
        throw new Error(`Book ${book.id} must end with a published volume`);
    return latest;
}

function olderThanMonths(published: Date, months: number, now: Date): boolean
{
    const year = published.getUTCFullYear();
    const month = published.getUTCMonth() + months;
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const anniversary = Date.UTC(
        year,
        month,
        Math.min(published.getUTCDate(), lastDay),
    );
    const today = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
    );
    return today > anniversary;
}

export function bookStatus(
    book: Book,
    source?: Book,
    now = new Date(),
): BookStatus
{
    if (book.data.status) return book.data.status;
    if (!book.data.sourcePublisher) return "releasing";

    const gap = volumeGap(book, source);
    if (gap === undefined || !source) return "releasing";
    const sourceStatus = source.data.status ?? "releasing";
    if (gap <= 0)
    {
        return sourceStatus === "finished" || sourceStatus === "cancelled"
            ? "finished"
            : sourceStatus;
    }

    const translationOlderThan = (months: number) =>
        olderThanMonths(book.data.lastPublishedDate, months, now);
    switch (sourceStatus)
    {
        case "cancelled":
            return translationOlderThan(12) ? "cancelled" : "releasing";
        case "finished":
            if (
                (olderThanMonths(source.data.lastPublishedDate, 12, now) &&
                    translationOlderThan(18)) ||
                (gap === 1 && translationOlderThan(24))
            )
                return "cancelled";
            return translationOlderThan(18) ? "hiatus" : "releasing";
        case "hiatus":
            if (translationOlderThan(24)) return "cancelled";
            return translationOlderThan(18) ? "hiatus" : "releasing";
        case "releasing":
            if (gap >= 2 && translationOlderThan(24)) return "cancelled";
            return gap >= 2 && translationOlderThan(12)
                ? "hiatus"
                : "releasing";
    }
}

export function normalize(value: string): string
{
    return value.normalize("NFKC").toLocaleLowerCase().trim();
}
