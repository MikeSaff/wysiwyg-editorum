import { readdir } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = fileURLToPath(new URL("../..", import.meta.url))
const DEFAULT_COMPLEX_ROOT = join(REPO_ROOT, "Docx", "Nauka", "Сложные журналы")
const DEFAULT_NAUKA_ROOT = join(REPO_ROOT, "Docx", "Nauka")

export async function walkDocxFiles(dir, out = []) {
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

export async function resolveCorpusRoot(env = process.env) {
  const candidates = [
    env.CORPUS_DOCX_ROOT ? resolve(env.CORPUS_DOCX_ROOT) : "",
    DEFAULT_COMPLEX_ROOT,
    DEFAULT_NAUKA_ROOT,
  ].filter(Boolean)

  for (const candidate of candidates) {
    const files = await walkDocxFiles(candidate)
    if (files.length >= 5) return { root: candidate, files }
    if (env.CORPUS_DOCX_ROOT) {
      return abortSparseCorpus(candidate, files.length)
    }
  }

  return abortSparseCorpus(candidates[candidates.length - 1] || DEFAULT_COMPLEX_ROOT, 0)
}

export function abortSparseCorpus(root, count) {
  throw new Error(
    `CORPUS_DOCX_ROOT resolved to ${root}, but only ${count} docx found. Set CORPUS_DOCX_ROOT explicitly or fix path`
  )
}

export function isAllZeroFormulaQualityBaseline(baseline) {
  const totals = baseline?.totals
  if (!totals || typeof totals !== "object") return true
  const numeric = Object.entries(totals).filter(([, value]) => typeof value === "number")
  return numeric.length > 0 && numeric.every(([, value]) => value === 0)
}

export function assertUsefulBaseline(payload, label = "baseline") {
  const fileCount = Number(payload?.file_count || 0)
  const rows = payload?.results || payload?.per_file || []
  const parseErrors = Array.isArray(rows) ? rows.filter((row) => row?.parse_error).length : 0
  if (fileCount < 5) {
    throw new Error(`${label} refused: only ${fileCount} files were processed`)
  }
  if (Array.isArray(rows) && rows.length > 0 && parseErrors === rows.length) {
    throw new Error(`${label} refused: all ${rows.length} files failed to parse`)
  }
  if (isAllZeroFormulaQualityBaseline(payload)) {
    throw new Error(`${label} refused: totals are all zero`)
  }
}
