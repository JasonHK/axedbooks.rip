const form = document.querySelector<HTMLFormElement>("#catalog-form");
const app = document.querySelector<HTMLElement>("#catalog-app");

if (form && app)
{
    const search = form.querySelector<HTMLInputElement>("#search")!;
    const sort = form.querySelector<HTMLSelectElement>("#sort")!;
    const pageSize = form.querySelector<HTMLSelectElement>("#page-size")!;
    const viewState =
        form.querySelector<HTMLInputElement>('input[name="view"]')!;
    const bookList = app.querySelector<HTMLElement>("#book-list")!;
    const views = [...app.querySelectorAll<HTMLButtonElement>("[data-view]")];
    const filters = [
        ...form.querySelectorAll<HTMLSelectElement>("[data-filter]"),
    ];
    let searchTimeout: number | undefined;

    document.querySelector<HTMLElement>("#no-js")!.hidden = true;

    const canonicalize = () =>
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
        if (viewState.value === "list") url.searchParams.set("view", "list");
        const page = Number(app.dataset.page);
        if (page > 1) url.searchParams.set("page", String(page));
        if (pageSize.value !== "12")
            url.searchParams.set("perPage", pageSize.value);
        for (const filter of filters)
        {
            const key = filter.dataset.filter!;
            if (key === "status")
                url.searchParams.set(
                    key,
                    filter.value === "all" ? "all" : filter.value,
                );
            else if (filter.value && filter.value !== "all")
                url.searchParams.set(key, filter.value);
        }
        if (url.href !== location.href) history.replaceState({}, "", url);
    };

    form.addEventListener("submit", (event) =>
    {
        event.preventDefault();
        const url = new URL(form.action, location.href);
        if (search.value.trim()) url.searchParams.set("q", search.value.trim());
        if (sort.value !== "date-desc")
            url.searchParams.set("sort", sort.value);
        if (viewState.value === "list") url.searchParams.set("view", "list");
        if (pageSize.value !== "12")
            url.searchParams.set("perPage", pageSize.value);
        for (const filter of filters)
        {
            const key = filter.dataset.filter!;
            if (key === "status")
                url.searchParams.set(
                    key,
                    filter.value === "all" ? "all" : filter.value,
                );
            else if (filter.value && filter.value !== "all")
                url.searchParams.set(key, filter.value);
        }
        location.assign(url);
    });

    canonicalize();

    const submit = () =>
    {
        if (searchTimeout !== undefined) window.clearTimeout(searchTimeout);
        form.requestSubmit();
    };

    search.addEventListener("input", () =>
    {
        if (searchTimeout !== undefined) window.clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(submit, 350);
    });

    for (const control of form.querySelectorAll<HTMLSelectElement>(
        'select[name="sort"], select[name="perPage"], [data-filter]',
    ))
        control.addEventListener("change", submit);

    for (const button of views)
        button.addEventListener("click", () =>
        {
            const view = button.dataset.view;
            if (view !== "grid" && view !== "list") return;
            viewState.value = view;
            bookList.classList.toggle("list-view", view === "list");
            for (const card of bookList.querySelectorAll<HTMLElement>(
                ".book-card",
            ))
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
            for (const item of views)
            {
                const active = item.dataset.view === view;
                item.classList.toggle("btn-active", active);
                item.setAttribute("aria-pressed", String(active));
            }
            submit();
        });
}
