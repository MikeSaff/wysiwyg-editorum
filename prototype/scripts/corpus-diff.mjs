#!/usr/bin/env node
/**
 * Compare current corpus metrics to tests/corpus-baseline.json — exit 1 on regressions
 */
import { DOMParser } from "xmldom"
import { parseHTML } from "linkedom"
globalThis.DOMParser = DOMParser

import { readFile } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { docxXmlToHtml, extractDocxArchiveContext, normalizeImportedHtml } from "../src/word-import.js"
import { computeFileMetrics, HIGHER_IS_BETTER } from "./corpus-metrics.mjs"
import { walkDocxFiles } from "./corpus-root.mjs"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const DEFAULT_CORPUS_ROOT = join(fileURLToPath(new URL("../../Docx/Nauka/Сложные журналы", import.meta.url)))

async function runCurrent(root) {
  const files = await walkDocxFiles(root)
  const map = new Map()
  for (const abs of files.sort()) {
    const rel = relative(root, abs).replace(/\\/g, "/")
    try {
      const buf = await readFile(abs)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      const ctx = await extractDocxArchiveContext(ab)
      const rawHtml = docxXmlToHtml(
        ctx.xmlString,
        ctx.images,
        ctx.imageRels,
        ctx.footnotes,
        ctx.oleEmbedRels,
        ctx.oleBlobs
      )
      const { document: importDocument } = parseHTML("<!DOCTYPE html><html><body></body></html>")
      const prevDocument = globalThis.document
      let html
      try {
        globalThis.document = importDocument
        html = normalizeImportedHtml(rawHtml)
      } finally {
        if (prevDocument) globalThis.document = prevDocument
        else delete globalThis.document
      }
      map.set(rel, { parse_error: null, ...computeFileMetrics(ctx.xmlString, html) })
    } catch (e) {
      map.set(rel, {
        parse_error: e?.message || String(e),
        ...Object.fromEntries(Object.keys(HIGHER_IS_BETTER).map((k) => [k, 0])),
        math_extraction_rate: 0
      })
    }
  }
  return map
}

async function main() {
  const baselinePath = join(__dirname, "../tests/corpus-baseline.json")
  const baselineRaw = await readFile(baselinePath, "utf8")
  const baseline = JSON.parse(baselineRaw)
  const root = process.env.CORPUS_DOCX_ROOT || baseline.corpus_root || DEFAULT_CORPUS_ROOT

  const current = await runCurrent(root)
  const regressions = []
  const improvements = []

  for (const row of baseline.results) {
    const key = row.file
    const now = current.get(key)
    if (!now) continue

    for (const metric of Object.keys(HIGHER_IS_BETTER)) {
      const before = row[metric]
      const after = now[metric]
      if (typeof before !== "number" || typeof after !== "number") continue
      if (before === after) continue
      const hi = HIGHER_IS_BETTER[metric]
      const worse = hi ? after < before : after > before
      const better = hi ? after > before : after < before
      const delta = after - before
      if (worse) {
        regressions.push({ file: key, metric, before, after, delta })
      } else if (better) {
        improvements.push({ file: key, metric, before, after, delta })
      }
    }

    if (!row.parse_error && now.parse_error) {
      regressions.push({
        file: key,
        metric: "parse_error",
        before: null,
        after: now.parse_error,
        delta: null
      })
    }
  }

  for (const r of regressions) {
    if (r.metric === "parse_error") {
      console.log(`REGRESSION: ${r.file} — parse_error: ${r.after}`)
    } else {
      console.log(
        `REGRESSION: ${r.file} — ${r.metric}: ${r.before} → ${r.after} (${r.delta >= 0 ? "+" : ""}${r.delta})`
      )
    }
  }
  for (const r of improvements) {
    console.log(
      `IMPROVEMENT: ${r.file} — ${r.metric}: ${r.before} → ${r.after} (${r.delta >= 0 ? "+" : ""}${r.delta})`
    )
  }

  if (regressions.length === 0) {
    console.log("No regressions (metrics vs tests/corpus-baseline.json).")
    process.exit(0)
  }
  process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
