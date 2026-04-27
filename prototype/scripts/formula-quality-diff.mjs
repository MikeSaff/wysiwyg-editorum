#!/usr/bin/env node
/**
 * Compare current formula-quality totals to tests/formula-quality-baseline.json.
 * Exit 1 if any "lower is better" metric worsens vs baseline totals.
 */
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { walkDocxAndScore } from "./formula-quality-lib.mjs"

const __dirname = fileURLToPath(new URL(".", import.meta.url))

/** @type {Record<string, boolean>} true = larger is better */
const HIGHER_IS_BETTER = {
  formulas_total: true,
}

async function main() {
  const baselinePath = join(__dirname, "../tests/formula-quality-baseline.json")
  const baselineRaw = await readFile(baselinePath, "utf8")
  const baseline = JSON.parse(baselineRaw)
  const root = process.env.CORPUS_DOCX_ROOT || baseline.corpus_root

  const { totals: now } = await walkDocxAndScore(root)
  const regressions = []

  for (const key of Object.keys(now)) {
    const before = baseline.totals[key]
    const after = now[key]
    if (typeof before !== "number" || typeof after !== "number") continue
    if (before === after) continue
    const hi = HIGHER_IS_BETTER[key]
    const worse = hi ? after < before : after > before
    if (worse) {
      regressions.push({ metric: key, before, after, delta: after - before })
    }
  }

  for (const r of regressions) {
    console.log(
      `REGRESSION: ${r.metric}: ${r.before} → ${r.after} (${r.delta >= 0 ? "+" : ""}${r.delta})`
    )
  }

  if (regressions.length === 0) {
    console.log("No formula-quality regressions vs tests/formula-quality-baseline.json")
    process.exit(0)
  }
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
