import { normalize } from "../lib/catalog";
import { createTranslator } from "@ariaskit/astro-i18n";

const app = document.querySelector<HTMLElement>("#catalog-app");
if (app)
{
    const search = app.querySelector<HTMLInputElement>("#search")!;
    const sort = app.querySelector<HTMLSelectElement>("#sort")!;
    const filters = [
        ...app.querySelectorAll<HTMLSelectElement>("[data-filter]"),
    ];
    const list = app.querySelector<HTMLElement>("#book-list")!;
    const cards = [...list.querySelectorAll<HTMLElement>(".book-card")];
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
    const previous = app.querySelector<HTMLButtonElement>("#previous-page")!;
    const next = app.querySelector<HTMLButtonElement>("#next-page")!;
    const views = [...app.querySelectorAll<HTMLButtonElement>("[data-view]")];
    const allowedSorts = new Set(
        [...sort.options].map((option) => option.value),
    );
    let view = "grid";
    let page = 1;

    function readUrl()
    {
        const params = new URLSearchParams(location.search);
        search.value = params.get("q") || "";
        const sortValue = params.get("sort") || "date-desc";
        sort.value = allowedSorts.has(sortValue) ? sortValue : "date-desc";
        for (const filter of filters)
        {
            const key = filter.dataset.filter!;
            const requestedValue = params.get(key);
            const defaultValue = key === "status" ? "cancelled" : "";
            const value =
                key === "status" && requestedValue === "all"
                    ? ""
                    : requestedValue;
            const selectedValue = value ?? defaultValue;
            filter.value = [...filter.options].some(
                (option) => option.value === selectedValue,
            )
                ? selectedValue
                : defaultValue;
        }
        view = params.get("view") === "list" ? "list" : "grid";
        const size = params.get("perPage") || "12";
        pageSize.value = [...pageSize.options].some(
            (option) => option.value === size,
        )
            ? size
            : "12";
        const requestedPage = params.get("page") || "1";
        const parsedPage = Number(requestedPage);
        page =
            /^[1-9]\d*$/.test(requestedPage) && Number.isSafeInteger(parsedPage)
                ? parsedPage
                : 1;
    }

    function updateUrl(push = false)
    {
        const url = new URL(location.href);
        for (const key of [
            "q",
            "sort",
            "view",
            "page",
            "perPage",
            ...filters.map((filter) => filter.dataset.filter!),
        ])
            url.searchParams.delete(key);
        if (search.value.trim()) url.searchParams.set("q", search.value.trim());
        if (sort.value !== "date-desc")
            url.searchParams.set("sort", sort.value);
        if (view !== "grid") url.searchParams.set("view", view);
        if (pageSize.value !== "12")
            url.searchParams.set("perPage", pageSize.value);
        if (page > 1) url.searchParams.set("page", String(page));
        for (const filter of filters)
        {
            if (filter.value)
                url.searchParams.set(filter.dataset.filter!, filter.value);
            else if (filter.dataset.filter === "status")
                url.searchParams.set("status", "all");
        }
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
        cards.sort((left, right) =>
        {
            const leftValue = left.dataset[field] || "";
            const rightValue = right.dataset[field] || "";
            if (!leftValue || !rightValue)
                return (
                    (!leftValue && !rightValue ? 0 : !leftValue ? 1 : -1) ||
                    collator.compare(left.dataset.id!, right.dataset.id!)
                );
            const comparison =
                field === "gap"
                    ? Number(leftValue) - Number(rightValue)
                    : collator.compare(leftValue, rightValue);
            return (
                comparison * multiplier ||
                collator.compare(left.dataset.id!, right.dataset.id!)
            );
        });
        const matching = cards.filter(
            (card) =>
                (!query ||
                    normalize(card.dataset.search || "").includes(query)) &&
                filters.every(
                    (filter) =>
                        !filter.value ||
                        card.dataset[filter.dataset.filter!] === filter.value,
                ),
        );
        const total = matching.length;
        const size = Number(pageSize.value);
        const pages = Math.max(1, Math.ceil(total / size));
        page = Math.min(page, pages);
        const start = (page - 1) * size;
        const pageCards = new Set(matching.slice(start, start + size));
        for (const card of cards) card.hidden = !pageCards.has(card);
        list.append(...cards);
        list.classList.toggle("list-view", view === "list");
        list.classList.toggle("grid-cols-1", view === "list");
        list.classList.toggle("grid-cols-2", view !== "list");
        list.classList.toggle("min-[901px]:grid-cols-3", view !== "list");
        list.classList.toggle("min-[1201px]:grid-cols-4", view !== "list");
        for (const card of cards)
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
        pagination.hidden = total === 0;
        previous.disabled = page <= 1;
        next.disabled = page >= pages;
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

    readUrl();
    render();
    updateUrl();
    document.querySelector<HTMLElement>("#no-js")!.hidden = true;
    app.querySelector<HTMLElement>(".toolbar")!.hidden = false;
    app.querySelector<HTMLElement>(".filter-panel")!.hidden = false;
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
    previous.addEventListener("click", () =>
    {
        page--;
        render();
        updateUrl(true);
    });
    next.addEventListener("click", () =>
    {
        page++;
        render();
        updateUrl(true);
    });
    for (const button of app.querySelectorAll<HTMLButtonElement>(
        ".reset-button",
    ))
        button.addEventListener("click", () =>
        {
            search.value = "";
            sort.value = "date-desc";
            page = 1;
            for (const filter of filters)
                filter.value =
                    filter.dataset.filter === "status" ? "cancelled" : "";
            render();
            updateUrl(true);
        });
    window.addEventListener("popstate", () =>
    {
        readUrl();
        render();
        updateUrl();
    });
}
