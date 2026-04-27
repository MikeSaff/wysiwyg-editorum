#!/usr/bin/env node
/**
 * Walk local Nauka “сложные журналы” DOCX corpus, run word importer, write tests/corpus-baseline.json
 */
import { DOMParser } from "xmldom"
import { parseHTML } from "linkedom"
globalThis.DOMParser = DOMParser

import { mkdir, readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"
import { join, relative } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { docxXmlToHtml, extractDocxArchiveContext, normalizeImportedHtml } from "../src/word-import.js"
import { extractMetadataFromImportedHtml } from "../src/metadata-extract.js"
import { computeFileMetrics, HIGHER_IS_BETTER } from "./corpus-metrics.mjs"
import { resolveCorpusRoot } from "./corpus-root.mjs"

const __dirname = fileURLToPath(new URL(".", import.meta.url))
const DEFAULT_ARTIFACT_DIR = join(__dirname, "../corpus-artifacts")
const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

const CYRILLIC_TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
  й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
  у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
  э: "e", ю: "yu", я: "ya"
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

function textOfParagraph(p) {
  const runs = p.getElementsByTagNameNS(W_NS, "t")
  let out = ""
  for (let i = 0; i < runs.length; i++) out += runs[i].textContent || ""
  return out.replace(/\s+/gu, " ").trim()
}

function getPStyle(p) {
  const pPr = p.getElementsByTagNameNS(W_NS, "pPr")[0]
  const pStyle = pPr?.getElementsByTagNameNS(W_NS, "pStyle")?.[0]
  return (pStyle?.getAttribute("w:val") || pStyle?.getAttributeNS(W_NS, "val") || "").trim() || null
}

function relIdFromDrawing(p) {
  const blips = p.getElementsByTagNameNS(A_NS, "blip")
  const first = blips[0]
  if (!first) return ""
  return first.getAttribute("r:embed") || first.getAttributeNS(R_NS, "embed") || ""
}

function relIdFromOle(p) {
  const oleNodes = p.getElementsByTagName("o:OLEObject")
  const ole = oleNodes[0] || Array.from(p.getElementsByTagName("*")).find((el) => (el.localName || "").toLowerCase() === "oleobject")
  if (!ole) return { rid: "", progId: null }
  return {
    rid: ole.getAttribute("r:id") || ole.getAttributeNS(R_NS, "id") || "",
    progId: ole.getAttribute("ProgID") || ole.getAttribute("progID") || null
  }
}

function likelyCaptionText(text) {
  return /^(?:рис\.?|рисунок|fig\.?|figure|табл\.?|таблица|table)\s*\d+/iu.test(text || "")
}

function classifyImportedAs({ pStyle, rawText, hasImage, hasOle }) {
  const style = pStyle || ""
  if (/^TitleArticle$/iu.test(style)) return "metadata-title"
  if (/^Author$/iu.test(style)) return "metadata-author"
  if (/^(?:Address|EMail|Email)$/iu.test(style)) return "metadata-affiliation"
  if (/^(?:Abstract|Keywords|KeyWords|UDK)$/iu.test(style)) return "metadata-abstract"
  if (/^(?:Reference|References)$/iu.test(style)) return "reference"
  if (/^Heading\d*$/iu.test(style)) return "heading-h2"
  if (/^Equation/iu.test(style) || (hasOle && !rawText)) return "math-block"
  if (hasOle) return "math-inline-host"
  if (hasImage && likelyCaptionText(rawText)) return "figure-block"
  if (hasImage) return "figure-block"
  if (/^(?:FigCaption|Figure)$/iu.test(style) || likelyCaptionText(rawText)) return "fig-caption"
  if (!rawText) return "skipped"
  return "paragraph"
}

function reverseImageRels(ctx) {
  const byData = new Map(Object.entries(ctx.images || {}).map(([target, data]) => [data, target]))
  const out = {}
  for (const [rid, data] of Object.entries(ctx.imageRels || {})) {
    out[rid] = byData.get(data) || null
  }
  return out
}

export function artifactSlug(relPath) {
  const hash = createHash("sha1").update(relPath).digest("hex").slice(0, 8)
  const base = relPath
    .replace(/\.docx$/iu, "")
    .toLowerCase()
    .replace(/[а-яё]/giu, (ch) => CYRILLIC_TRANSLIT[ch.toLowerCase()] ?? "")
    .replace(/[^a-z0-9]+/gu, "_")
    .replace(/^_+|_+$/gu, "")
    .slice(0, 120)
  return `${base || "docx"}_${hash}.jsonl`
}

export function buildCorpusArtifactRecords({ abs, rel, ctx, html, references = [], importVersion = "0.1.0", timestamp = new Date().toISOString() }) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(ctx.xmlString, "application/xml")
  const paragraphs = Array.from(doc.getElementsByTagNameNS(W_NS, "p"))
  const imageTargetByRel = reverseImageRels(ctx)
  const { document: htmlDoc } = parseHTML(`<div id="artifact-root">${html || ""}</div>`)
  const root = htmlDoc.getElementById("artifact-root")
  const header = {
    type: "header",
    docx_path: abs,
    import_v: importVersion,
    import_timestamp: timestamp,
    totals: {
      paragraphs: paragraphs.length,
      formulas_block: root ? root.querySelectorAll(".math-block").length : 0,
      formulas_inline: root ? root.querySelectorAll(".math-inline").length : 0,
      figures: root ? root.querySelectorAll("figure.figure-block").length : 0,
      tables: root ? root.querySelectorAll("table").length : 0,
      references: references.length
    }
  }

  const records = [header]
  let previousCaption = null
  for (let pi = 0; pi < paragraphs.length; pi++) {
    const p = paragraphs[pi]
    const rawText = textOfParagraph(p).slice(0, 500)
    const pStyle = getPStyle(p)
    const imageRel = relIdFromDrawing(p)
    const { rid: oleRel, progId } = relIdFromOle(p)
    const hasImage = Boolean(imageRel)
    const hasOle = Boolean(oleRel)
    records.push({
      pi,
      pStyle,
      raw_text: rawText,
      has_image: hasImage,
      image_target: hasImage ? imageTargetByRel[imageRel] || null : null,
      has_ole: hasOle,
      ole_target: hasOle ? ctx.oleEmbedRels?.[oleRel] || null : null,
      ole_progid: progId,
      preceding_caption: previousCaption,
      imported_as: classifyImportedAs({ pStyle, rawText, hasImage, hasOle })
    })
    previousCaption = likelyCaptionText(rawText) ? rawText : null
  }
  return records
}

