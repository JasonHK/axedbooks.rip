import { normalize } from "../lib/catalog";
import { createTranslator } from "@ariaskit/astro-i18n";

interface CatalogBook
{
    id: string;
    title: string;
    authors: string[];
    publisherId: string;
    publisherName: string;
    format: string;
    origin: string;
    language: string;
    lastPublishedDate: string;
    volume: number | string;
    gap?: number;
    status: "axed";
    statusEstimated: boolean;
    sourceTitle?: string;
    cover?: string;
    fictional: boolean;
}

const app = document.querySelector<HTMLElement>("#catalog-app");
if (app)
{
    const search = app.querySelector<HTMLInputElement>("#search")!;
    const sort = app.querySelector<HTMLSelectElement>("#sort")!;
    const filters = [
        ...app.querySelectorAll<HTMLSelectElement>("[data-filter]"),
    ];
    const list = app.querySelector<HTMLElement>("#book-list")!;
    const template = app.querySelector<HTMLTemplateElement>(
        "#book-card-template",
    )!;
    const count = app.querySelector<HTMLElement>("#result-count")!;
    const range = app.querySelector<HTMLElement>("#result-range")!;
    const empty = app.querySelector<HTMLElement>("#no-results")!;
    const pagination = app.querySelector<HTMLElement>("#pagination")!;
    const { t: translatePage } = createTranslator<{ pageStatus: string }>({
        locale: app.dataset.locale || "en",
        translations: { pageStatus: pagination.dataset.pageStatus },
    });
    const pageSize = app.querySelector<HTMLSelectElement>("#page-size")!;
    const pageStatus = app.querySelector<HTMLElement>("#page-status")!;
    const previous = app.querySelector<HTMLAnchorElement>("#previous-page")!;
    const next = app.querySelector<HTMLAnchorElement>("#next-page")!;
    const views = [...app.querySelectorAll<HTMLButtonElement>("[data-view]")];
    const allowedSorts = new Set(
        [...sort.options].map((option) => option.value),
    );
    const pageRoot = new URL(app.dataset.pageRoot || "/", location.origin)
        .pathname;
    const numberFormat = new Intl.NumberFormat(app.dataset.locale);
    const dateFormat = new Intl.DateTimeFormat(app.dataset.locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
    const pluralRules = new Intl.PluralRules(app.dataset.locale);
    const behindLabels = JSON.parse(app.dataset.behindLabels || "{}") as Record<
        string,
        string
    >;
    const aheadLabels = JSON.parse(app.dataset.aheadLabels || "{}") as Record<
        string,
        string
    >;
    const coverStyles = [
        "bg-secondary text-secondary-content",
        "bg-primary text-primary-content",
        "bg-neutral text-neutral-content",
    ];
    let view = "grid";
    let page = Number(app.dataset.page) || 1;
    let books: CatalogBook[] = [];

    function formattedVolume(volume: number | string)
    {
        return typeof volume === "number"
            ? (app!.dataset.numberedVolume || "{{volume}}").replace(
                  "{{volume}}",
                  numberFormat.format(volume),
              )
            : volume;
    }

    function formattedGap(gap: number | undefined)
    {
        if (gap === undefined) return app!.dataset.unavailableLabel || "";
        if (gap === 0) return app!.dataset.caughtUpLabel || "";
        const count = Math.abs(gap);
        const labels = gap > 0 ? behindLabels : aheadLabels;
        const label = labels[pluralRules.select(count)] || labels.other || "";
        return label.replace("{{count}}", numberFormat.format(count));
    }

    function formatLabel(format: string)
    {
        if (format === "manga") return app!.dataset.formatManga || format;
        if (format === "light-novel")
            return app!.dataset.formatLightNovel || format;
        return app!.dataset.unknownLabel || format;
    }

    function formatOrigin(origin: string)
    {
        if (origin === "unknown") return app!.dataset.unknownLabel || origin;
        const style = origin === "HK" ? "short" : "long";
        return (
            new Intl.DisplayNames([app!.dataset.locale || "en"], {
                type: "region",
                style,
            }).of(origin) || origin
        );
    }

    function setText(card: HTMLElement, selector: string, value: string)
    {
        const target = card.querySelector<HTMLElement>(selector);
        if (target) target.textContent = value;
    }

    function cardHref(book: CatalogBook)
    {
        return `/${app!.dataset.localeRoute}/${book.id}/`;
    }

    function createCard(book: CatalogBook, index: number)
    {
        const card = template.content.firstElementChild!.cloneNode(
            true,
        ) as HTMLElement;
        const title = book.title;
        const detailHref = cardHref(book);
        const formattedDate = dateFormat.format(
            new Date(book.lastPublishedDate),
        );
        const displayVolume = formattedVolume(book.volume);
        const displayFormat = formatLabel(book.format);
        const origin = formatOrigin(book.origin);
        const authors = new Intl.ListFormat(app!.dataset.locale, {
            type: app!.dataset.locale === "en" ? "unit" : "conjunction",
        })
            .formatToParts(book.authors)
            .map(({ type, value }) =>
                type === "literal" && app!.dataset.locale !== "en"
                    ? "、"
                    : value,
            )
            .join("");

        card.dataset.id = book.id;
        card.dataset.title = title;
        card.dataset.search = [
            title,
            book.publisherName,
            ...book.authors,
            book.sourceTitle || "",
        ].join(" ");
        card.dataset.publisher = book.publisherId;
        card.dataset.format = book.format;
        card.dataset.origin = book.origin;
        card.dataset.status = "axed";
        card.dataset.language = book.language;
        card.dataset.date = book.lastPublishedDate.slice(0, 10);
        card.dataset.volume = String(book.volume);
        card.dataset.gap = book.gap === undefined ? "" : String(book.gap);

        for (const link of card.querySelectorAll<HTMLAnchorElement>(
            "[data-card-cover-link], [data-card-title-link], [data-card-details-link]",
        ))
            link.href = detailHref;
        const coverLink = card.querySelector<HTMLAnchorElement>(
            "[data-card-cover-link]",
        )!;
        coverLink.classList.add(
            ...coverStyles[index % coverStyles.length].split(" "),
        );
        coverLink.setAttribute(
            "aria-label",
            `${app!.dataset.detailsLabel}: ${title}`,
        );
        card.querySelector<HTMLAnchorElement>(
            "[data-card-details-link]",
        )!.setAttribute("aria-label", `${app!.dataset.detailsLabel}: ${title}`);

        const image =
            card.querySelector<HTMLImageElement>("[data-card-image]")!;
        const placeholder = card.querySelector<HTMLElement>(
            "[data-card-placeholder]",
        )!;
        if (book.cover)
        {
            image.src = book.cover;
            image.classList.remove("hidden");
            placeholder.hidden = true;
        }
        else
        {
            placeholder.querySelector<HTMLElement>(
                "[data-card-index]",
            )!.textContent =
                `AXED BOOKS / ${String(index + 1).padStart(2, "0")}`;
            setText(card, "[data-card-cover-title]", title);
            setText(card, "[data-card-cover-format]", displayFormat);
            setText(card, "[data-card-cover-volume]", displayVolume);
        }

        for (const target of card.querySelectorAll<HTMLElement>(
            "[data-card-title]",
        ))
            target.textContent = title;
        setText(card, "[data-card-status]", app!.dataset.axedLabel || "Axed");
        setText(card, "[data-card-format]", displayFormat);
        setText(card, "[data-card-origin]", origin);
        setText(card, "[data-card-fiction]", app!.dataset.fictionLabel || "");
        card.querySelector<HTMLElement>("[data-card-fiction]")!.hidden =
            !book.fictional;
        setText(card, "[data-card-authors]", authors);
        setText(card, "[data-card-publisher]", book.publisherName);
        setText(card, "[data-card-date]", formattedDate);
        setText(card, "[data-card-volume]", displayVolume);
        const gap = card.querySelector<HTMLElement>("[data-card-gap]")!;
        gap.hidden = book.gap === undefined || book.gap === 0;
        gap.textContent = formattedGap(book.gap);
        return card;
    }

    function pageUrl(targetPage: number)
    {
        const url = new URL(location.href);
        const queryKeys = [
            "q",
            "sort",
            "view",
            "page",
            "perPage",
            "status",
            ...filters.map((filter) => filter.dataset.filter!),
        ];
        for (const key of queryKeys) url.searchParams.delete(key);
        if (search.value.trim()) url.searchParams.set("q", search.value.trim());
        if (sort.value !== "date-asc") url.searchParams.set("sort", sort.value);
        if (view !== "grid") url.searchParams.set("view", view);
        if (pageSize.value !== "12")
            url.searchParams.set("perPage", pageSize.value);
        for (const filter of filters)
            if (filter.value)
                url.searchParams.set(filter.dataset.filter!, filter.value);
        url.pathname =
            targetPage === 1 ? pageRoot : `${pageRoot}page/${targetPage}/`;
        return url;
    }

    function readUrl()
    {
        const params = new URLSearchParams(location.search);
        search.value = params.get("q") || "";
        const sortValue = params.get("sort") || "date-asc";
        sort.value = allowedSorts.has(sortValue) ? sortValue : "date-asc";
        for (const filter of filters)
        {
            const key = filter.dataset.filter!;
            const requestedValue = params.get(key);
            const selectedValue = requestedValue || "";
            filter.value = [...filter.options].some(
                (option) => option.value === selectedValue,
            )
                ? selectedValue
                : "";
        }
        view = params.get("view") === "list" ? "list" : "grid";
        const size = params.get("perPage") || "12";
        pageSize.value = [...pageSize.options].some(
            (option) => option.value === size,
        )
            ? size
            : "12";
        const requestedPage = location.pathname.match(/\/page\/([1-9]\d*)\/?$/);
        page = requestedPage ? Number(requestedPage[1]) : 1;
    }

    function updateUrl(push = false)
    {
        const url = pageUrl(page);
        history[push ? "pushState" : "replaceState"]({}, "", url);
    }

    function render()
    {
        const query = normalize(search.value);
        const [field, direction] = sort.value.split("-");
        const multiplier = direction === "asc" ? 1 : -1;
        const collator = new Intl.Collator(app!.dataset.locale, {
            numeric: true,
            sensitivity: "base",
        });
        const sorted = [...books].sort((left, right) =>
        {
            const leftValue = String(left[field as keyof CatalogBook] || "");
            const rightValue = String(right[field as keyof CatalogBook] || "");
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
        const matching = sorted.filter(
            (book) =>
                (!query ||
                    normalize(
                        [
                            book.title,
                            book.publisherName,
                            ...book.authors,
                            book.sourceTitle || "",
                        ].join(" "),
                    ).includes(query)) &&
                filters.every(
                    (filter) =>
                        !filter.value ||
                        (filter.dataset.filter === "publisher"
                            ? book.publisherId
                            : book[
                                  filter.dataset.filter as keyof CatalogBook
                              ]) === filter.value,
                ),
        );
        const total = matching.length;
        const size = Number(pageSize.value);
        const pages = Math.max(1, Math.ceil(total / size));
        page = Math.min(page, pages);
        const start = (page - 1) * size;
        const pageBooks = matching.slice(start, start + size);
        list.replaceChildren(
            ...pageBooks.map((book, index) => createCard(book, start + index)),
        );
        list.classList.toggle("list-view", view === "list");
        list.classList.toggle("grid-cols-1", view === "list");
        list.classList.toggle("grid-cols-2", view !== "list");
        list.classList.toggle("min-[901px]:grid-cols-3", view !== "list");
        list.classList.toggle("min-[1201px]:grid-cols-4", view !== "list");
        for (const card of list.querySelectorAll<HTMLElement>(".book-card"))
        {
            const cover = card.querySelector<HTMLElement>(".book-cover")!;
            const info = card.querySelector<HTMLElement>(".book-info")!;
            card.classList.toggle("flex-row", view === "list");
            card.classList.toggle("gap-4", view === "list");
            cover.classList.toggle("w-full", view !== "list");
            cover.classList.toggle("w-28", view === "list");
            cover.classList.toggle("sm:w-36", view === "list");
            cover.classList.toggle("shrink-0", view === "list");
            info.classList.toggle("mt-3", view !== "list");
        }
        count.textContent = String(total);
        range.textContent = total
            ? `${String(start + 1).padStart(2, "0")}—${String(Math.min(start + size, total)).padStart(2, "0")}`
            : "00—00";
        empty.hidden = total > 0;
        pagination.hidden = total === 0 || pages <= 1;
        for (const [link, targetPage, disabled] of [
            [previous, Math.max(1, page - 1), page <= 1],
            [next, Math.min(pages, page + 1), page >= pages],
        ] as const)
        {
            const url = pageUrl(targetPage);
            link.href = `${url.pathname}${url.search}`;
            link.dataset.page = String(targetPage);
            link.setAttribute("aria-disabled", String(disabled));
            link.tabIndex = disabled ? -1 : 0;
            link.classList.toggle("btn-disabled", disabled);
        }
        pageStatus.textContent = translatePage("pageStatus", {
            page,
            total: pages,
        });
        for (const button of views)
        {
            const active = button.dataset.view === view;
            button.classList.toggle("btn-active", active);
            button.setAttribute("aria-pressed", String(active));
        }
    }

    async function initialize()
    {
        const response = await fetch(
            app!.dataset.catalogUrl || "/catalog.json",
        );
        if (!response.ok)
            throw new Error(`Catalog request failed: ${response.status}`);
        const catalog = (await response.json()) as CatalogBook[];
        if (!Array.isArray(catalog))
            throw new Error("Catalog index must be an array");
        books = catalog;
        readUrl();
        render();
        updateUrl();
        document.querySelector<HTMLElement>("#no-js")!.hidden = true;
        app!.querySelector<HTMLElement>(".toolbar")!.hidden = false;
        app!.querySelector<HTMLElement>(".filter-panel")!.hidden = false;
        app!.querySelector<HTMLElement>(".page-size-control")!.hidden = false;
    }

    search.addEventListener("input", () =>
    {
        page = 1;
        render();
        updateUrl();
    });
    for (const control of [sort, pageSize, ...filters])
        control.addEventListener("change", () =>
        {
            page = 1;
            render();
            updateUrl(true);
        });
    for (const button of views)
        button.addEventListener("click", () =>
        {
            view = button.dataset.view!;
            render();
            updateUrl(true);
        });
    pagination.addEventListener("click", (event) =>
    {
        const link = (event.target as Element).closest<HTMLAnchorElement>(
            "a[data-page-link]",
        );
        if (!link || link.getAttribute("aria-disabled") === "true") return;
        event.preventDefault();
        page = Number(link.dataset.page) || 1;
        render();
        updateUrl(true);
    });
    for (const button of app.querySelectorAll<HTMLButtonElement>(
        ".reset-button",
    ))
        button.addEventListener("click", () =>
        {
            search.value = "";
            sort.value = "date-asc";
            page = 1;
            for (const filter of filters) filter.value = "";
            render();
            updateUrl(true);
        });
    window.addEventListener("popstate", () =>
    {
        readUrl();
        render();
        updateUrl();
    });

    void initialize().catch((error: unknown) =>
    {
        console.error("Unable to load the catalog index", error);
        document.querySelector<HTMLElement>("#catalog-load-error")!.hidden =
            false;
    });
}
