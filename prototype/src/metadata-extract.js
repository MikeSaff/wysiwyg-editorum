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

function toIsoDateFlexible(s) {
  const t = (s || "").trim().replace(/\s+/gu, " ")
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) {
    const dd = m[1].padStart(2, "0")
    const mm = m[2].padStart(2, "0")
    return `${m[3]}-${mm}-${dd}`
  }
  const m2 = t.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m2) return t.slice(0, 10)
  return t
}

function authorPlainWithSupStars(el) {
  return (el.innerHTML || "")
    .replace(/<sup>\s*\*+\s*<\/sup>/gi, "*")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/gu, " ")
    .trim()
}

function stripEmailLinesFromText(t) {
  return t
    .replace(/\*?\s*e[\-\s]?mail\s*[:=]\s*\S+@\S+\.?\s*/giu, "")
    .replace(/\s+/gu, " ")
    .trim()
}

function extractEmailFromAffiliationPlain(t) {
  const m = t.match(/\*?\s*e[\-\s]?mail\s*[:=]\s*(\S+@\S+)/i)
  return m ? m[1] : ""
}

function assignEmailToAuthors(meta, email, opts) {
  const { paragraphStarred } = opts
  const authors = meta.authors
  if (!email || !authors.length) return
  const corr = authors.filter((a) => a.isCorresponding)
  if (paragraphStarred) {
    if (corr.length === 1) {
      corr[0].email = email
      return
    }
    if (corr.length === 0 && authors.length === 1) {
      authors[0].email = email
      authors[0].isCorresponding = true
      return
    }
    if (corr.length === 0) {
      console.warn("[metadata] starred e-mail paragraph but no * on author line")
      return
    }
    console.warn("[metadata] starred e-mail but several corresponding authors — skip")
    return
  }
  if (authors.length === 1) {
    authors[0].email = email
    return
  }
  console.warn("[metadata] multiple authors, unmarked e-mail — skip assignment")
}

/**
 * Pleiades `Abstract` style: one <p> may contain real abstract + received/accepted + keywords.
 * DocumentJSON §5: abstracts.* only narrative abstract; keywords and dates go elsewhere.
 */
function ingestPleiadesStyleAbstractElement(el, meta) {
  const plainFull = plainText(el)
  const markerRe =
    /(?=Поступила в редакцию|После доработки|Принята к публикации|Ключевые\s*слова|Received\b|Revised\b|Accepted\b|Keywords\b)/giu
  const hasMeta = markerRe.test(plainFull)
  markerRe.lastIndex = 0
  if (!hasMeta) {
    const h = el.innerHTML.trim()
    if (h) {
      meta.abstract.ru = h
      meta.abstracts.ru = plainFull || h.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim()
    }
    return
  }
  const segments = plainFull
    .split(markerRe)
    .map((s) => s.trim())
    .filter(Boolean)
  const abstractParts = []
  for (const seg of segments) {
    let m = seg.match(/^Поступила в редакцию\s+(.+)$/iu)
    if (m) {
      meta.dates.received = toIsoDateFlexible(m[1].trim().replace(/\.+$/u, ""))
      continue
    }
    m = seg.match(/^После доработки\s+(.+)$/iu)
    if (m) {
      meta.dates.revised = toIsoDateFlexible(m[1].trim().replace(/\.+$/u, ""))
      continue
    }
    m = seg.match(/^Принята к публикации\s+(.+)$/iu)
    if (m) {
      meta.dates.accepted = toIsoDateFlexible(m[1].trim().replace(/\.+$/u, ""))
      continue
    }
    m = seg.match(/^Ключевые\s*слова[:\s.]?\s*(.+)$/iu)
    if (m) {
      meta.keywords.ru = m[1].split(/[,;]/u).map((s) => s.trim()).filter(Boolean)
      continue
    }
    m = seg.match(/^Received\s+(.+)$/iu)
    if (m) {
      if (!meta.dates.received) {
        meta.dates.received = toIsoDateFlexible(m[1].trim().replace(/\.+$/u, ""))
      }
      continue
    }
    m = seg.match(/^Revised\s+(.+)$/iu)
    if (m) {
      meta.dates.revised = toIsoDateFlexible(m[1].trim().replace(/\.+$/u, ""))
      continue
    }
    m = seg.match(/^Accepted\s+(.+)$/iu)
    if (m) {
      if (!meta.dates.accepted) {
        meta.dates.accepted = toIsoDateFlexible(m[1].trim().replace(/\.+$/u, ""))
      }
      continue
    }
    m = seg.match(/^Keywords[:\s.]?\s*(.+)$/iu)
    if (m) {
      meta.keywords.en = m[1].split(/[,;]/u).map((s) => s.trim()).filter(Boolean)
      continue
    }
    abstractParts.push(seg)
  }
  if (abstractParts.length) {
    const joined = abstractParts.join("\n\n").trim()
    meta.abstract.ru = joined
    meta.abstracts.ru = joined
  }
}

