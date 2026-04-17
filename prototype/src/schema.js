import { Schema } from "prosemirror-model"
import { tableNodes } from "prosemirror-tables"

import { renderMathLive } from "./math-render.js"

/** Section type labels for visual markers */
export const sectionTypeLabels = {
  introduction: "Введение",
  methods: "Методы",
  results: "Результаты",
  discussion: "Обсуждение",
  conclusion: "Заключение",
  acknowledgements: "Благодарности",
  references: "Литература",
  appendix: "Приложение",
  abstract: "Аннотация",
  custom: "Раздел"
}

/** Section type → color for badges */
export const sectionTypeColors = {
  introduction: "#1976d2",
  methods: "#388e3c",
  results: "#f57c00",
  discussion: "#7b1fa2",
  conclusion: "#c62828",
  acknowledgements: "#78909c",
  references: "#5d4037",
  appendix: "#546e7a",
  abstract: "#00838f",
  custom: "#616161"
}

/** @returns {string} UUID or fallback id for Schema v2 nodes */
export function newNodeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
}

function renderMathContent(host, { mathml = "", latex = "" }) {
  if (!String(mathml ?? "").trim() && !String(latex ?? "").trim()) {
    host.textContent = ""
    return
  }
  host.innerHTML = ""
  queueMicrotask(() => renderMathLive(host))
}

// === Inline math node ===
const mathInlineSpec = {
  group: "inline",
  content: "text*",
  inline: true,
  atom: true,
  attrs: {
    mathml: { default: "" },
    latex: { default: "" }
  },
  toDOM(node) {
    const span = document.createElement("span")
    span.classList.add("math-inline")
    span.setAttribute("data-mathml", node.attrs.mathml || "")
    span.setAttribute("data-latex", node.attrs.latex)
    span.setAttribute("title", "Кликните для редактирования")
    span.style.cursor = "pointer"
    const host = document.createElement("span")
    host.classList.add("math-render-host")
    span.appendChild(host)
    renderMathContent(host, node.attrs)
    return span
  },
  parseDOM: [{
    tag: "span.math-inline",
    getAttrs(dom) {
      return {
        mathml: dom.getAttribute("data-mathml") || dom.querySelector("math")?.outerHTML || "",
        latex: dom.getAttribute("data-latex") || dom.textContent
      }
    }
  }]
}

// === Block math (display formula) ===
const mathBlockSpec = {
  group: "block",
  content: "text*",
  atom: true,
  attrs: {
    mathml: { default: "" },
    latex: { default: "" },
    label: { default: null },
    id: { default: null }
  },
  toDOM(node) {
    const div = document.createElement("div")
    div.classList.add("math-block")
    if (node.attrs.id) div.id = node.attrs.id
    div.setAttribute("data-mathml", node.attrs.mathml || "")
    div.setAttribute("data-latex", node.attrs.latex)
    div.setAttribute("title", "Кликните для редактирования формулы")
    div.style.cursor = "pointer"
    const host = document.createElement("div")
    host.classList.add("math-render-host")
    div.appendChild(host)
    renderMathContent(host, node.attrs)
    if (node.attrs.label) {
      const labelSpan = document.createElement("span")
      labelSpan.classList.add("math-label")
      labelSpan.textContent = node.attrs.label
      div.appendChild(labelSpan)
    }
    return div
  },
  parseDOM: [{
    tag: "div.math-block",
    getAttrs(dom) {
      return {
        id: dom.getAttribute("id"),
        mathml: dom.getAttribute("data-mathml") || dom.querySelector("math")?.outerHTML || "",
        latex: dom.getAttribute("data-latex") || dom.textContent,
        label: dom.getAttribute("data-label") || dom.querySelector(".math-label")?.textContent || null
      }
    }
  }]
}

// === Figure (legacy removed in Schema v2 — use figure_block instead) ===

const figcaptionSpec = {
  content: "inline*",
  toDOM() { return ["figcaption", 0] },
  parseDOM: [{ tag: "figcaption" }]
}

