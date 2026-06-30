/**
 * Run from project root: node generate.js
 * Converts public/characters.json → js/characters.js
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath  = path.join(__dirname, 'public', 'characters.json');
const outPath   = path.join(__dirname, 'js', 'characters.js');

const data   = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const output = `// Auto-generated from public/characters.json\n// Regenerate: node generate.js\nconst CHARACTERS_DATA = ${JSON.stringify(data.characters, null, 2)};\n`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, output, 'utf8');
console.log('Generated js/characters.js with', data.characters.length, 'characters');
