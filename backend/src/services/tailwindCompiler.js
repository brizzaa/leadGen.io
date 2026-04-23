import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, unlinkSync } from "fs";

const BASE = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const TMP_INPUT = join(BASE, "_tw_compile_tmp.css");
const CSS_INPUT = '@import "tailwindcss";';

let cached = null;

export async function getTailwindCSS() {
  if (cached) return cached;
  writeFileSync(TMP_INPUT, CSS_INPUT);
  try {
    const result = await postcss([tailwindcss({ base: BASE })]).process(CSS_INPUT, { from: TMP_INPUT });
    // Minify: strip comments, collapse whitespace
    cached = result.css
      .replace(/\/\*[^*]*\*+(?:[^/*][^*]*\*+)*\//g, "")
      .replace(/\s+/g, " ")
      .trim();
    return cached;
  } finally {
    try { unlinkSync(TMP_INPUT); } catch {}
  }
}
