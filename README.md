# Axed Books

Axed Books is a static, evidence-oriented database tracking the publication status of translated editions, currently focused on Taiwanese and Hong Kong manga and light novels. The data model is designed to support additional languages and markets. Included records are fictional demonstrations, not claims about real books or publishers.

## Development

Use Node.js supported by the installed Astro version and the pnpm version specified in `package.json`.

```sh
pnpm install
pnpm dev
pnpm test
pnpm check
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Deploy the generated `dist` directory to any static host. Changes to records require a rebuild and redeployment; there is no runtime backend.

## Adding books

Add one YAML file per edition under `books/<publisher-slug>/<type>/<title-slug>.yaml`. The full path without the extension is the stable ID and URL path; use URL-friendly, stable segments. For example, `books/daylight-publishing/light-novel/lantern-tw.yaml` appears at `/en/daylight-publishing/light-novel/lantern-tw/`. The unprefixed path redirects to English. Define each publisher once in `publishers/<publisher-slug>.yaml` with a `name` field. An edition's publisher is determined by its directory, not by a book field.

An edition with no `sourcePublisher` is a source/root edition. To link a translation, set `sourcePublisher` to the source publisher's slug; the source entry must use the same type and title slug. The type segment of the path determines the format used for display and filtering. A source referenced by a translation is reference-only and does not appear in the catalog, while independent source/root editions remain visible. Dates are unquoted ISO calendar dates. `volumes` is an ordered array of non-negative numbers, including zero and decimals such as `4.5`, or strings; a translation may use `null` for any skipped volume before its latest published volume, including initial volumes. Its final array entry must be published. Source volumes cannot be `null`, and translations may list fewer volumes than their source.

```yaml
title: "Series title"
language: zh-Hant
authors: ["Author", "Illustrator"]
volumes: [1, 2, null, 4, 5]
lastPublishedDate: 2021-08-12
status: hiatus
market: taiwan
sourcePublisher: original-publisher
cover: /covers/example.jpg
notes: "Additional context about this edition."
sources: ["https://example.com/source"]
fictional: false
```

Publisher record example: `publishers/original-publisher.yaml` with `name: "Original Publisher"`. For linked editions, the site calculates volume gaps from the number of listed volumes. The path type may be `manga`, `light-novel`, or `other`; optional `market` values are `taiwan`, `hong-kong`, and `other`. `cover` may be an image URL or a path to an image in `public` (for example, `public/covers/example.jpg` is referenced as `/covers/example.jpg`). The optional `notes` field contains plain text. The included lantern cover is an original illustration for a fictional demo record. `legacySlug` is optional and preserves a previous `/books/<slug>/` URL; legacy slugs must be unique. Previous type-first URLs also redirect unless they conflict with a current book's canonical path.

The optional `status` is `ongoing`, `hiatus`, `axed`, or `finished` and overrides inference. A source/root edition without a status defaults to `ongoing`. A translation without a source defaults to `ongoing`, since its progress cannot be inferred. When a translation has caught up, its status follows the source, except an axed source becomes `finished` for the translation. Otherwise, an axed source implies an axed translation after 12 months without a translated release; a finished source implies an axed translation after 18 months if the source ended more than 12 months ago, or after 24 months if only one volume remains. A source on hiatus implies an axed translation after 24 months; an ongoing source implies an axed translation after 24 months when at least two volumes behind. Intermediate periods are `hiatus` after 18 months for finished or paused sources, and after 12 months for ongoing sources at least two volumes behind; other cases remain `ongoing`. Thresholds use UTC calendar dates and whole calendar months, clamping month-end anniversaries to the last day of the month. These are estimates, not verified claims; explicit status and reliable sources take precedence. Status inferred during a static build changes only when the site is rebuilt.

Only add real editions when their discontinued or stalled publication can be supported by reliable sources; a long interval or a volume gap alone does not establish cancellation. Include source URLs, verify dates and volume information, and use covers only with appropriate rights. The `fictional` flag must be set on all demonstration records.

Interface translations are maintained in the `i18n` JSON dictionaries and loaded through `@ariaskit/astro-i18n`. Run `pnpm exec astro-i18n check` after changing translations to validate keys and interpolation placeholders. The launch interface supports Traditional Chinese, Simplified Chinese, and English; book titles and author names are displayed as recorded.

The integration's generated types are disabled because version 1.0.1 emits a declaration that shadows its own exports; the project augments its registry from the English dictionary instead. That version also warns that the Chinese locales have no pages because it does not detect Astro's dynamic locale routes; those pages are generated by `getStaticPaths()`.