// === Block image inside figure_block (Schema v2) — not an inline `image` node ===
const figureImageSpec = {
  atom: true,
  draggable: true,
  attrs: {
    src: { default: null },
    alt: { default: "" },
    title: { default: "" }
  },
  toDOM(node) {
    return ["img", {
      src: node.attrs.src,
      alt: node.attrs.alt || "",
      title: node.attrs.title || undefined,
      class: "figure-block-img"
    }]
  },
  parseDOM: [
    { tag: "img.figure-block-img", getAttrs(dom) {
      return { src: dom.getAttribute("src"), alt: dom.getAttribute("alt") || "", title: dom.getAttribute("title") || "" }
    }},
    { tag: "figure > img", getAttrs(dom) {
      return { src: dom.getAttribute("src"), alt: dom.getAttribute("alt") || "", title: dom.getAttribute("title") || "" }
    }}
  ]
}

const figureBlockSpec = {
  group: "block",
  content: "figure_image figcaption?",
  attrs: {
    id: { default: null }
  },
  defining: true,
  toDOM(node) {
    const attrs = { "data-schema-v2": "" }
    if (node.attrs.id) attrs.id = node.attrs.id
    return ["figure", attrs, 0]
  },
  parseDOM: [{
    tag: "figure",
    getAttrs(dom) {
      return { id: dom.getAttribute("id") || null }
    }
  }]
}

const tableCaptionSpec = {
  content: "inline*",
  toDOM() { return ["div", { class: "table-caption" }, 0] },
  parseDOM: [{ tag: "div.table-caption" }]
}

const tableBlockSpec = {
  group: "block",
  content: "table_caption? table",
  attrs: {
    id: { default: null }
  },
  defining: true,
  toDOM(node) {
    const attrs = { class: "table-wrap" }
    if (node.attrs.id) attrs.id = node.attrs.id
    return ["div", attrs, 0]
  },
  parseDOM: [{
    tag: "div.table-wrap",
    getAttrs(dom) {
      return { id: dom.getAttribute("id") || null }
    }
  }]
}

const citationRefSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: {
    ref_ids: { default: [] }
  },
  toDOM(node) {
    const ids = node.attrs.ref_ids || []
    const label = ids.length ? `[${ids.map((_, i) => i + 1).join(",")}]` : "[]"
    return ["span", {
      class: "citation-ref",
      "data-refs": ids.join(",")
    }, label]
  },
  parseDOM: [{
    tag: "span.citation-ref",
    getAttrs(dom) {
      const raw = dom.getAttribute("data-refs") || ""
      const ref_ids = raw.split(",").map((s) => s.trim()).filter(Boolean)
      return { ref_ids }
    }
  }]
}

const footnoteRefSpec = {
  group: "inline",
  inline: true,
  atom: true,
  attrs: {
    footnote_id: { default: "" }
  },
  toDOM(node) {
    return ["sup", {
      class: "footnote-ref",
      "data-fn": node.attrs.footnote_id || ""
    }, "*"]
  },
  parseDOM: [{
    tag: "sup.footnote-ref",
    getAttrs(dom) {
      return { footnote_id: dom.getAttribute("data-fn") || "" }
    }
  }]
}

// === Image (standalone inline) ===
const imageSpec = {
  inline: true,
  group: "inline",
  draggable: true,
  attrs: {
    src: { default: null },
    alt: { default: "" },
    title: { default: "" }
  },
  toDOM(node) {
    return ["img", { src: node.attrs.src, alt: node.attrs.alt, title: node.attrs.title, class: "inline-image" }]
  },
  parseDOM: [{
    tag: "img[src]",
    getAttrs(dom) {
      return {
        src: dom.getAttribute("src"),
        alt: dom.getAttribute("alt") || "",
        title: dom.getAttribute("title") || ""
      }
    }
  }]
}