export async function writeCorpusArtifact({ artifactDir = DEFAULT_ARTIFACT_DIR, abs, rel, ctx, html, references, importVersion }) {
  await mkdir(artifactDir, { recursive: true })
  const records = buildCorpusArtifactRecords({ abs, rel, ctx, html, references, importVersion })
  const outPath = join(artifactDir, artifactSlug(rel))
  await writeFile(outPath, records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8")
  return outPath
}

async function main() {
  const { root, files } = await resolveCorpusRoot()
  const results = []
  const t0 = new Date().toISOString()

  for (const abs of files.sort()) {
    const rel = relative(root, abs).replace(/\\/g, "/")
    let ctx = null
    let html = ""
    try {
      const buf = await readFile(abs)
      const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
      ctx = await extractDocxArchiveContext(ab)
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
      try {
        globalThis.document = importDocument
        html = normalizeImportedHtml(rawHtml)
      } finally {
        if (prevDocument) globalThis.document = prevDocument
        else delete globalThis.document
      }
      const metrics = computeFileMetrics(ctx.xmlString, html)
      const { document: metaDocument } = parseHTML("<!DOCTYPE html><html><body></body></html>")
      const extraction = extractMetadataFromImportedHtml(html, { rootDocument: metaDocument })
      await writeCorpusArtifact({ abs, rel, ctx, html, references: extraction.references })
      results.push({
        file: rel,
        ...metrics,
        parse_error: null
      })
    } catch (e) {
      if (ctx?.xmlString) {
        try {
          await writeCorpusArtifact({ abs, rel, ctx, html, references: [] })
        } catch (artifactError) {
          console.warn(`[corpus-artifact] failed for ${rel}: ${artifactError?.message || String(artifactError)}`)
        }
      }
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
  if (results.length < 5) throw new Error(`corpus baseline refused: only ${results.length} files were processed`)
  if (results.length > 0 && results.every((row) => row.parse_error)) {
    throw new Error(`corpus baseline refused: all ${results.length} files failed to parse`)
  }

  const outPath = join(__dirname, "../tests/corpus-baseline.json")
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8")
  console.log(`Wrote ${outPath} (${results.length} files, root=${root})`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
