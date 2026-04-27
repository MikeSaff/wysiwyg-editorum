function clone(obj) {
  if (typeof structuredClone === "function") return structuredClone(obj)
  return JSON.parse(JSON.stringify(obj))
}

export const EMPTY_META = {
  title: { ru: "", en: "" },
  authors: [],
  /** Second Pleiades metadata block (English); DocumentJSON extension */
  authorsEn: [],
  affiliations: [],
  abstract: { ru: "", en: "" },
  /** DocumentJSON §5 — same text as abstract.* for prototype envelope compatibility */
  abstracts: { ru: "", en: "" },
  keywords: { ru: [], en: [] },
  /** DocumentJSON §6.1 — minimal contributor rows (full shape filled by Editorum) */
  contributors: [],
  contributorsEn: [],
  dates: {
    received: "",
    accepted: "",
    published_online: "",
    published_print: "",
    /** extension — not in base SPEC table */
    revised: "",
  },
  udk: "",
  doi: "",
  publicationDate: "",
  fundingInfo: "",
  authorInfo: "",
  authorContributions: "",
  acknowledgments: "",
  conflictsOfInterest: "",
}

export function emptyMeta() {
  return clone(EMPTY_META)
}

export function createEmptyEnvelope() {
  return {
    pm: null,
    meta: clone(EMPTY_META),
    references: [],
    version: "0.1",
    translations: {},
    rights: null
  }
}

export function serializeEnvelope(envelope) {
  return JSON.stringify(envelope)
}

function mergeMeta(target, source) {
  if (!source || typeof source !== "object") return
  for (const k of Object.keys(EMPTY_META)) {
    if (source[k] === undefined) continue
    if (k === "title" || k === "abstract" || k === "abstracts") {
      target[k] = { ...target[k], ...source[k] }
    } else if (k === "dates" && source[k] && typeof source[k] === "object") {
      target[k] = { ...target[k], ...source[k] }
    } else if (k === "keywords") {
      target[k] = {
        ru: Array.isArray(source[k].ru) ? [...source[k].ru] : target[k].ru,
        en: Array.isArray(source[k].en) ? [...source[k].en] : target[k].en
      }
    } else if (k === "authorsEn" || k === "contributorsEn") {
      if (Array.isArray(source[k]) && source[k].length) target[k] = [...source[k]]
    } else if (Array.isArray(EMPTY_META[k])) {
      target[k] = Array.isArray(source[k]) ? [...source[k]] : target[k]
    } else {
      target[k] = source[k]
    }
  }
}

export function deserializeEnvelope(json) {
  if (!json || !String(json).trim()) return createEmptyEnvelope()
  let parsed
  try {
    parsed = JSON.parse(json)
  } catch {
    return createEmptyEnvelope()
  }
  if (parsed && !parsed.version && parsed.type === "doc") {
    return { pm: parsed, meta: clone(EMPTY_META), references: [], version: "0.1", translations: {}, rights: null }
  }
  const env = createEmptyEnvelope()
  env.version = parsed.version || "0.1"
  env.pm = parsed.pm != null ? parsed.pm : null
  mergeMeta(env.meta, parsed.meta)
  env.references = Array.isArray(parsed.references) ? parsed.references : []
  env.translations = parsed.translations && typeof parsed.translations === "object" ? parsed.translations : {}
  env.rights = parsed.rights ?? null
  return env
}
