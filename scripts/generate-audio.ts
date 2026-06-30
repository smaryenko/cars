/**
 * Build-time audio generation script for Cars Character Swiper.
 *
 * Uses macOS `say` command to generate speech audio for all character names,
 * then converts to M4A (AAC) via macOS built-in `afconvert`.
 *
 * Usage:
 *   tsx scripts/generate-audio.ts
 *   tsx scripts/generate-audio.ts --voices samantha,daniel
 *   tsx scripts/generate-audio.ts --manifest public/characters.json
 *
 * Output structure:
 *   public/audio/<voice-id>/<character-id>.m4a
 *
 * Voices: Samantha (female US), Daniel (male UK), Zarvox (novelty/robot)
 */

import { execSync } from "child_process";
import { existsSync } from "fs";
import { mkdir, readFile, unlink } from "fs/promises";
import path from "path";
import type { CharacterManifest } from "../src/types/index.ts";

interface Voice {
  id: string;
  macName: string;
}

const ALL_VOICES: Voice[] = [
  { id: "samantha", macName: "Samantha" },
  { id: "daniel", macName: "Daniel" },
  { id: "zarvox", macName: "Zarvox" },
];

const AUDIO_BASE_DIR = path.join("public", "audio");
const MAX_CONCURRENCY = 5;

/** Parse CLI arguments. */
function parseArgs(): { voices: Voice[]; manifest: string } {
  const args = process.argv.slice(2);
  let voiceFilter: string[] | null = null;
  let manifest = path.join("public", "characters.json");

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--voices" && args[i + 1]) {
      voiceFilter = args[i + 1].split(",").map((v) => v.trim().toLowerCase());
      i++;
    } else if (args[i] === "--manifest" && args[i + 1]) {
      manifest = args[i + 1];
      i++;
    }
  }

  const voices = voiceFilter
    ? ALL_VOICES.filter((v) => voiceFilter!.includes(v.id))
    : ALL_VOICES;

  if (voices.length === 0) {
    console.error(
      `Error: No valid voices matched. Available: ${ALL_VOICES.map((v) => v.id).join(", ")}`,
    );
    process.exit(1);
  }

  return { voices, manifest };
}

/** Check if a command is available on the system. */
function isCommandAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Generate a single audio file for one character + voice. */
async function generateOne(
  voice: Voice,
  char: { id: string; name: string },
): Promise<"generated" | "skipped" | "failed"> {
  const voiceDir = path.join(AUDIO_BASE_DIR, voice.id);
  const outputFile = path.join(voiceDir, `${char.id}.m4a`);

  // Skip if file already exists (incremental runs)
  if (existsSync(outputFile)) {
    return "skipped";
  }

  const aiffFile = path.join(voiceDir, `${char.id}.aiff`);

  try {
    // Step 1: Generate AIFF with macOS say
    const safeName = char.name.replace(/"/g, '\\"');
    execSync(`say -v "${voice.macName}" -o "${aiffFile}" "${safeName}"`, {
      stdio: "ignore",
      timeout: 30000,
    });

    // Step 2: Convert to M4A (AAC) using macOS built-in afconvert
    execSync(
      `afconvert "${aiffFile}" "${outputFile}" -d aac -f m4af -b 64000`,
      { stdio: "ignore", timeout: 30000 },
    );

    // Clean up intermediate AIFF
    await unlink(aiffFile).catch(() => {});

    return "generated";
  } catch {
    // Clean up any partial files
    await unlink(aiffFile).catch(() => {});
    await unlink(outputFile).catch(() => {});
    return "failed";
  }
}

/** Run tasks with limited concurrency. */
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number,
): Promise<T[]> {
  const results: T[] = [];
  let index = 0;

  async function worker(): Promise<void> {
    while (index < tasks.length) {
      const currentIndex = index++;
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
  return results;
}

async function main(): Promise<void> {
  // Check prerequisites
  if (!isCommandAvailable("say")) {
    console.error(
      "Error: macOS `say` command not found. This script requires macOS.",
    );
    process.exit(1);
  }

  if (!isCommandAvailable("afconvert")) {
    console.error(
      "Error: macOS `afconvert` command not found. This script requires macOS.",
    );
    process.exit(1);
  }

  const { voices, manifest } = parseArgs();

  // Read the character manifest
  const manifestData = await readFile(manifest, "utf-8");
  const manifestJson: CharacterManifest = JSON.parse(manifestData);

  // Deduplicate characters by id (same character can appear in multiple movies)
  const uniqueCharacters = new Map<string, { id: string; name: string }>();
  for (const char of manifestJson.characters) {
    if (!uniqueCharacters.has(char.id)) {
      uniqueCharacters.set(char.id, { id: char.id, name: char.name });
    }
  }

  const characters = Array.from(uniqueCharacters.values());
  const total = voices.length * characters.length;

  console.log(`Found ${characters.length} unique characters.`);
  console.log(
    `Generating audio for ${voices.length} voice(s) × ${characters.length} characters = ${total} files.`,
  );
  console.log(`Output format: M4A (AAC)\n`);

  // Create voice directories
  for (const voice of voices) {
    await mkdir(path.join(AUDIO_BASE_DIR, voice.id), { recursive: true });
  }

  // Build task list
  const tasks: {
    voice: Voice;
    char: { id: string; name: string };
    fn: () => Promise<"generated" | "skipped" | "failed">;
  }[] = [];

  for (const voice of voices) {
    for (const char of characters) {
      tasks.push({
        voice,
        char,
        fn: () => generateOne(voice, char),
      });
    }
  }

  // Execute with concurrency limit
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let processed = 0;

  await runWithConcurrency(
    tasks.map((task) => async () => {
      const result = await task.fn();
      processed++;

      if (result === "generated") generated++;
      else if (result === "skipped") skipped++;
      else failed++;

      // Log progress periodically
      if (processed % 50 === 0 || processed === total) {
        console.log(
          `  [${processed}/${total}] Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`,
        );
      }

      if (result === "failed" && failed <= 5) {
        console.warn(
          `  Warning: Failed to generate audio for "${task.char.name}" with voice ${task.voice.macName}`,
        );
      }

      return result;
    }),
    MAX_CONCURRENCY,
  );

  // Final summary
  console.log(`\n=== Summary ===`);
  console.log(`Generated: ${generated}`);
  console.log(`Skipped (already exist): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${total}`);
  console.log(`Audio format: M4A (AAC)`);
  console.log(`Output directory: ${AUDIO_BASE_DIR}/`);

  if (failed > 0) {
    process.exit(1);
  }
}

main();
