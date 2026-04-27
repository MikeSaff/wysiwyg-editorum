const NAV_GROUP_ORDER = ["sections", "figures", "tables", "formulas"]

const NAV_GROUP_LABELS = {
  sections: "Разделы",
  figures: "Рисунки",
  tables: "Таблицы",
  formulas: "Формулы",
}

const EXCLUDED_SECTION_TYPES = new Set([
  "title",
  "abstract",
  "references",
  "funding",
  "author_info",
  "author_contributions",
  "acknowledgments",
  "acknowledgements",
  "conflicts",
  "appendix",
])

function normalizeNavText(text) {
  return (text || "").replace(/\s+/gu, " ").trim()
}

function shorten(text, max = 80) {
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

function getFigureCaptionText(node) {
  let captionRu = ""
  let captionAny = ""
  node.forEach((child) => {
    if (child.type.name !== "figcaption") return
    const text = normalizeNavText(child.textContent)
    if (!captionAny) captionAny = text
    if (child.attrs.lang !== "en" && !captionRu) captionRu = text
  })
  return captionRu || captionAny || "Рисунок"
}

function getTableCaptionText(node) {
  let captionRu = ""
  let captionAny = ""
  node.forEach((child) => {
    if (child.type.name !== "table_caption") return
    const text = normalizeNavText(child.textContent)
    if (!captionAny) captionAny = text
    if (child.attrs.lang !== "en" && !captionRu) captionRu = text
  })
  return captionRu || captionAny || "Таблица"
}

function extractFigureNavLabel(text) {
  const plain = normalizeNavText(text)
  const m = plain.match(/^(Рис\.|Рисунок|Fig\.?|Figure)\s*(\d+)([A-Za-zА-Яа-яЁё]?)/u)
  if (!m) return shorten(plain, 60)
  return `${m[1]} ${m[2]}${m[3] || ""}`.replace(/\s+/gu, " ").trim()
}

function extractTableNavLabel(text) {
  const plain = normalizeNavText(text)
  const m = plain.match(/^(Табл\.|Таблица|Table)\s*(\d+[A-Za-zА-Яа-яЁё]?)/u)
  if (!m) return shorten(plain, 60)
  return `${m[1]} ${m[2]}`.replace(/\s+/gu, " ").trim()
}

function isBodySectionHeading(node) {
  if (node.type.name !== "heading") return false
  const text = normalizeNavText(node.textContent)
  if (!text) return false
  const sectionType = node.attrs.sectionType || ""
  if (!sectionType) return false
  return !EXCLUDED_SECTION_TYPES.has(sectionType)
}

export function collectNavigationGroups(doc) {
  const buckets = {
    sections: [],
    figures: [],
    tables: [],
    formulas: [],
  }

  doc.forEach((node) => {
    if (isBodySectionHeading(node) && node.attrs.id) {
      const fullText = normalizeNavText(node.textContent)
      buckets.sections.push({
        group: "sections",
        kind: "section",
        targetId: node.attrs.id,
        label: fullText,
        title: fullText,
        level: node.attrs.level || 1,
      })
      return
    }

    if (node.type.name === "figure_block" && node.attrs.id) {
      const caption = getFigureCaptionText(node)
      buckets.figures.push({
        group: "figures",
        kind: "figure",
        targetId: node.attrs.id,
        label: extractFigureNavLabel(caption),
        title: caption,
        level: null,
      })
      return
    }

    if (node.type.name === "table_block" && node.attrs.id) {
      const caption = getTableCaptionText(node)
      buckets.tables.push({
        group: "tables",
        kind: "table",
        targetId: node.attrs.id,
        label: extractTableNavLabel(caption),
        title: caption,
        level: null,
      })
      return
    }

    if (node.type.name === "math_block" && node.attrs.id && node.attrs.label) {
      const label = normalizeNavText(node.attrs.label)
      buckets.formulas.push({
        group: "formulas",
        kind: "formula",
        targetId: node.attrs.id,
        label,
        title: label,
        level: null,
      })
    }
  })

  return NAV_GROUP_ORDER.map((key) => ({
    key,
    label: NAV_GROUP_LABELS[key],
    items: buckets[key],
  }))
}
