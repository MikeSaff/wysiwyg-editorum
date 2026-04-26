/**
 * Extract publication metadata + references from normalized import HTML;
 * returns cleaned body HTML for ProseMirror (main IMRAD content only).
 */
import { detectSectionType } from "./section-heading.js"
import { emptyMeta } from "./document-model.js"

const BODY_HEADING_TYPES = new Set(["introduction", "methods", "results", "discussion", "conclusion"])

const BACK_SECTION_TO_META = {
  funding: "fundingInfo",
  author_info: "authorInfo",
  author_contributions: "authorContributions",
  acknowledgments: "acknowledgments",
  conflicts: "conflictsOfInterest"
}

function plainText(el) {
  return (el.textContent || "").replace(/\s+/gu, " ").trim()
}

function extractDoiFromString(s) {
  const m = String(s).match(/\b(10\.\d{4,9}\/[^\s"'<>[\]]+)\b/i)
  if (!m) return ""
  return m[1].replace(/[.,;:\])]+$/u, "")
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `id-${Math.random().toString(36).slice(2, 11)}`
}

function compactSpacedInitials(part) {
  let out = part
  let prev
  do {
    prev = out
    out = out.replace(/([А-ЯA-ZЁA-Za-z])\s*\.\s*([А-ЯA-ZЁA-Za-z])\s*\./gu, "$1.$2.")
  } while (out !== prev)
  return out
}

function parseAuthorsLine(raw) {
  const authors = []
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean)
  for (let part of parts) {
    let affRefs = []
    if (/\*+$/.test(part)) {
      affRefs = ["1"]
      part = part.replace(/\*+$/u, "").trim()
    }
    part = compactSpacedInitials(part)
    let m = part.match(/^([А-ЯA-ZЁ]\.[А-ЯA-ZЁ]?\.\s+)(.+)$/u)
    if (!m) m = part.match(/^([А-ЯA-ZЁ]\.\s+)(.+)$/u)
    if (!m) continue
    const initials = m[1].replace(/\s+/gu, " ").trim()
    const rest = m[2].trim()
    const surname = (rest.split(/\s+/u)[0] || rest).replace(/[,;]+$/u, "")
    authors.push({
      id: newId(),
      fullName: `${initials} ${rest}`.trim(),
      initials,
      surname,
      affRefs,
      email: "",
      orcid: ""
    })
  }
  return authors
}

function headingSectionType(el) {
  if (!/^h[1-4]$/iu.test(el.tagName || "")) return null
  const attr = el.getAttribute("data-section-type")
  if (attr) return attr
  return detectSectionType(plainText(el))
}

/**
 * @param {string} html
 * @param {{ rootDocument?: Document }} [options]
 * @returns {{ meta: import("./document-model.js").EMPTY_META, references: Array<{id:string,raw:string,doi?:string,parsed:null}>, cleanedBody: string }}
 */
