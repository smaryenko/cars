/**
 * Generate quiz feedback sounds for all 3 voices using macOS `say` + `afconvert`.
 */
import { execSync } from "child_process";
import { unlinkSync, existsSync } from "fs";

const VOICES: Record<string, string> = {
  samantha: "Samantha",
  daniel: "Daniel",
  fred: "Fred",
};

const CORRECT = ["Yay!", "That's right!", "High five!", "Awesome!", "You got it!"];
const WRONG = ["Oh no!", "Try again!", "Oops!", "Not quite!", "Nope!"];

function generate(voiceId: string, macVoice: string, prefix: string, phrases: string[]) {
  for (let i = 0; i < phrases.length; i++) {
    const text = phrases[i];
    const wavPath = `public/audio/${voiceId}/${prefix}-${i}.wav`;
    const m4aPath = `public/audio/${voiceId}/${prefix}-${i}.m4a`;

    if (existsSync(m4aPath)) {
      console.log(`  Skip (exists): ${m4aPath}`);
      continue;
    }

    console.log(`  ${macVoice}: "${text}" → ${m4aPath}`);
    try {
      execSync(`say -v "${macVoice}" -o "${wavPath}" --data-format=LEI16@22050 "${text}"`, { stdio: "pipe" });
      execSync(`afconvert -d aac -f m4af -b 32000 "${wavPath}" "${m4aPath}"`, { stdio: "pipe" });
      unlinkSync(wavPath);
    } catch (err) {
      console.warn(`  Error: ${err instanceof Error ? err.message : err}`);
    }
  }
}

for (const [voiceId, macVoice] of Object.entries(VOICES)) {
  console.log(`Generating quiz sounds for ${macVoice}...`);
  generate(voiceId, macVoice, "quiz-correct", CORRECT);
  generate(voiceId, macVoice, "quiz-wrong", WRONG);
}

console.log("Done!");