// === Build table nodes ===
const tableNodeSpecs = tableNodes({
  tableGroup: "block",
  cellContent: "block+",
  cellAttributes: {
    background: {
      default: null,
      getFromDOM(dom) { return dom.style.backgroundColor || null },
      setDOMAttr(value, attrs) { if (value) attrs.style = (attrs.style || "") + `background-color: ${value};` }
    }
  }
})

// === Full schema ===
export const schema = new Schema({
  nodes: {
    doc: { content: "block+" },

    paragraph: {
      group: "block",
      content: "inline*",
      attrs: {
        id: { default: null },
        align: { default: null },
        styleType: { default: null },
        lang: { default: null }
      },
      toDOM(node) {
        const attrs = {}
        const classes = []
        if (node.attrs.id) attrs.id = node.attrs.id
        if (node.attrs.lang) attrs.lang = node.attrs.lang
        if (node.attrs.align) attrs.style = `text-align: ${node.attrs.align}`
        if (node.attrs.styleType) {
          classes.push(node.attrs.styleType === "list-item-numbered" ? "list-item-numbered" : `style-${node.attrs.styleType}`)
        }
        if (classes.length) attrs.class = classes.join(" ")
        return ["p", attrs, 0]
      },
      parseDOM: [{
        tag: "p",
        getAttrs(dom) {
          const cls = dom.getAttribute("class") || ""
          let styleType = null
          if (cls.includes("style-fig-caption")) styleType = "fig-caption"
          else if (cls.includes("style-table-caption")) styleType = "table-caption"
          else if (cls.includes("style-table-number")) styleType = "table-number"
          else if (cls.includes("list-item-numbered")) styleType = "list-item-numbered"
          return {
            id: dom.getAttribute("id"),
            lang: dom.getAttribute("lang") || null,
            align: dom.style?.textAlign || dom.getAttribute("align") || null,
            styleType
          }
        }
      }]
    },

    heading: {
      group: "block",
      content: "inline*",
      attrs: {
        level: { default: 1 },
        id: { default: null },
        align: { default: null },
        sectionType: { default: null }
      },
      toDOM(node) {
        const attrs = {}
        if (node.attrs.id) attrs.id = node.attrs.id
        if (node.attrs.sectionType) {
          attrs["data-section-type"] = node.attrs.sectionType
          attrs["data-section-label"] = sectionTypeLabels[node.attrs.sectionType] || node.attrs.sectionType
        }
        if (node.attrs.align) attrs.style = `text-align: ${node.attrs.align}`
        return [`h${node.attrs.level}`, attrs, 0]
      },
      parseDOM: [
        { tag: "h1", getAttrs(dom) {
          return {
            level: 1,
            id: dom.getAttribute("id"),
            align: dom.style?.textAlign || null,
            sectionType: dom.getAttribute("data-section-type") || null
          }
        } },
        { tag: "h2", getAttrs(dom) {
          return {
            level: 2,
            id: dom.getAttribute("id"),
            align: dom.style?.textAlign || null,
            sectionType: dom.getAttribute("data-section-type") || null
          }
        } },
        { tag: "h3", getAttrs(dom) {
          return {
            level: 3,
            id: dom.getAttribute("id"),
            align: dom.style?.textAlign || null,
            sectionType: dom.getAttribute("data-section-type") || null
          }
        } },
        { tag: "h4", getAttrs(dom) {
          return {
            level: 4,
            id: dom.getAttribute("id"),
            align: dom.style?.textAlign || null,
            sectionType: dom.getAttribute("data-section-type") || null
          }
        } }
      ]
    },

    blockquote: {
      group: "block",
      content: "block+",
      toDOM() { return ["blockquote", 0] },
      parseDOM: [{ tag: "blockquote" }]
    },

    code_block: {
      group: "block",
      content: "text*",
      marks: "",
      code: true,
      defining: true,
      toDOM() { return ["pre", ["code", 0]] },
      parseDOM: [{ tag: "pre", preserveWhitespace: "full" }]
    },

    horizontal_rule: {
      group: "block",
      toDOM() { return ["hr"] },
      parseDOM: [{ tag: "hr" }]
    },

    bullet_list: {
      group: "block",
      content: "list_item+",
      toDOM() { return ["ul", 0] },
      parseDOM: [{ tag: "ul" }]
    },

    ordered_list: {
      group: "block",
      content: "list_item+",
      attrs: { order: { default: 1 } },
      toDOM(node) {
        return node.attrs.order === 1 ? ["ol", 0] : ["ol", { start: node.attrs.order }, 0]
      },
      parseDOM: [{
        tag: "ol",
        getAttrs(dom) { return { order: dom.hasAttribute("start") ? +dom.getAttribute("start") : 1 } }
      }]
    },

    list_item: {
      content: "paragraph block*",
      toDOM() { return ["li", 0] },
      parseDOM: [{ tag: "li" }],
      defining: true
    },

    math_inline: mathInlineSpec,
    math_block: mathBlockSpec,
    figcaption: figcaptionSpec,
    figure_image: figureImageSpec,
    figure_block: figureBlockSpec,
    table_caption: tableCaptionSpec,
    table_block: tableBlockSpec,
    citation_ref: citationRefSpec,
    footnote_ref: footnoteRefSpec,
    image: imageSpec,

    ...tableNodeSpecs,

    text: { group: "inline" },
    hard_break: {
      inline: true,
      group: "inline",
      selectable: false,
      toDOM() { return ["br"] },
      parseDOM: [{ tag: "br" }]
    }
  },

  marks: {
    bold: {
      toDOM() { return ["strong", 0] },
      parseDOM: [
        { tag: "strong" },
        { tag: "b", getAttrs: node => {
          if (node.style && node.style.fontWeight === "normal") return false
          return null
        }},
        { style: "font-weight=400", clearMark: m => m.type.name === "bold" },
        { style: "font-weight=normal", clearMark: m => m.type.name === "bold" },
        { style: "font-weight", getAttrs: value => /^(bold(er)?|[6-9]\d{2,})$/.test(value) && null }
      ]
    },
    italic: {
      toDOM() { return ["em", 0] },
      parseDOM: [
        { tag: "i" }, { tag: "em" },
        { style: "font-style=italic" }
      ]
    },
    underline: {
      toDOM() { return ["u", 0] },
      parseDOM: [{ tag: "u" }, { style: "text-decoration=underline" }]
    },
    strikethrough: {
      toDOM() { return ["s", 0] },
      parseDOM: [{ tag: "s" }, { tag: "del" }, { style: "text-decoration=line-through" }]
    },
    superscript: {
      toDOM() { return ["sup", 0] },
      parseDOM: [{ tag: "sup" }],
      excludes: "subscript"
    },
    subscript: {
      toDOM() { return ["sub", 0] },
      parseDOM: [{ tag: "sub" }],
      excludes: "superscript"
    },
    code: {
      toDOM() { return ["code", 0] },
      parseDOM: [{ tag: "code" }]
    },
    link: {
      attrs: { href: {}, title: { default: null } },
      inclusive: false,
      toDOM(node) {
        return ["a", { href: node.attrs.href, title: node.attrs.title, target: "_blank", rel: "noopener" }, 0]
      },
      parseDOM: [{
        tag: "a[href]",
        getAttrs(dom) {
          return { href: dom.getAttribute("href"), title: dom.getAttribute("title") }
        }
      }]
    },
    lang: {
      attrs: { lang: {} },
      toDOM(mark) {
        return ["span", { lang: mark.attrs.lang, class: "lang-foreign" }, 0]
      },
      parseDOM: [{
        tag: "span[lang]",
        getAttrs(dom) {
          const lang = dom.getAttribute("lang")
          if (!lang || !dom.classList.contains("lang-foreign")) return false
          return { lang }
        }
      }]
    }
  }
})
