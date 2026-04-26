#!/usr/bin/env node
/**
 * Walk local Nauka “сложные журналы” DOCX corpus, run word importer, write tests/corpus-baseline.json
 */
import { DOMParser } from "xmldom"
globalThis.DOMParser = DOMParser

import { readFile, writeFile, readdir } from "node:fs/promises"
import { join, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { docxXmlToHtml, extractDocxArchiveContext, normalizeImportedHtml } from "../src/word-import.js"
import { computeFileMetrics, HIGHER_IS_BETTER } from "./corpus-metrics.mjs"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const DEFAULT_CORPUS_ROOT = join(fileURLToPath(new URL("../../Docx/Nauka/Сложные журналы", import.meta.url)))

async function walkDocxFiles(dir, out = []) {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      await walkDocxFiles(p, out)
    } else if (
      e.isFile() &&
      e.name.toLowerCase().endsWith(".docx") &&
      !e.name.startsWith("~$")
    ) {
      out.push(p)
    }
  }
  return out
}

function aggregate(files) {
  const keys = Object.keys(HIGHER_IS_BETTER)
  const sums = Object.fromEntries(keys.map((k) => [k, 0]))
  let n = 0
  for (const f of files) {
    if (f.parse_error) continue
    n++
    for (const k of keys) {
      sums[k] += f[k] ?? 0
    }
  }
  const means = Object.fromEntries(keys.map((k) => [k, n ? sums[k] / n : 0]))
  return { files_ok: n, files_error: files.length - n, sums, means }
}

async function main() {
  const root = process.env.CORPUS_DOCX_ROOT || DEFAULT_CORPUS_ROOT
  const files = await walkDocxFiles(root)
  const results = []
  const t0 = new Date().toISOString()

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
      const html = normalizeImportedHtml(rawHtml)
      const metrics = computeFileMetrics(ctx.xmlString, html)
      results.push({
        file: rel,
        ...metrics,
        parse_error: null
      })
    } catch (e) {
      const z = Object.fromEntries(Object.keys(HIGHER_IS_BETTER).map((k) => [k, 0]))
      results.push({
        file: rel,
        ...z,
        math_extraction_rate: 0,
        parse_error: e?.message || String(e)
      })
    }
  }

  const payload = {
    generated_at: t0,
    corpus_root: root,
    file_count: results.length,
    results,
    summary: aggregate(results)
  }

  const outPath = join(__dirname, "../tests/corpus-baseline.json")
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8")
  console.log(`Wrote ${outPath} (${results.length} files, root=${root})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
