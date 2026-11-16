import { normalize, type BookStatus } from "./catalog";

export const catalogSorts = [
    "date-desc",
    "date-asc",
    "title-asc",
    "title-desc",
    "volume-desc",
    "volume-asc",
    "gap-desc",
    "gap-asc",
] as const;

export const catalogPageSizes = [12, 24, 36] as const;

export interface CatalogState
{
    q: string;
    sort: (typeof catalogSorts)[number];
    view: "grid" | "list";
    page: number;
    perPage: (typeof catalogPageSizes)[number];
    filters: {
        format: string;
        status: BookStatus | "";
        origin: string;
        publisher: string;
        language: string;
    };
}

export interface CatalogRow
{
    id: string;
    title: string;
    search: string;
    publisher: string;
    format: string;
    origin: string;
    status: BookStatus;
    language: string;
    date: string;
    volume: string;
    gap: string;
}

export interface CatalogResult<Row extends CatalogRow>
{
    rows: Row[];
    total: number;
    page: number;
    pages: number;
    perPage: number;
    start: number;
}

type CatalogFilterOptions = Record<
    keyof CatalogState["filters"],
    readonly string[]
>;

export function parseCatalogState(
    params: URLSearchParams,
    options: CatalogFilterOptions,
): CatalogState
{
    const requestedSort = params.get("sort") || "date-desc";
    const requestedPageSize = Number(params.get("perPage") || "12");
    const requestedPage = params.get("page") || "1";
    const filterValue = (
        key: Exclude<keyof CatalogState["filters"], "status">,
    ) =>
    {
        const value = params.get(key) || "";
        return options[key].includes(value) ? value : "";
    };
    const requestedStatus = params.get("status") || "cancelled";
    const filters: CatalogState["filters"] = {
        format: filterValue("format"),
        status:
            requestedStatus === "all"
                ? ""
                : options.status.includes(requestedStatus)
                  ? (requestedStatus as BookStatus)
                  : "cancelled",
        origin: filterValue("origin"),
        publisher: filterValue("publisher"),
        language: filterValue("language"),
    };

    return {
        q: params.get("q") || "",
        sort: catalogSorts.includes(
            requestedSort as (typeof catalogSorts)[number],
        )
            ? (requestedSort as (typeof catalogSorts)[number])
            : "date-desc",
        view: params.get("view") === "list" ? "list" : "grid",
        page:
            /^[1-9]\d*$/.test(requestedPage) &&
            Number.isSafeInteger(Number(requestedPage))
                ? Number(requestedPage)
                : 1,
        perPage: catalogPageSizes.includes(
            requestedPageSize as (typeof catalogPageSizes)[number],
        )
            ? (requestedPageSize as (typeof catalogPageSizes)[number])
            : 12,
        filters,
    };
}

export function filterCatalog<Row extends CatalogRow>(
    rows: Row[],
    state: CatalogState,
    locale: string,
): CatalogResult<Row>
{
    const query = normalize(state.q);
    const [field, direction] = state.sort.split("-");
    const multiplier = direction === "asc" ? 1 : -1;
    const collator = new Intl.Collator(locale, {
        numeric: true,
        sensitivity: "base",
    });
    const matching = rows
        .filter(
            (row) =>
                (!query || normalize(row.search).includes(query)) &&
                Object.entries(state.filters).every(
                    ([key, value]) =>
                        !value || row[key as keyof CatalogRow] === value,
                ),
        )
        .sort((left, right) =>
        {
            const leftValue = left[field as keyof CatalogRow] || "";
            const rightValue = right[field as keyof CatalogRow] || "";
            if (!leftValue || !rightValue)
                return (
                    (!leftValue && !rightValue ? 0 : !leftValue ? 1 : -1) ||
                    collator.compare(left.id, right.id)
                );
            const comparison =
                field === "gap"
                    ? Number(leftValue) - Number(rightValue)
                    : collator.compare(leftValue, rightValue);
            return (
                comparison * multiplier || collator.compare(left.id, right.id)
            );
        });
    const total = matching.length;
    const pages = Math.max(1, Math.ceil(total / state.perPage));
    const page = Math.min(state.page, pages);
    const start = (page - 1) * state.perPage;

    return {
        rows: matching.slice(start, start + state.perPage),
        total,
        page,
        pages,
        perPage: state.perPage,
        start,
    };
}

export function catalogUrl(
    path: string,
    state: CatalogState,
    page: number,
): string
{
    const params = new URLSearchParams();
    if (state.q.trim()) params.set("q", state.q.trim());
    if (state.sort !== "date-desc") params.set("sort", state.sort);
    if (state.view !== "grid") params.set("view", state.view);
    if (page > 1) params.set("page", String(page));
    if (state.perPage !== 12) params.set("perPage", String(state.perPage));
    if (state.filters.status) params.set("status", state.filters.status);
    else params.set("status", "all");
    for (const key of ["format", "origin", "publisher", "language"] as const)
        if (state.filters[key]) params.set(key, state.filters[key]);
    const query = params.toString();
    return query ? `${path}?${query}` : path;
}
