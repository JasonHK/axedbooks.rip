import { test, expect } from "@playwright/test";

const bookPath = "ching-win/light-novel/her-royal-highness-seems-to-be-angry";
const mangaPath = "jade-dynasty/manga/ruri-dragon";
const bookTitle = "公主殿下貌似大發雷霆";
const bookCover =
    "/covers/ching-win/light-novel/her-royal-highness-seems-to-be-angry.jpg";

test("search, filters, sorting, views and URL state work together", async ({
    page,
}) =>
{
    await page.goto("/en/");
    const statusFilter = page.getByLabel("Publication status");
    await expect(statusFilter).toHaveValue("cancelled");
    await expect(page.locator(".book-card:visible")).not.toHaveCount(0);
    await expect(page).toHaveURL(/status=cancelled/);
    expect(
        await page
            .locator(".book-card:visible")
            .evaluateAll((cards) =>
                cards.every(
                    (card) =>
                        card.getAttribute("data-status") === "cancelled" &&
                        card
                            .querySelector(".status-badge")
                            ?.textContent?.trim() === "Axed",
                ),
            ),
    ).toBe(true);
    await page.getByLabel("Search books").fill("公主");
    await expect(page.locator(".book-card:visible")).toHaveCount(1);
    await expect(page.locator(".book-card:visible")).toContainText(bookTitle);
    await expect(page).toHaveURL(/q=/);
    await page.getByLabel("Search books").fill("nothing matches");
    await expect(page.getByText("No books found")).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(statusFilter).toHaveValue("cancelled");
    await statusFilter.selectOption("all");
    await page.getByLabel("Format").selectOption("manga");
    await expect(page.locator(".book-card:visible")).toHaveCount(2);
    await page.getByLabel("Sort").selectOption("volume-desc");
    await expect(page.locator(".book-card:visible").first()).toHaveAttribute(
        "data-volume",
        "5",
    );
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page.locator("#book-list")).toHaveClass(/list-view/);
    await expect(page).toHaveURL(/view=list/);
    await page.reload();
    await expect(page.locator(".book-card:visible")).toHaveCount(2);
    await expect(
        page.getByRole("button", { name: "List view" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(
        page.getByRole("button", { name: "Grid view" }),
    ).toHaveAttribute("aria-pressed", "true");
});

test("server-rendered search, filters, sorting, and page size work without JavaScript", async ({
    browser,
}) =>
{
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en/?status=all");
    const cards = page.locator(".book-card:visible");
    const size = page.getByLabel("Books per page");
    const apply = page.getByRole("button", { name: "Apply filters" });

    await expect(page.locator("#page-status")).toHaveText("Page 1 of 1");
    await expect(page.locator("#result-range")).toHaveText("01—04");
    await expect(cards).toHaveCount(4);
    await size.selectOption("24");
    await apply.click();
    await expect(page).toHaveURL(/perPage=24/);
    await expect(cards).toHaveCount(4);

    await page.getByLabel("Search books").fill("公主");
    await apply.click();
    await expect(page).toHaveURL(/q=/);
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText(bookTitle);

    await page.getByLabel("Search books").fill("no results");
    await page.getByLabel("Format").selectOption("manga");
    await apply.click();
    await expect(page.getByText("No books found")).toBeVisible();
    await expect(page.locator("#pagination")).toBeHidden();
    await context.close();
});

test("locale switching preserves state and detail pages show original comparison", async ({
    page,
}) =>
{
    await page.goto("/en/?q=princess&perPage=24");
    await page.locator("#language-menu summary").click();
    await page.getByRole("link", { name: "简体中文" }).click();
    await expect(page).toHaveURL(/\/zh-hans\/\?.*q=princess.*perPage=24/);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hans");
    await page.goto(`/en/${bookPath}/`);
    await expect(page.getByText("Original edition")).toBeVisible();
    await expect(page.locator("dd").filter({ hasText: "Volume 6" })).toHaveText(
        "Volume 6",
    );
    await expect(page.locator("dd").filter({ hasText: "Volume 9" })).toHaveText(
        "Volume 9",
    );
    await expect(page.getByText("王女殿下はお怒りのようです")).toBeVisible();
    await expect(page.getByText("Behind by 3 volumes")).toBeVisible();
    await expect(page.getByText("Estimated publication status")).toBeVisible();
    await expect(page.getByText("Axed", { exact: true })).toBeVisible();
    await page.locator("#language-menu summary").click();
    await page.getByRole("link", { name: "繁體中文" }).click();
    await expect(page).toHaveURL(new RegExp(`/zh-hant/${bookPath}/`));
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
    await expect(page.locator("dd").filter({ hasText: "第 6 集" })).toHaveText(
        "第 6 集",
    );
});

test("book language tags render as language names", async ({ page }) =>
{
    await page.goto(
        "/en/ching-win/light-novel/her-royal-highness-seems-to-be-angry/",
    );
    await expect(
        page.locator("dd").filter({ hasText: "Traditional Chinese" }),
    ).toHaveText("Traditional Chinese");
    await page.goto("/en/");
    await expect(
        page.locator('#filter-language option[value="zh-Hant"]'),
    ).toHaveText("Traditional Chinese");
});

test("all locales have prefixed catalog and book routes", async ({ page }) =>
{
    await page.goto("/");
    await expect(page).toHaveURL(/\/en\/\?status=cancelled$/);
    for (const [locale, language, title, pageStatus, original, gap] of [
        [
            "en",
            "en",
            "Stories left on the shelf",
            "Page 1 of 1",
            "Original edition",
            "Behind by 3 volumes",
        ],
        [
            "zh-hant",
            "zh-Hant",
            "那些還沒說完的故事",
            "第 1 頁，共 1 頁",
            "原作版本",
            "落後 3 集",
        ],
        [
            "zh-hans",
            "zh-Hans",
            "那些还没说完的故事",
            "第 1 页，共 1 页",
            "原作版本",
            "落后 3 集",
        ],
    ])
    {
        await page.goto(`/${locale}/`);
        await expect(page.locator("html")).toHaveAttribute("lang", language);
        await expect(page.locator("main h1")).toHaveText(title);
        await expect(page.locator("#page-status")).toHaveText(pageStatus);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            "href",
            `https://axedbooks.rip/${locale}/`,
        );
        const bookCard = page.locator(`[data-id="${bookPath}"]`);
        await expect(bookCard).toContainText(
            locale === "en" ? "Volume 6" : "第 6 集",
        );
        await page.locator(`[data-id="${bookPath}"] h3 a`).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/${bookPath}/`));
        await expect(page.locator("main h1")).toHaveText(bookTitle);
        await expect(page.getByText(original, { exact: true })).toBeVisible();
        await expect(page.getByText(gap, { exact: true })).toBeVisible();
    }
});

test("type-first and unprefixed book URLs redirect to canonical editions", async ({
    page,
}) =>
{
    for (const path of [bookPath, mangaPath])
    {
        await page.goto(`/${path}/`);
        await expect(page).toHaveURL(new RegExp(`/en/${path}/$`));
        await expect(page.locator("html")).toHaveAttribute("lang", "en");
        await expect(page.locator("main h1")).toBeVisible();
    }
    for (const locale of ["en", "zh-hant", "zh-hans"])
    {
        await page.goto(
            `/${locale}/light-novel/ching-win/her-royal-highness-seems-to-be-angry/`,
        );
        await expect(page).toHaveURL(new RegExp(`/${locale}/${bookPath}/$`));
    }
    await page.goto(
        "/light-novel/ching-win/her-royal-highness-seems-to-be-angry/",
    );
    await expect(page).toHaveURL(new RegExp(`/en/${bookPath}/$`));
});

test("catalog remains visible without JavaScript", async ({ browser }) =>
{
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en/");
    await expect(page.locator(".book-card:visible")).toHaveCount(1);
    await expect(
        page.getByText(
            "Search, filter, and paginate the catalog without JavaScript.",
        ),
    ).toBeVisible();
    await expect(page.locator(".toolbar")).toBeVisible();
    await page.getByLabel("Search books").fill("公主");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.locator(".book-card:visible")).toHaveCount(1);
    await page.locator("#language-menu summary").click();
    await page.getByRole("link", { name: "繁體中文" }).click();
    await expect(page).toHaveURL(/\/zh-hant\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
    await context.close();
});

test("switcher dropdowns support keyboard and dismissal", async ({ page }) =>
{
    await page.goto("/en/");
    const languageMenu = page.locator("#language-menu");
    const languageTrigger = languageMenu.locator("summary");
    const themeMenu = page.locator("#theme-menu");
    await languageTrigger.focus();
    await page.keyboard.press("Enter");
    await expect(languageMenu).toHaveAttribute("open", "");
    await expect(
        page.getByRole("link", { name: "English", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(
        page.getByRole("link", { name: "English", exact: true }),
    ).toHaveClass(/\bmenu-active\b/);
    await page.keyboard.press("Escape");
    await expect(languageMenu).not.toHaveAttribute("open", "");
    await expect(languageTrigger).toBeFocused();
    await languageTrigger.click();
    await themeMenu.locator("summary").click();
    await expect(languageMenu).not.toHaveAttribute("open", "");
    await expect(themeMenu).toHaveAttribute("open", "");
    await page.locator("main h1").click();
    await expect(themeMenu).not.toHaveAttribute("open", "");
    await languageTrigger.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "繁體中文" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/zh-hant\/\?status=cancelled$/);
});

test("switcher dropdowns fit a narrow screen", async ({ page }) =>
{
    await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en/");
    for (const id of ["language-menu", "theme-menu"])
    {
        const menu = page.locator(`#${id}`);
        await menu.locator("summary").click();
        const content = menu.locator(".dropdown-content");
        await expect(content).toBeVisible();
        await expect(content).toHaveCSS("opacity", "1");
        const bounds = await content.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.x).toBeGreaterThanOrEqual(0);
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
        await page.screenshot({ path: `/tmp/axedbooks-${id}-320.png` });
    }
});