export function extractMetadataFromImportedHtml(html, options = {}) {
  const rootDoc = options.rootDocument ?? (typeof document !== "undefined" ? document : null)
  const miss = (msg) => console.info("[metadata]", msg)

  if (!rootDoc || !html) {
    miss("extract skipped: no DOM or empty html")
    return { meta: emptyMeta(), references: [], cleanedBody: html || "" }
  }

  const holder = rootDoc.createElement("div")
  holder.innerHTML = html
  const blocks = Array.from(holder.children)
  if (blocks.length === 0) {
    miss("no top-level blocks after parse")
    return { meta: emptyMeta(), references: [], cleanedBody: html }
  }

  const meta = emptyMeta()
  const references = []
  const remove = new Set()

  let firstBody = -1
  for (let i = 0; i < blocks.length; i++) {
    const st = headingSectionType(blocks[i])
    if (st && BODY_HEADING_TYPES.has(st)) {
      firstBody = i
      break
    }
  }
  if (firstBody < 0) {
    miss("no IMRAD heading (introduction/methods/…) — keeping preamble in body")
  } else {
    for (let z = 0; z < firstBody; z++) {
      const el = blocks[z]
      const t = plainText(el)
      const tag = (el.tagName || "").toLowerCase()
      const kwMatch = t.match(/^ключевые\s*слова[:\\s]*(.+)$/iu) || t.match(/^keywords[:\\s]*(.+)$/iu)
      const emailMatch = t.match(/\b([a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/)
      const cls = (el.getAttribute("class") || "").toLowerCase()

      if (
        cls.includes("style-title-article") ||
        (tag === "h1" && el.getAttribute("data-section-type") === "title")
      ) {
        if (t) {
          const hasCyr = /[\u0400-\u04FF]/.test(t)
          const hasLat = /[A-Za-z]{3,}/.test(t)
          if (hasCyr && hasLat) meta.title.ru = t
          else if (!hasCyr && hasLat) meta.title.en = t
          else meta.title.ru = t
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-author")) {
        const parsed = parseAuthorsLine(t)
        if (parsed.length) meta.authors = parsed
        remove.add(z)
        continue
      }
      if (cls.includes("style-affiliation")) {
        if (t) {
          meta.affiliations.push({ id: "aff-1", text: t, city: "", country: "", ror: "" })
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-email")) {
        if (emailMatch && meta.authors[0] && !meta.authors[0].email) {
          meta.authors[0].email = emailMatch[1]
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-abstract")) {
        if (t) meta.abstract.ru = el.innerHTML.trim()
        remove.add(z)
        continue
      }
      if (cls.includes("style-keywords")) {
        if (kwMatch) {
          meta.keywords.ru = kwMatch[1].split(/[,;]/u).map((s) => s.trim()).filter(Boolean)
        } else if (t) {
          meta.keywords.ru = t.split(/[,;]/u).map((s) => s.trim()).filter(Boolean)
        }
        remove.add(z)
        continue
      }

      if (z === 0 && t.length >= 20 && t.length <= 600 && !el.querySelector("table,img,.math-block")) {
        const hasCyr = /[\u0400-\u04FF]/.test(t)
        const hasLat = /[A-Za-z]{3,}/.test(t)
        if (hasCyr && hasLat) meta.title.ru = t
        else if (!hasCyr && hasLat) meta.title.en = t
        else meta.title.ru = t
      } else if (
        tag === "p" &&
        !meta.authors.length &&
        t.includes(",") &&
        (/[А-ЯA-ZЁ]\.[А-ЯA-ZЁ]?\./u.test(t) || /[А-ЯA-ZЁ]\.\s+[А-ЯA-ZЁ]\./u.test(t)) &&
        t.length < 500
      ) {
        const parsed = parseAuthorsLine(t)
        if (parsed.length) meta.authors = parsed
      } else if (
        tag === "p" &&
        !meta.affiliations.length &&
        t.length > 24 &&
        t.length < 800 &&
        !emailMatch &&
        /«|»|объединение|институт|университет|лаборатори|academy|university|NPO|LLC/i.test(t)
      ) {
        meta.affiliations.push({ id: "aff-1", text: t, city: "", country: "", ror: "" })
      } else if (tag === "p" && emailMatch) {
        if (meta.authors[0] && !meta.authors[0].email) meta.authors[0].email = emailMatch[1]
      } else if (tag === "p" && kwMatch) {
        meta.keywords.ru = kwMatch[1].split(/[,;]/u).map((s) => s.trim()).filter(Boolean)
      } else if (
        tag === "p" &&
        t.length > 200 &&
        !kwMatch &&
        !emailMatch &&
        !/^рис\.|^рисунок|^табл|^таблица|^doi|^удк/i.test(t) &&
        !el.querySelector("table,img,.math-block")
      ) {
        if (!meta.abstract.ru) meta.abstract.ru = el.innerHTML.trim()
        else meta.abstract.ru += "\n\n" + el.innerHTML.trim()
      }

      remove.add(z)
    }
  }

  let j = firstBody >= 0 ? firstBody : 0
  while (j < blocks.length) {
    const el = blocks[j]
    const st = headingSectionType(el)
    if (!st) {
      j++
      continue
    }

    if (st === "references") {
      let k = j + 1
      let n = 0
      while (k < blocks.length) {
        const b = blocks[k]
        if (/^h[1-4]$/iu.test(b.tagName || "")) break
        const bt = (b.tagName || "").toLowerCase()
        if (bt === "p") {
          n++
          references.push({
            id: `ref-${n}`,
            raw: b.innerHTML,
            doi: extractDoiFromString((b.innerHTML || "") + (b.textContent || "")) || undefined,
            parsed: null
          })
          remove.add(k)
        }
        k++
      }
      remove.add(j)
      j = k
      continue
    }

    const mk = BACK_SECTION_TO_META[st]
    if (mk) {
      const chunks = []
      let k = j + 1
      while (k < blocks.length) {
        const b = blocks[k]
        if (/^h[1-4]$/iu.test(b.tagName || "")) break
        chunks.push(b.outerHTML)
        remove.add(k)
        k++
      }
      meta[mk] = chunks.join("\n").trim()
      remove.add(j)
      j = k
      continue
    }

    j++
  }

  if (!meta.title.ru && !meta.title.en) miss("title not detected")
  if (!meta.authors.length) miss("authors not detected")
  if (!meta.affiliations.length) miss("affiliations not detected")
  if (!meta.abstract.ru) miss("abstract not detected")
  if (!meta.keywords.ru.length) miss("keywords not detected")
  if (!references.length) miss("references not detected")

  const kept = blocks.filter((_, idx) => !remove.has(idx))
  const out = rootDoc.createElement("div")
  for (const el of kept) out.appendChild(el.cloneNode(true))

  return {
    meta,
    references,
    cleanedBody: out.innerHTML
  }
}

/**
 * Merge DOCX extraction into an existing envelope (import).
 * @param {{ meta: object, references: unknown[] }} envelope
 * @param {{ meta?: object, references?: unknown[] } | null | undefined} extraction
 */
export function mergeExtractedPublication(envelope, extraction) {
  if (!extraction) return
  const sm = extraction.meta
  if (sm && typeof sm === "object") {
    if (sm.title && (sm.title.ru || sm.title.en)) {
      envelope.meta.title = { ...envelope.meta.title, ...sm.title }
    }
    if (Array.isArray(sm.authors) && sm.authors.length) envelope.meta.authors = sm.authors
    if (Array.isArray(sm.affiliations) && sm.affiliations.length) envelope.meta.affiliations = sm.affiliations
    if (sm.abstract && (sm.abstract.ru || sm.abstract.en)) {
      envelope.meta.abstract = { ...envelope.meta.abstract, ...sm.abstract }
    }
    if (sm.keywords && (sm.keywords.ru?.length || sm.keywords.en?.length)) {
      envelope.meta.keywords = {
        ru: sm.keywords.ru?.length ? [...sm.keywords.ru] : envelope.meta.keywords.ru,
        en: sm.keywords.en?.length ? [...sm.keywords.en] : envelope.meta.keywords.en
      }
    }
    for (const k of ["udk", "doi", "publicationDate", "fundingInfo", "authorInfo", "authorContributions", "acknowledgments", "conflictsOfInterest"]) {
      if (sm[k]) envelope.meta[k] = sm[k]
    }
  }
  if (Array.isArray(extraction.references) && extraction.references.length) {
    envelope.references = extraction.references
  }
}

