/**
 * Build-time character scraper for Cars Character Swiper.
 *
 * Uses the Fandom MediaWiki API instead of HTML scraping to avoid
 * Cloudflare 403 blocks on direct page requests.
 *
 * Phase 1: Category members API with pagination
 * - Accepts CLI arguments: --urls <URL1> [URL2 ...] --movie <cars1|cars2|cars3> --output <dir>
 * - Derives the wiki API base URL from the first --urls value
 * - Uses the categorymembers API (cmlimit=50, follows cmcontinue) to get ALL characters
 * - Filters out non-article pages (ns !== 0)
 *
 * Phase 2: Batch image extraction via pageimages API
 * - Batches character titles (up to 50 per request)
 * - Uses the pageimages API (prop=pageimages, piprop=original) to get image URLs
 * - Skips characters without an original image
 *
 * Phase 3: Image download, WebP conversion, and manifest generation
 * - Downloads each extracted image using fetch
 * - Converts downloaded images to WebP using sharp
 * - Generates a kebab-case id from the character name
 * - Reads any existing characters.json and merges new characters (deduplicate by id)
 * - Writes the updated manifest to public/characters.json
 */

import * as cheerio from "cheerio";
import sharp from "sharp";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Character, CharacterManifest, Movie } from "../src/types/index.ts";

/** Common headers sent with every fetch request to avoid 403 blocks. */
const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

/** A character entry extracted from a category page. */
export interface CategoryCharacter {
  /** Display name of the character */
  name: string;
  /** URL to the individual character page */
  url: string;
}

/**
 * Parse a category page HTML string and extract character names and links.
 *
 * Fandom wiki category pages list characters inside a
 * `<div class="category-page__members">` section. Each character entry
 * is an `<a>` element within that section.
 *
 * @param html - The raw HTML of a category page
 * @param baseUrl - The base URL for resolving relative links
 * @returns An array of extracted character entries
 */
export function parseCategoryPage(
  html: string,
  baseUrl: string,
): CategoryCharacter[] {
  const $ = cheerio.load(html);
  const characters: CategoryCharacter[] = [];

  $(".category-page__members a.category-page__member-link").each(
    (_index, element) => {
      const $el = $(element);
      const name = $el.text().trim();
      const href = $el.attr("href");

      if (name && href) {
        // Resolve relative URLs against the base
        const url = href.startsWith("http")
          ? href
          : new URL(href, baseUrl).toString();
        characters.push({ name, url });
      }
    },
  );

  return characters;
}

/**
 * Deduplicate characters by name, keeping the first occurrence.
 */
export function deduplicateByName(
  characters: CategoryCharacter[],
): CategoryCharacter[] {
  const seen = new Set<string>();
  return characters.filter((char) => {
    if (seen.has(char.name)) {
      return false;
    }
    seen.add(char.name);
    return true;
  });
}

/**
 * Convert a character name to a kebab-case id.
 *
 * Lowercases the name, replaces non-alphanumeric characters with hyphens,
 * collapses consecutive hyphens, and trims leading/trailing hyphens.
 *
 * @param name - The character display name (e.g., "Lightning McQueen")
 * @returns A kebab-case id (e.g., "lightning-mcqueen")
 */