function buildContributorsFromAuthors(authors) {
  return authors.map((a) => ({
    id: a.id,
    email: a.email || "",
    is_corresponding: !!a.isCorresponding,
    affiliation_ids: (a.affRefs || []).map((r) => `aff_${r}`),
  }))
}

/** Pleiades second metadata block (English): Latin-heavy, almost no Cyrillic. */
function isLikelyEnglishParagraphText(t) {
  const s = (t || "").trim()
  if (!s) return false
  const lat = (s.match(/[A-Za-z]/g) || []).length
  const cyr = (s.match(/[\u0400-\u04FF]/g) || []).length
  if (lat + cyr === 0) return false
  return lat / (lat + cyr) > 0.5 && cyr / (lat + cyr) < 0.1
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
      isCorresponding: affRefs.length > 0,
      email: "",
      orcid: "",
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
  /** After a second English title-article, map Author/Abstract/Keywords into *En fields */
  let englishMetaActive = false

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
          if (englishMetaActive) {
            if (hasLat) meta.title.en = t
          } else if (!meta.title.ru) {
            if (hasCyr && hasLat) meta.title.ru = t
            else if (!hasCyr && hasLat) meta.title.en = t
            else meta.title.ru = t
          } else if (!meta.title.en && isLikelyEnglishParagraphText(t)) {
            meta.title.en = t
            englishMetaActive = true
          }
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-author")) {
        const authPlain = authorPlainWithSupStars(el)
        const parsed = parseAuthorsLine(authPlain || t)
        if (parsed.length) {
          if (englishMetaActive) meta.authorsEn = parsed
          else meta.authors = parsed
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-affiliation")) {
        const emailAddr = extractEmailFromAffiliationPlain(t)
        const paragraphStarred = /^\s*\*/.test(t) || /<sup>\s*\*+/iu.test(el.innerHTML || "")
        const affText = stripEmailLinesFromText(t)
        if (emailAddr) assignEmailToAuthors(meta, emailAddr, { paragraphStarred })
        if (affText) {
          meta.affiliations.push({ id: "aff_1", text: affText, city: "", country: "", ror: "" })
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-email")) {
        if (emailMatch) {
          const paragraphStarred = /^\s*\*/.test(t) || /<sup>\s*\*+/iu.test(el.innerHTML || "")
          assignEmailToAuthors(meta, emailMatch[1], { paragraphStarred })
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-abstract")) {
        if (englishMetaActive) {
          const plainFull = plainText(el)
          const h = el.innerHTML.trim()
          if (h) {
            meta.abstract.en = h
            meta.abstracts.en =
              plainFull || h.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ").trim()
          }
        } else {
          ingestPleiadesStyleAbstractElement(el, meta)
        }
        remove.add(z)
        continue
      }
      if (cls.includes("style-keywords")) {
        if (englishMetaActive) {
          if (kwMatch) {
            meta.keywords.en = kwMatch[1].split(/[,;]/u).map((s) => s.trim()).filter(Boolean)
          } else if (t) {
            meta.keywords.en = t.split(/[,;]/u).map((s) => s.trim()).filter(Boolean)
          }
        } else if (kwMatch) {
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
        meta.affiliations.push({ id: "aff_1", text: t, city: "", country: "", ror: "" })
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

  meta.contributors = buildContributorsFromAuthors(meta.authors)
  if (meta.authorsEn.length) {
    meta.contributorsEn = buildContributorsFromAuthors(meta.authorsEn)
  }

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
    if (sm.abstracts && (sm.abstracts.ru || sm.abstracts.en)) {
      envelope.meta.abstracts = { ...envelope.meta.abstracts, ...sm.abstracts }
    }
    if (sm.keywords && (sm.keywords.ru?.length || sm.keywords.en?.length)) {
      envelope.meta.keywords = {
        ru: sm.keywords.ru?.length ? [...sm.keywords.ru] : envelope.meta.keywords.ru,
        en: sm.keywords.en?.length ? [...sm.keywords.en] : envelope.meta.keywords.en
      }
    }
    if (sm.dates && typeof sm.dates === "object") {
      envelope.meta.dates = { ...envelope.meta.dates, ...sm.dates }
    }
    if (Array.isArray(sm.contributors) && sm.contributors.length) {
      envelope.meta.contributors = sm.contributors
    }
    if (Array.isArray(sm.authorsEn) && sm.authorsEn.length) envelope.meta.authorsEn = sm.authorsEn
    if (Array.isArray(sm.contributorsEn) && sm.contributorsEn.length) {
      envelope.meta.contributorsEn = sm.contributorsEn
    }
    for (const k of ["udk", "doi", "publicationDate", "fundingInfo", "authorInfo", "authorContributions", "acknowledgments", "conflictsOfInterest"]) {
      if (sm[k]) envelope.meta[k] = sm[k]
    }
  }
  if (Array.isArray(extraction.references) && extraction.references.length) {
    envelope.references = extraction.references
  }
}

