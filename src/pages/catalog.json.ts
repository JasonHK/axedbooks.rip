import { getCollection } from "astro:content";
import { catalogIndexBooks } from "../lib/catalog";

export const prerender = true;

export async function GET()
{
    const [books, publishers] = await Promise.all([
        getCollection("books"),
        getCollection("publishers"),
    ]);
    const catalog = catalogIndexBooks(books, publishers);
    return new Response(JSON.stringify(catalog), {
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}
