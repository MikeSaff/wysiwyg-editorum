#!/usr/bin/env node
/**
 * Per-DOCX formula quality metrics (empty scripts, LaTeX validity, EMBELL orphans).
 * Writes tests/formula-quality-baseline.json and prints JSON to stdout.
 */
import { writeFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { walkDocxAndScore } from "./formula-quality-lib.mjs"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const DEFAULT_CORPUS_ROOT = join(
  fileURLToPath(new URL("../../Docx/Nauka/Сложные журналы", import.meta.url))
)

async function main() {
  const root = process.env.CORPUS_DOCX_ROOT || DEFAULT_CORPUS_ROOT
  const { files, results, totals } = await walkDocxAndScore(root)

  const payload = {
    generated_at: new Date().toISOString(),
    corpus_root: root,
    file_count: files.length,
    totals,
    results,
  }

  const outPath = join(__dirname, "../tests/formula-quality-baseline.json")
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8")
  console.log(JSON.stringify(payload, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