test("theme choices persist and system mode follows changes", async ({
    page,
}) =>
{
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/en/");
    const menu = page.locator("#theme-menu summary");
    await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        "archive-dark",
    );
    await menu.click();
    await expect(page.locator("#theme-menu input[type=radio]")).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "System", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
        page.getByRole("button", { name: "System", exact: true }),
    ).toHaveClass(/\bmenu-active\b/);
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "archive");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "archive");
    await menu.click();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await page.goto(`/en/${bookPath}/`);
    await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        "archive-dark",
    );
    await menu.click();
    await expect(
        page.getByRole("button", { name: "Dark", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
        page.getByRole("button", { name: "Dark", exact: true }),
    ).toHaveClass(/\bmenu-active\b/);
    await expect(
        page.getByRole("button", { name: "System", exact: true }),
    ).not.toHaveClass(/\bmenu-active\b/);
    await page.getByRole("button", { name: "System", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        "archive-dark",
    );
    await page.emulateMedia({ colorScheme: "light" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "archive");
    await page.reload();
    await menu.click();
    await expect(
        page.getByRole("button", { name: "System", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
});

test("daisyUI components use the selected theme", async ({ page }) =>
{
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/en/");
    await expect(page.locator("header .navbar")).toBeVisible();
    await expect(page.locator("header nav .menu")).toBeVisible();
    await expect(page.locator("#language-menu")).toHaveClass(/\bdropdown\b/);
    await expect(page.locator("#theme-menu")).toHaveClass(/\bdropdown\b/);
    await expect(page.locator(".search-box")).toHaveClass(/\binput\b/);
    await expect(page.locator(".filter-panel .fieldset").first()).toBeVisible();
    await expect(page.locator('[data-filter="format"]')).toHaveClass(
        /\bselect\b/,
    );
    await expect(page.locator('[data-filter="status"]')).toHaveClass(
        /\bselect\b/,
    );
    await expect(page.getByRole("button", { name: "Grid view" })).toHaveClass(
        /\bbtn\b/,
    );
    await expect(page.locator(".book-card").first()).toHaveClass(/\bcard\b/);
    await expect(
        page.locator(".book-card:visible .book-tags .badge").first(),
    ).toBeVisible();
    await expect(page.locator("#pagination .join")).toBeVisible();
    await expect(page.locator("footer .footer")).toBeVisible();
    const control = page.locator('[data-filter="format"]');
    const lightColor = await control.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
    );
    await page.locator("#theme-menu summary").click();
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute(
        "data-theme",
        "archive-dark",
    );
    await expect(control).not.toHaveCSS("background-color", lightColor);
});

test("YAML cover renders and copyright disclaimer is available", async ({
    page,
}) =>
{
    await page.goto("/en/");
    const cover = page.locator(`[data-id="${bookPath}"] .book-cover img`);
    await expect(cover).toHaveAttribute("src", bookCover);
    await page.waitForFunction(
        (selector) =>
            (document.querySelector(selector) as HTMLImageElement | null)
                ?.naturalWidth,
        `[data-id="${bookPath}"] .book-cover img`,
    );
    expect(
        await cover.evaluate((image: HTMLImageElement) => image.naturalWidth),
    ).toBeGreaterThan(0);
    await expect(page.getByText(/Book covers are the copyright/)).toBeVisible();
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        "https://axedbooks.rip/en/",
    );
    await page.goto(`/en/${bookPath}/`);
    await expect(page.locator(".detail-cover img")).toHaveAttribute(
        "src",
        bookCover,
    );
    await expect(page.getByText(/Book covers are the copyright/)).toBeVisible();
});

for (const viewport of [
    { width: 1440, height: 900 },
    { width: 320, height: 720 },
])
{
    test(`book details fit ${viewport.width}px viewport`, async ({ page }) =>
    {
        await page.setViewportSize(viewport);
        await page.emulateMedia({
            colorScheme: viewport.width === 320 ? "dark" : "light",
        });
        await page.goto(`/en/${bookPath}/`);
        await expect(page.locator("main h1")).toHaveText(bookTitle);
        await expect(page.locator(".detail-cover img")).toBeVisible();
        await expect(page.getByText("Original edition")).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: `/tmp/axedbooks-detail-${viewport.width}.png`,
            fullPage: true,
        });
    });
}

test("catalog covers retain portrait proportions in grid and list views", async ({
    page,
}) =>
{
    await page.goto("/en/?status=all");
    for (const view of ["Grid view", "List view"])
    {
        await page.getByRole("button", { name: view }).click();
        for (const cover of await page.locator(".book-cover").all())
        {
            const box = await cover.boundingBox();
            expect(box).not.toBeNull();
            expect(box!.width / box!.height).toBeCloseTo(2 / 3, 2);
        }
    }
});

for (const [width, columns] of [
    [1440, 4],
    [1024, 3],
    [768, 2],
    [390, 2],
])
{
    test(`catalog uses ${columns} columns at ${width}px`, async ({ page }) =>
    {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/en/?status=all");
        const cards = page.locator(".book-card:visible");
        await expect(cards).toHaveCount(4);
        const firstRowCount = () =>
            cards.evaluateAll((elements) =>
            {
                const top = elements[0].getBoundingClientRect().top;
                return elements.filter(
                    (element) =>
                        Math.abs(element.getBoundingClientRect().top - top) < 1,
                ).length;
            });
        expect(await firstRowCount()).toBe(columns);
        await page.getByRole("button", { name: "List view" }).click();
        expect(await firstRowCount()).toBe(1);
    });
}

for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
])
{
    test(`layout fits ${viewport.width}px viewport`, async ({ page }) =>
    {
        await page.setViewportSize(viewport);
        await page.goto("/en/?status=all");
        await expect(page.locator("main h1")).toBeVisible();
        await expect(page.locator(".book-card:visible")).toHaveCount(4);
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: `/tmp/axedbooks-${viewport.width}.png`,
            fullPage: true,
        });
    });
}

for (const viewport of [
    { width: 1440, height: 900 },
    { width: 320, height: 720 },
])
{
    test(`dark layout fits ${viewport.width}px viewport`, async ({ page }) =>
    {
        await page.emulateMedia({ colorScheme: "dark" });
        await page.setViewportSize(viewport);
        await page.goto("/en/");
        await expect(page.locator("html")).toHaveAttribute(
            "data-theme",
            "archive-dark",
        );
        await expect(page.locator("#theme-menu summary")).toBeVisible();
        expect(
            await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
            ),
        ).toBe(true);
        await page.screenshot({
            path: `/tmp/axedbooks-dark-${viewport.width}.png`,
            fullPage: true,
        });
    });
}
