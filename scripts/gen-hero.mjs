/* Generate responsive WebP + AVIF hero backgrounds from the source PNGs.
   Run: node scripts/gen-hero.mjs  */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = [
  ".context/attachments/Vr1Pgy/1cdcfc64-ddf7-4671-ab30-835c36c27cef.png",
  ".context/attachments/ozDRNe/010fa01e-60dc-4dcc-95b5-cd8c39cc8965.png",
  ".context/attachments/tyVCT1/05275bcb-f4ca-4c79-b427-fa3b7acf24a0.png",
  ".context/attachments/Sb8Epc/bbfe3612-aa6d-456b-ac5b-4b648c9c59c7.png",
  ".context/attachments/HEiWgg/c83da73c-779a-4be5-b4ba-87004c4a6ce4.png",
  ".context/attachments/Bk8GAc/c12059a9-fff0-486a-8c8a-0c20d06c8da0.png",
  ".context/attachments/5nJOJf/Midnight glass analytics with amber light.png",
];
const WIDTHS = [768, 1152, 1672];
const OUT = "public/images/hero";
mkdirSync(OUT, { recursive: true });

for (let i = 0; i < SRC.length; i++) {
  for (const w of WIDTHS) {
    const pipe = sharp(SRC[i]).resize({ width: w, withoutEnlargement: true });
    await pipe.clone().webp({ quality: 74, effort: 5 }).toFile(`${OUT}/slide-${i + 1}-${w}.webp`);
    await pipe.clone().avif({ quality: 50, effort: 4 }).toFile(`${OUT}/slide-${i + 1}-${w}.avif`);
  }
  console.log(`slide-${i + 1} done`);
}
