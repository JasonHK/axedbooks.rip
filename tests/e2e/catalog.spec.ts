import { test, expect, type Page } from "@playwright/test";
import type { BookStatus } from "../../src/lib/catalog";

const bookPath = "ching-win/light-novel/her-royal-highness-seems-to-be-angry";
const mangaPath = "jade-dynasty/manga/ruri-dragon";
const bookTitle = "公主殿下貌似大發雷霆";
const bookCover =
    "/covers/ching-win/light-novel/her-royal-highness-seems-to-be-angry.jpg";

async function mockCatalog(
    page: Page,
    count: number,
    statuses: readonly BookStatus[] = ["axed"],
)
{
    await page.route("**/catalog.json", (route) =>
        route.fulfill({
            contentType: "application/json",
            body: JSON.stringify(
                Array.from({ length: count }, (_, index) => ({
                    id:
                        index === 0
                            ? bookPath
                            : `ching-win/light-novel/fixture-${index}`,
                    title:
                        index === 0
                            ? `${bookTitle} fixture-match`
                            : index < 5
                              ? `fixture-match ${index}`
                              : `fixture-other ${index}`,
                    authors: ["Fixture Author"],
                    publisherId: "ching-win",
                    publisherName: "青文",
                    format:
                        index < Math.min(17, Math.floor(count / 2))
                            ? "manga"
                            : "light-novel",
                    origin: "TW",
                    language: "zh-Hant",
                    lastPublishedDate: new Date(
                        Date.UTC(1990 + index, 0, 1),
                    ).toISOString(),
                    volume: index + 1,
                    gap: index % 4,
                    status: statuses[index % statuses.length],
                    statusEstimated: index % 2 === 0,
                    sourceTitle:
                        index === 0 ? "王女殿下はお怒りのようです" : undefined,
                    cover: index === 0 ? bookCover : undefined,
                    fictional: false,
                })),
            ),
        }),
    );
}

