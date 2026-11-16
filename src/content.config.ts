import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const nonempty = z.string().trim().min(1);
const volume = z.number().nonnegative().or(nonempty);

const books = defineCollection({
    loader: glob({ base: "./books", pattern: "**/*.yaml" }),
    schema: z
        .object({
            title: nonempty,
            language: nonempty.refine((value) =>
            {
                try
                {
                    new Intl.Locale(value);
                    return true;
                }
                catch
                {
                    return false;
                }
            }, "Expected a BCP 47 language tag"),
            authors: z.array(nonempty).min(1),
            volumes: z
                .array(volume.nullable())
                .min(1)
                .or(z.number().int().positive()),
            lastPublishedDate: z.date(),
            status: z
                .enum(["releasing", "hiatus", "cancelled", "finished"])
                .optional(),
            sourcePublisher: nonempty.optional(),
            legacySlug: nonempty
                .refine(
                    (value) =>
                        !value.includes("/") && value !== "." && value !== "..",
                    "Expected a single path segment",
                )
                .optional(),
            cover: nonempty.optional(),
            notes: nonempty.optional(),
            sources: z.array(z.url()).default([]),
            fictional: z.boolean().default(false),
        })
        .refine(
            (book) =>
                typeof book.volumes === "number" ||
                (book.volumes.at(-1) !== null &&
                    (book.sourcePublisher !== undefined ||
                        !book.volumes.includes(null))),
            {
                message:
                    "The latest volume must be published; source volumes cannot be skipped",
                path: ["volumes"],
            },
        ),
});

const publishers = defineCollection({
    loader: glob({ base: "./publishers", pattern: "**/*.yaml" }),
    schema: z.object({
        name: nonempty,
        origin: z
            .string()
            .regex(/^[A-Z]{2}$/, "Expected an ISO 3166-1 alpha-2 country code"),
    }),
});

export const collections = { books, publishers };