export function toKebabCase(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Create a Character manifest entry.
 *
 * @param name - The character display name
 * @param movie - The source movie tag
 * @param id - The kebab-case character id
 * @returns A Character object for the manifest
 */
export function buildManifestEntry(
  name: string,
  movie: Movie,
  id: string,
): Character {
  return {
    id,
    name,
    movie,
  };
}

/** A character entry with an extracted image URL from the individual page. */
export interface CharacterWithImage {
  /** Display name of the character */
  name: string;
  /** URL to the individual character page */
  url: string;
  /** URL of the character image extracted from the individual page */
  imageUrl: string;
}

/**
 * Parse an individual character page HTML and extract the image URL.
 *
 * Looks for a `<figure class="article-media-thumbnail">` element and
 * extracts the `src` attribute from the `<img>` inside it.
 *
 * @param html - The raw HTML of an individual character page
 * @returns The image URL, or null if the figure or img element is not found
 */
export function parseCharacterPage(html: string): string | null {
  const $ = cheerio.load(html);
  const figure = $('figure.article-media-thumbnail');

  if (figure.length === 0) {
    return null;
  }

  const img = figure.find("img");
  if (img.length === 0) {
    return null;
  }

  const src = img.attr("src");
  return src ?? null;
}

// ---------------------------------------------------------------------------
// MediaWiki API types
// ---------------------------------------------------------------------------

/** A single category member from the MediaWiki API response. */
interface ApiCategoryMember {
  pageid: number;
  ns: number;
  title: string;
}

/** Shape of the categorymembers API response. */
interface ApiCategoryMembersResponse {
  query?: {
    categorymembers?: ApiCategoryMember[];
  };
  continue?: {
    cmcontinue: string;
    continue: string;
  };
}

/** Shape of a page entry in the pageimages API response. */
interface ApiPageWithImage {
  pageid: number;
  title: string;
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

/** Shape of the pageimages API response. */
interface ApiPageImagesResponse {
  query?: {
    pages?: Record<string, ApiPageWithImage>;
  };
}

// ---------------------------------------------------------------------------
// API-based functions (Phase 1 & 2)
// ---------------------------------------------------------------------------

/**
 * Derive the MediaWiki API base URL from a Fandom wiki URL.
 *
 * For example, given "https://pixarcars.fandom.com/wiki/Category:Cars_characters"
 * returns "https://pixarcars.fandom.com/api.php".
 *
 * @param wikiUrl - A full URL to any page on the Fandom wiki
 * @returns The API endpoint URL
 */
export function deriveApiBaseUrl(wikiUrl: string): string {
  const parsed = new URL(wikiUrl);
  return `${parsed.origin}/api.php`;
}

/**
 * Fetch ALL category members using the MediaWiki categorymembers API
 * with pagination (cmlimit=50, follows cmcontinue).
 *
 * Filters out non-article pages (ns !== 0).
 *
 * @param apiBaseUrl - The MediaWiki API endpoint (e.g. "https://pixarcars.fandom.com/api.php")
 * @param categoryTitle - The category title (e.g. "Category:Cars_characters")
 * @returns An array of CategoryCharacter entries
 */
export async function fetchCategoryMembersApi(
  apiBaseUrl: string,
  categoryTitle: string,
): Promise<CategoryCharacter[]> {
  const allMembers: CategoryCharacter[] = [];
  let cmcontinue: string | undefined;

  do {
    const params = new URLSearchParams({
      action: "query",
      list: "categorymembers",
      cmtitle: categoryTitle,
      cmlimit: "50",
      format: "json",
    });

    if (cmcontinue) {
      params.set("cmcontinue", cmcontinue);
    }

    const url = `${apiBaseUrl}?${params.toString()}`;
    console.log(`  Fetching category members: ${url}`);

    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch category members: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as ApiCategoryMembersResponse;

    if (data.query?.categorymembers) {
      for (const member of data.query.categorymembers) {
        // Filter out non-article pages (ns !== 0)
        if (member.ns !== 0) {
          continue;
        }
        allMembers.push({
          name: member.title,
          url: `${new URL(apiBaseUrl).origin}/wiki/${encodeURIComponent(member.title.replace(/ /g, "_"))}`,
        });
      }
    }

    cmcontinue = data.continue?.cmcontinue;
  } while (cmcontinue);

  return allMembers;
}

/**
 * Fetch image URLs for a batch of character titles using the MediaWiki
 * pageimages API (prop=pageimages, piprop=original).
 *
 * Batches up to 50 titles per request. Characters without an `original`
 * image are skipped.
 *
 * @param apiBaseUrl - The MediaWiki API endpoint
 * @param characters - Array of CategoryCharacter entries to look up images for
 * @returns Array of CharacterWithImage entries (only those with images)
 */
export async function fetchCharacterImagesApi(
  apiBaseUrl: string,
  characters: CategoryCharacter[],
): Promise<CharacterWithImage[]> {
  const results: CharacterWithImage[] = [];
  const batchSize = 50;

  for (let i = 0; i < characters.length; i += batchSize) {
    const batch = characters.slice(i, i + batchSize);
    const titles = batch.map((c) => c.name).join("|");

    const params = new URLSearchParams({
      action: "query",
      titles,
      prop: "pageimages",
      piprop: "original",
      format: "json",
    });

    const url = `${apiBaseUrl}?${params.toString()}`;
    console.log(
      `  Fetching images for batch ${Math.floor(i / batchSize) + 1} (${batch.length} titles)...`,
    );

    const response = await fetch(url, { headers: FETCH_HEADERS });
    if (!response.ok) {
      console.warn(
        `  Warning: Failed to fetch image batch (${response.status}), skipping batch.`,
      );
      continue;
    }

    const data = (await response.json()) as ApiPageImagesResponse;

    if (data.query?.pages) {
      // Build a lookup from title -> character for URL resolution
      const charByName = new Map<string, CategoryCharacter>();
      for (const c of batch) {
        charByName.set(c.name, c);
      }

      for (const page of Object.values(data.query.pages)) {
        if (!page.original?.source) {
          console.warn(
            `  Warning: No image found for "${page.title}", skipping.`,
          );
          continue;
        }

        const char = charByName.get(page.title);
        if (char) {
          results.push({
            name: char.name,
            url: char.url,
            imageUrl: page.original.source,
          });
        }
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Legacy HTML-based fetch (kept for reference but no longer used in main)
// ---------------------------------------------------------------------------

/**
 * Sleep for the given number of milliseconds.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch individual character pages and extract image URLs (legacy HTML method).
 *
 * @deprecated Use fetchCharacterImagesApi instead.
 */
export async function fetchCharacterImages(
  characters: CategoryCharacter[],
): Promise<CharacterWithImage[]> {
  const results: CharacterWithImage[] = [];

  for (let i = 0; i < characters.length; i++) {
    const char = characters[i];

    if (i > 0) {
      await delay(200);
    }

    try {
      const response = await fetch(char.url, { headers: FETCH_HEADERS });
      if (!response.ok) {
        console.warn(
          `  Warning: Failed to fetch page for "${char.name}" (${response.status}), skipping.`,
        );
        continue;
      }

      const html = await response.text();
      const imageUrl = parseCharacterPage(html);

      if (!imageUrl) {
        console.warn(
          `  Warning: No image found for "${char.name}" at ${char.url}, skipping.`,
        );
        continue;
      }

      results.push({ name: char.name, url: char.url, imageUrl });
      console.log(
        `  [${i + 1}/${characters.length}] ${char.name}: image found`,
      );
    } catch (error) {
      console.warn(
        `  Warning: Error fetching page for "${char.name}": ${error instanceof Error ? error.message : error}, skipping.`,
      );
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

/** CLI options parsed from process.argv */
interface CliOptions {
  urls: string[];
  movie: Movie;
  outputDir: string;
}

/**
 * Parse CLI arguments from process.argv.
 *
 * Expected format:
 *   --urls <URL1> [URL2 ...] --movie <cars1|cars2|cars3> --output <dir>
 */
function parseCliArgs(argv: string[]): CliOptions {
  const args = argv.slice(2); // skip node and script path
  const urls: string[] = [];
  let movie: Movie | undefined;
  let outputDir: string | undefined;

  let i = 0;
  while (i < args.length) {
    switch (args[i]) {
      case "--urls":
        i++;
        while (i < args.length && !args[i].startsWith("--")) {
          urls.push(args[i]);
          i++;
        }
        break;
      case "--movie":
        i++;
        if (
          args[i] !== "cars1" &&
          args[i] !== "cars2" &&
          args[i] !== "cars3"
        ) {
          console.error(
            `Invalid movie value: ${args[i]}. Must be cars1, cars2, or cars3.`,
          );
          process.exit(1);
        }
        movie = args[i] as Movie;
        i++;
        break;
      case "--output":
        i++;
        outputDir = args[i];
        i++;
        break;
      default:
        console.error(`Unknown argument: ${args[i]}`);
        process.exit(1);
    }
  }

  if (urls.length === 0) {
    console.error("Error: --urls requires at least one URL.");
    process.exit(1);
  }
  if (!movie) {
    console.error("Error: --movie is required.");
    process.exit(1);
  }
  if (!outputDir) {
    console.error("Error: --output is required.");
    process.exit(1);
  }

  return { urls, movie, outputDir };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Main entry point for the scraper CLI.
 * Phase 1: Uses the MediaWiki categorymembers API to collect all character titles.
 * Phase 2: Uses the pageimages API to batch-fetch image URLs.
 * Phase 3: Downloads images, converts to WebP, and generates the manifest.
 */
async function main(): Promise<void> {
  const { urls, movie, outputDir } = parseCliArgs(process.argv);

  // Derive the API base URL from the first --urls value
  const apiBaseUrl = deriveApiBaseUrl(urls[0]);
  console.log(`Using MediaWiki API at: ${apiBaseUrl}`);

  // Extract the category title from the first URL path
  // e.g. "https://pixarcars.fandom.com/wiki/Category:Cars_characters" -> "Category:Cars_characters"
  const categoryPath = new URL(urls[0]).pathname;
  const categoryTitle = decodeURIComponent(
    categoryPath.replace(/^\/wiki\//, ""),
  );

  // --- Phase 1: Category members via API ---
  console.log(
    `Phase 1: Fetching category members for "${categoryTitle}" (movie: ${movie})...`,
  );

  let allCharacters: CategoryCharacter[];

  try {
    allCharacters = await fetchCategoryMembersApi(apiBaseUrl, categoryTitle);
  } catch (error) {
    console.error(
      `Error fetching category members:`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  // Deduplicate by character name
  const deduplicated = deduplicateByName(allCharacters);

  console.log(
    `Phase 1 complete: Found ${deduplicated.length} unique characters.`,
  );

  // --- Phase 2: Batch image extraction via API ---
  console.log(
    `Phase 2: Fetching images for ${deduplicated.length} characters via pageimages API...`,
  );

  const charactersWithImages = await fetchCharacterImagesApi(
    apiBaseUrl,
    deduplicated,
  );

  console.log(
    `Phase 2 complete: Found images for ${charactersWithImages.length}/${deduplicated.length} characters.`,
  );

  // --- Phase 3: Image download, WebP conversion, and manifest generation ---
  console.log(
    `Phase 3: Downloading images and generating manifest...`,
  );

  // Create the flat images output directory
  const imagesDir = path.join(path.dirname(outputDir), "images");
  await mkdir(imagesDir, { recursive: true });

  const newCharacters: Character[] = [];

  for (let i = 0; i < charactersWithImages.length; i++) {
    const char = charactersWithImages[i];
    const id = toKebabCase(char.name);
    const outputPath = path.join(imagesDir, `${id}.webp`);

    console.log(
      `  [${i + 1}/${charactersWithImages.length}] Downloading image for "${char.name}"...`,
    );

    try {
      const response = await fetch(char.imageUrl, { headers: FETCH_HEADERS });
      if (!response.ok) {
        console.warn(
          `  Warning: Failed to download image for "${char.name}" (${response.status}), skipping.`,
        );
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Convert to WebP using sharp
      await sharp(buffer).webp().toFile(outputPath);

      newCharacters.push(buildManifestEntry(char.name, movie, id));
      console.log(
        `  [${i + 1}/${charactersWithImages.length}] ${char.name}: saved as ${id}.webp`,
      );
    } catch (error) {
      console.warn(
        `  Warning: Error processing image for "${char.name}": ${error instanceof Error ? error.message : error}, skipping.`,
      );
    }
  }

  // Read existing manifest and merge
  const manifestPath = path.join(path.dirname(outputDir), "characters.json");
  let existingManifest: CharacterManifest = { characters: [] };

  try {
    const existingData = await readFile(manifestPath, "utf-8");
    existingManifest = JSON.parse(existingData) as CharacterManifest;
  } catch {
    // No existing manifest or invalid JSON — start fresh
  }

  // Merge: use id+movie as composite key so the same character can exist
  // in multiple movies (e.g., Lightning McQueen in cars1 and cars2).
  // Only deduplicate within the same movie.
  const mergedMap = new Map<string, Character>();
  for (const char of existingManifest.characters) {
    mergedMap.set(`${char.id}:${char.movie}`, char);
  }
  for (const char of newCharacters) {
    mergedMap.set(`${char.id}:${char.movie}`, char);
  }

  const mergedManifest: CharacterManifest = {
    characters: Array.from(mergedMap.values()),
  };

  await writeFile(manifestPath, JSON.stringify(mergedManifest, null, 2) + "\n");

  console.log(
    `Phase 3 complete: ${newCharacters.length} characters processed, ${mergedManifest.characters.length} total in manifest.`,
  );

  if (newCharacters.length === 0 && charactersWithImages.length > 0) {
    console.warn("Warning: No characters were successfully processed.");
  }

  process.exit(0);
}

main();
