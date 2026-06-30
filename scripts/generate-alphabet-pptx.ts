/**
 * Generate a Cars Alphabet PowerPoint presentation - all 26 letters.
 */
import { createRequire } from "module";
import path from "path";
import { execSync } from "child_process";

const require = createRequire(import.meta.url);
const Pptx = require("pptxgenjs");

const ALPHABET = [
  { letter: "A", name: "Acer", id: "acer" },
  { letter: "B", name: "Boost", id: "boost" },
  { letter: "C", name: "Cruz Ramirez", id: "cruz-ramirez" },
  { letter: "D", name: "Doc Hudson", id: "doc-hudson" },
  { letter: "E", name: "Elvis", id: "elvis" },
  { letter: "F", name: "Fillmore", id: "fillmore" },
  { letter: "G", name: "Guido", id: "guido" },
  { letter: "H", name: "Holley Shiftwell", id: "holley-shiftwell" },
  { letter: "I", name: "I-Screamer", id: "i-screamer" },
  { letter: "J", name: "Jackson Storm", id: "jackson-storm" },
  { letter: "K", name: "Kabuto", id: "kabuto" },
  { letter: "L", name: "Lightning McQueen", id: "lightning-mcqueen" },
  { letter: "M", name: "Mater", id: "mater" },
  { letter: "N", name: "Nigel Gearsley", id: "nigel-gearsley" },
  { letter: "O", name: "Okuni, Shigeko, & Tamiko", id: "okuni-shigeko-tamiko" },
  { letter: "P", name: "Ponchy Wipeout", id: "ponchy-wipeout" },
  { letter: "Q", name: "Queen Elizabeth II", id: "queen-elizabeth-ii" },
  { letter: "R", name: "Ramone", id: "ramone" },
  { letter: "S", name: "Sally Carrera", id: "sally-carrera" },
  { letter: "T", name: "Tex Dinoco", id: "tex-dinoco" },
  { letter: "U", name: "Uncle Topolino", id: "uncle-topolino" },
  { letter: "V", name: "Van", id: "van" },
  { letter: "W", name: "Woody", id: "woody" },
  { letter: "X", name: "Xanadu Bumpers", id: "xanadu-bumpers" },
  { letter: "Y", name: "Yeti", id: "yeti" },
  { letter: "Z", name: "Zen Master", id: "zen-master" },
];

// 26 distinct colors that are visible on sky blue (#87CEEB) background
const COLORS = [
  "E63946", // red
  "6A0572", // purple
  "FF6B35", // orange
  "1D3557", // dark blue
  "2D6A4F", // forest green
  "9B2226", // dark red
  "7209B7", // violet
  "E76F51", // coral
  "264653", // dark teal
  "B5179E", // magenta
  "F4A261", // amber
  "2B2D42", // charcoal
  "D62828", // crimson
  "6B705C", // olive
  "9C6644", // brown
  "3A0CA3", // indigo
  "E63946", // red
  "023E8A", // navy
  "BC4749", // brick
  "5F0F40", // maroon
  "38B000", // green
  "7B2CBF", // purple
  "D00000", // bright red
  "6930C3", // deep purple
  "DC2F02", // red-orange
  "184E77", // dark cyan
];

function getImageSize(imgPath: string): { w: number; h: number } {
  const result = execSync(
    `node --eval "const sharp=require('sharp');sharp('${imgPath}').metadata().then(m=>console.log(m.width+' '+m.height))"`,
    { encoding: "utf8" }
  ).trim();
  const [w, h] = result.split(" ").map(Number);
  return { w, h };
}

const pptx = new Pptx();
pptx.layout = "LAYOUT_16x9";

const SLIDE_W = 10;
const MAX_IMG_W = 6;
const MAX_IMG_H = 4;

for (let i = 0; i < ALPHABET.length; i++) {
  const { letter, name, id } = ALPHABET[i];
  const color = COLORS[i % COLORS.length];
  const slide = pptx.addSlide();

  slide.background = { color: "87CEEB" };

  // Letter - top left corner
  slide.addText(letter, {
    x: 0.3,
    y: 0.2,
    w: 1.5,
    h: 1.5,
    fontSize: 80,
    fontFace: "Arial Rounded MT Bold",
    color: color,
    bold: true,
    align: "center",
    valign: "middle",
  });

  // Get actual image dimensions
  const imgPath = path.resolve(`public/images/${id}.webp`);
  let displayW = MAX_IMG_W;
  let displayH = MAX_IMG_H;

  try {
    const { w: imgW, h: imgH } = getImageSize(imgPath);
    const aspect = imgW / imgH;
    displayW = MAX_IMG_W;
    displayH = displayW / aspect;
    if (displayH > MAX_IMG_H) {
      displayH = MAX_IMG_H;
      displayW = displayH * aspect;
    }
  } catch {
    console.warn(`  Warning: Could not get size for ${id}, using default`);
  }

  // Center image
  const imgX = (SLIDE_W - displayW) / 2;
  const imgY = 1.2;

  slide.addImage({
    path: imgPath,
    x: imgX,
    y: imgY,
    w: displayW,
    h: displayH,
  });

  // Character name - below image, same color as letter
  slide.addText(name, {
    x: 1,
    y: imgY + displayH + 0.1,
    w: 8,
    h: 1.2,
    fontSize: 44,
    fontFace: "Arial Rounded MT Bold",
    color: color,
    bold: true,
    align: "center",
    valign: "middle",
  });

  console.log(`  ${letter} - ${name} (${color})`);
}

const outPath = path.resolve("cars-alphabet.pptx");
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log(`\nCreated: ${outPath}`);
});