test("search, filters, sorting, views and URL state work together", async ({
    page,
}) =>
{
    await mockCatalog(page, 4);
    await page.goto("/en/");
    const cards = page.locator(".book-card:visible");
    await expect(cards).toHaveCount(4);
    await expect(page.locator('[data-filter="status"]')).toHaveCount(0);
    await expect(page).not.toHaveURL(/status=/);
    expect(
        await page
            .locator(".book-card:visible")
            .evaluateAll((cards) =>
                cards.every(
                    (card) =>
                        card.getAttribute("data-status") === "axed" &&
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
    await page.getByRole("button", { name: "Clear filters" }).click();
    await page
        .locator("#filter-format")
        .evaluate((element) =>
            (element as HTMLSelectElement).add(
                new Option("Manga fixture", "manga"),
            ),
        );
    await page.getByLabel("Format").selectOption("manga");
    await expect(page.locator(".book-card:visible")).toHaveCount(2);
    await page.getByLabel("Sort").selectOption("volume-desc");
    await expect(page.locator(".book-card:visible").first()).toHaveAttribute(
        "data-volume",
        "2",
    );
    await page.getByRole("button", { name: "Clear" }).click();
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page.locator("#book-list")).toHaveClass(/list-view/);
    await expect(page).toHaveURL(/view=list/);
    await page.reload();
    await expect(page.locator(".book-card:visible")).toHaveCount(4);
    await expect(
        page.getByRole("button", { name: "List view" }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.goBack();
    await expect(
        page.getByRole("button", { name: "Grid view" }),
    ).toHaveAttribute("aria-pressed", "true");
});

test("pagination handles page sizes, filters, URL state and history", async ({
    page,
}) =>
{
    await mockCatalog(page, 44);
    await page.goto("/en/");
    const cards = page.locator(".book-card:visible");
    const previous = page.locator("#previous-page");
    const next = page.locator("#next-page");
    const size = page.getByLabel("Books per page");
    await expect(cards).toHaveCount(12);
    await expect(page.locator("#result-count")).toHaveText("44");
    await expect(page.locator("#result-range")).toHaveText("01—12");
    await expect(page.locator("#page-status")).toHaveText("Page 1 of 4");
    await expect(previous).toHaveAttribute("aria-disabled", "true");
    await next.click();
    await expect(cards).toHaveCount(12);
    await expect(page.locator("#result-range")).toHaveText("13—24");
    await expect(page).toHaveURL(/\/en\/page\/2\/$/);
    await next.click();
    await next.click();
    await expect(cards).toHaveCount(8);
    await expect(next).toHaveAttribute("aria-disabled", "true");
    await previous.click();
    await expect(page.locator("#page-status")).toHaveText("Page 3 of 4");
    await page.goBack();
    await expect(page.locator("#page-status")).toHaveText("Page 4 of 4");
    await size.selectOption("24");
    await expect(cards).toHaveCount(24);
    await expect(page.locator("#page-status")).toHaveText("Page 1 of 2");
    await expect(page).toHaveURL(/\/en\/\?perPage=24$/);
    await next.click();
    await expect(cards).toHaveCount(20);
    await expect(page).toHaveURL(/\/en\/page\/2\/\?perPage=24$/);
    await size.selectOption("36");
    await expect(cards).toHaveCount(36);
    await next.click();
    await expect(cards).toHaveCount(8);
    await page.getByLabel("Search books").fill("fixture-match");
    await expect(cards).toHaveCount(5);
    await expect(page.locator("#page-status")).toHaveText("Page 1 of 1");
    await expect(page.locator("#result-count")).toHaveText("5");
    await expect(page).not.toHaveURL(/\/page\/2\//);
    await page.getByLabel("Search books").clear();
    await size.selectOption("12");
    await page
        .locator("#filter-format")
        .evaluate((element) =>
            (element as HTMLSelectElement).add(
                new Option("Manga fixture", "manga"),
            ),
        );
    await page.getByLabel("Format").selectOption("manga");
    await expect(page.locator("#result-count")).toHaveText("17");
    await expect(cards).toHaveCount(12);
    await next.click();
    await expect(cards).toHaveCount(5);
    await page.getByLabel("Format").selectOption("light-novel");
    await expect(page.locator("#page-status")).toHaveText("Page 1 of 3");
    await expect(cards).toHaveCount(12);
    await page.getByLabel("Search books").fill("no results");
    await expect(page.locator("#pagination")).toBeHidden();
    await expect(page.getByText("No books found")).toBeVisible();

    await page.goto("/en/?perPage=12&page=999&status=all");
    await expect(cards).toHaveCount(12);
    await expect(page.locator("#page-status")).toHaveText("Page 1 of 4");
    await expect(page).toHaveURL(/\/en\/$/);
    await page.goto("/en/?perPage=13&page=0&status=all");
    await expect(cards).toHaveCount(12);
    await expect(size).toHaveValue("12");
    await expect(page).toHaveURL(/\/en\/$/);
});

test("localized status catalogs isolate books and keep scoped page links", async ({
    page,
}) =>
{
    await mockCatalog(page, 52, ["ongoing", "hiatus", "finished", "axed"]);
    for (const [path, status, label, badgeColor, title, description] of [
        [
            "/en/ongoing/",
            "ongoing",
            "Ongoing",
            "badge-success",
            "Publication Tracker",
            "Review each translated edition's latest publication date, publication status, and volume gap.",
        ],
        [
            "/zh-hant/hiatus/",
            "hiatus",
            "暫停出版",
            "badge-warning",
            "出版追蹤清單",
            "檢視各代理版本的最新出版日期、出版狀態與集數落差。",
        ],
        [
            "/zh-hans/finished/",
            "finished",
            "已完结",
            "badge-neutral",
            "出版追踪清单",
            "查看各代理版本的最新出版日期、出版状态与集数差距。",
        ],
    ])
    {
        await page.goto(path);
        await expect(page.locator("#catalog-app")).toHaveAttribute(
            "data-status",
            status,
        );
        await expect(page.locator("#catalog-title")).toHaveText(title);
        await expect(page.getByText(description, { exact: true })).toBeVisible();
        await expect(page).toHaveTitle(`Axed Books | ${title}`);
        await expect(page.locator(".book-card:visible")).toHaveCount(12);
        await expect(page.locator("#result-count")).toHaveText("13");
        await expect(page.locator(".status-badge").first()).toHaveText(label);
        await expect(page.locator(".status-badge").first()).toHaveClass(
            new RegExp(badgeColor),
        );
        const cardStatuses = await page
            .locator(".book-card:visible")
            .evaluateAll((cards) =>
                cards.map((card) => card.getAttribute("data-status")),
            );
        expect(cardStatuses.every((cardStatus) => cardStatus === status)).toBe(
            true,
        );
    }

    await page.goto("/en/ongoing/");
    await expect(page.getByRole("tablist").getByRole("tab")).toHaveText([
        "Axed",
        "Hiatus",
        "Ongoing",
        "Finished",
    ]);
    await expect(page.locator("#next-page")).toHaveAttribute(
        "href",
        "/en/ongoing/page/2/",
    );
    await page.locator("#language-menu summary").click();
    await page.getByRole("link", { name: "繁體中文" }).click();
    await expect(page).toHaveURL(/\/zh-hant\/ongoing\/$/);
    await page.goto("/en/");
    await expect(page.locator(".book-card:visible")).toHaveCount(12);
    await expect(page.locator("#result-count")).toHaveText("13");
    await expect(page.locator(".status-badge").first()).toHaveText("Axed");
});

test("status landing routes render an empty state when their feed is empty", async ({
    page,
}) =>
{
    await mockCatalog(page, 4);
    await page.goto("/en/finished/");
    await expect(page).toHaveURL(/\/en\/finished\/$/);
    await expect(page.locator("#result-count")).toHaveText("0");
    await expect(page.locator("#no-results")).toBeVisible();
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
    await expect(
        page.locator("dd").filter({ hasText: "Volume 6 (Behind by 3 volumes)" }),
    ).toHaveText("Volume 6 (Behind by 3 volumes)");
    await expect(page.locator("dd").filter({ hasText: "Volume 9" })).toHaveText(
        "Volume 9",
    );
    await expect(page.getByText("王女殿下はお怒りのようです")).toBeVisible();
    await expect(page.getByText("Behind by 3 volumes")).toBeVisible();
    await expect(page.getByText("Finished", { exact: true })).toBeVisible();
    await expect(page.getByText("Estimated publication status")).toBeVisible();
    await expect(page.getByText("Axed", { exact: true })).toBeVisible();
    await page.locator("#language-menu summary").click();
    await page.getByRole("link", { name: "繁體中文" }).click();
    await expect(page).toHaveURL(new RegExp(`/zh-hant/${bookPath}/`));
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
    await expect(
        page.locator("dd").filter({ hasText: "第 6 集（落後 3 集）" }),
    ).toHaveText("第 6 集（落後 3 集）");
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
    await expect(page).toHaveURL(/\/en\/$/);
    for (const [locale, language, title, pageStatus, original, gap] of [
        [
            "en",
            "en",
            "Translated Book Publication Tracker",
            "Page 1 of 1",
            "Original edition",
            "Behind by 3 volumes",
        ],
        [
            "zh-hant",
            "zh-Hant",
            "代理書籍出版進度追蹤資料庫",
            "第 1 頁，共 1 頁",
            "原作版本",
            "落後 3 集",
        ],
        [
            "zh-hans",
            "zh-Hans",
            "代理书籍出版进度追踪数据库",
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
        if (locale === "zh-hant")
            await expect(
                page.locator(".book-tags").getByText("推測", { exact: true }),
            ).toHaveCount(0);
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
            "href",
            `https://axedbooks.rip/${locale}/`,
        );
        await expect(
            page.locator('meta[property="og:locale"]'),
        ).toHaveAttribute(
            "content",
            locale === "zh-hant"
                ? "zh_TW"
                : locale === "zh-hans"
                  ? "zh_CN"
                  : "en_US",
        );
        await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
            "content",
            `https://axedbooks.rip/${locale}/`,
        );
        await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
            "content",
            "summary",
        );
        const bookCard = page.locator(`[data-id="${bookPath}"]`);
        await expect(bookCard).toContainText(
            locale === "en" ? "Volume 6" : "第 6 集",
        );
        await page.locator(`[data-id="${bookPath}"] h3 a`).click();
        await expect(page).toHaveURL(new RegExp(`/${locale}/${bookPath}/`));
        await expect(page.locator("main h1")).toHaveText(bookTitle);
        await expect(page.getByText(original, { exact: true })).toBeVisible();
        await expect(page.locator("dd").filter({ hasText: gap })).toBeVisible();
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

for (const { width, locale } of [
    { width: 320, locale: "zh-hant" },
    { width: 1280, locale: "en" },
])
{
    test(`catalog controls do not shift results while loading at ${width}px`, async ({
        page,
    }) =>
    {
        await page.setViewportSize({ width, height: 900 });
        let releaseResponse!: () => void;
        const responseReady = new Promise<void>((resolve) =>
        {
            releaseResponse = resolve;
        });
        let requestStarted!: () => void;
        const requestReady = new Promise<void>((resolve) =>
        {
            requestStarted = resolve;
        });
        await page.route("**/catalog.json", async (route) =>
        {
            requestStarted();
            await responseReady;
            await route.continue();
        });
        try
        {
            await page.goto(`/${locale}/`, { waitUntil: "domcontentloaded" });
            await requestReady;
            await page.evaluate(() => document.fonts.ready);
            const list = page.locator("#book-list");
            const before = await list.boundingBox();
            expect(before).not.toBeNull();
            await expect(page.locator(".toolbar")).toBeHidden();
            await expect(page.locator(".filter-panel")).toBeHidden();
            await expect(page.locator("#no-js")).toBeHidden();
            expect(
                await page.locator("#search").evaluate((element) =>
                {
                    element.focus();
                    return document.activeElement === element;
                }),
            ).toBe(false);
            releaseResponse();
            await expect(page.locator(".toolbar")).toBeVisible();
            await expect(page.locator(".filter-panel")).toBeVisible();
            const after = await list.boundingBox();
            expect(after).not.toBeNull();
            expect(Math.abs(after!.x - before!.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
            expect(Math.abs(after!.width - before!.width)).toBeLessThanOrEqual(1);
            await page.locator("#search").focus();
            await expect(page.locator("#search")).toBeFocused();
        }
        finally
        {
            releaseResponse();
        }
    });
}

test("catalog remains visible without JavaScript", async ({ browser }) =>
{
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/en/");
    const staticCards = page.locator(".book-card:visible");
    await expect(staticCards).not.toHaveCount(0);
    await expect(page.locator('.book-card[data-status="axed"]')).toHaveCount(
        await staticCards.count(),
    );
    await expect(page.locator('[data-filter="status"]')).toHaveCount(0);
    await expect(
        page.getByText(
            "JavaScript is required for search and filters; page links work without it.",
        ),
    ).toBeVisible();
    await expect(page.locator(".toolbar")).toBeHidden();
    await expect(page.locator(".toolbar")).toHaveCSS("display", "none");
    await expect(page.locator(".filter-panel")).toHaveCSS("display", "none");
    await expect(page.locator(".book-card a").first()).toHaveAttribute("href", /.+/);
    await page.locator("#language-menu summary").click();
    await page.getByRole("link", { name: "繁體中文" }).click();
    await expect(page).toHaveURL(/\/zh-hant\/$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "zh-Hant");
    await page.goto("/en/ongoing/");
    await expect(page.locator("#catalog-app")).toHaveAttribute(
        "data-status",
        "ongoing",
    );
    const statusCards = await page
        .locator(".book-card")
        .evaluateAll((cards) =>
            cards.map((card) => card.getAttribute("data-status")),
        );
    expect(statusCards.every((status) => status === "ongoing")).toBe(true);
    await context.close();
});

test("static cards remain available when the catalog index fails", async ({
    page,
}) =>
{
    await page.route("**/catalog.json", (route) =>
        route.fulfill({ status: 500, body: "" }),
    );
    await page.goto("/en/");
    const staticCards = page.locator(".book-card:visible");
    await expect(staticCards).not.toHaveCount(0);
    await expect(page.locator('.book-card[data-status="axed"]')).toHaveCount(
        await staticCards.count(),
    );
    await expect(page.locator("#catalog-load-error")).toBeVisible();
    await expect(page.locator("#no-js")).toBeHidden();
    await expect(page.locator(".toolbar")).toBeHidden();
    await expect(page.locator(".toolbar")).toHaveCSS("display", "none");
    await expect(page.locator(".filter-panel")).toHaveCSS("display", "none");
    await expect(page.locator(".book-card a").first()).toHaveAttribute("href", /.+/);
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
    await expect(page).toHaveURL(/\/zh-hant\/$/);
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
    await mockCatalog(page, 13);
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
    await expect(page.locator('[data-filter="status"]')).toHaveCount(0);
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
    await mockCatalog(page, 4);
    await page.goto("/en/");
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
        await mockCatalog(page, 8);
        await page.goto("/en/");
        const cards = page.locator(".book-card:visible");
        await expect(cards).toHaveCount(8);
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
        await mockCatalog(page, 4);
        await page.goto("/en/");
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
