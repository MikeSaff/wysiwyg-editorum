import publicationCss from "./editorum-publication.css?raw"
import { MATH_FONT_PRESETS, DEFAULT_MATH_FONT } from "./math-config.js"

// TODO v0.47 JATS export (when implemented):
// formula_image_block → <disp-formula id="…"><graphic xlink:href="…"/><alt-text>…</alt-text><label>(N)</label></disp-formula>
// formula_image_inline → <inline-graphic xlink:href="…"/><alt-text>…</alt-text>

export function exportToHtml(doc, schema) {
  const root = doc && doc.type && doc.type.name === "doc" ? doc : schema.nodeFromJSON(doc)
  const title = findFirstHeadingTitle(root) || "Document"
  const bodyInner = serializeDocumentBody(root, schema)
  const mathJax = "https://cdn.jsdelivr.net/npm/mathjax@4/tex-mml-chtml.js"
  const mf = MATH_FONT_PRESETS[DEFAULT_MATH_FONT] || MATH_FONT_PRESETS.stix2
  const mathJaxConfigScript =
    "<script>\nwindow.MathJax={" +
    "loader:{load:['[tex]/ams','[tex]/newcommand','[tex]/color']}," +
    "tex:{inlineMath:[['\\\\(','\\\\)']],displayMath:[['\\\\[','\\\\]']],processEscapes:true}," +
    "chtml:" +
    JSON.stringify({
      displayOverflow: "linebreak",
      mtextInheritFont: true,
      merrorInheritFont: true,
      font: mf.font,
      fontURL: mf.fontURL
    }) +
    ",options:{enableMenu:false}};\n</script>\n"
  return (
    "<!DOCTYPE html>\n" +
    '<html lang="ru">\n<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
    "<title>" +
    escapeHtml(title) +
    "</title>\n" +
    mathJaxConfigScript +
    '<script defer src="' +
    mathJax +
    '"></script>\n' +
    '<link rel="stylesheet" href="editorum-publication.css">\n' +
    "<style>\n" +
    publicationCss +
    "\n</style>\n" +
    "</head>\n<body>\n" +
    '<article class="publication">\n' +
    '<header class="doc-meta">\n' +
    "<h1>" +
    escapeHtml(title) +
    "</h1>\n" +
    '<p class="doc-authors"></p>\n' +
    '<p class="doc-abstract"></p>\n' +
    '<p class="doc-keywords"></p>\n' +
    "</header>\n<main>\n" +
    bodyInner +
    "\n</main>\n" +
    '<footer class="doc-bibliography"></footer>\n' +
    "</article>\n</body>\n</html>"
  )
}

function findFirstHeadingTitle(doc) {
  let t = ""
  doc.descendants((node) => {
    if (node.type.name === "heading" && node.attrs.level === 1) {
      const x = node.textContent.trim()
      if (x) {
        t = x
        return false
      }
    }
  })
  return t
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttr(s) {
  return escapeHtml(s)
}

function wrapMarks(html, marks) {
  let out = html
  const order = [...marks].sort((a, b) => a.type.name.localeCompare(b.type.name))
  for (const mark of order) {
    out = wrapMark(out, mark)
  }
  return out
}

function wrapMark(html, mark) {
  const n = mark.type.name
  if (n === "bold") return "<strong>" + html + "</strong>"
  if (n === "italic") return "<em>" + html + "</em>"
  if (n === "underline") return "<u>" + html + "</u>"
  if (n === "strikethrough") return "<s>" + html + "</s>"
  if (n === "superscript") return "<sup>" + html + "</sup>"
  if (n === "subscript") return "<sub>" + html + "</sub>"
  if (n === "code") return "<code>" + html + "</code>"
  if (n === "lang") {
    return '<span lang="' + escapeAttr(mark.attrs.lang || "") + '" class="lang-foreign">' + html + "</span>"
  }
  if (n === "link") {
    const href = escapeAttr(mark.attrs.href || "#")
    const title = mark.attrs.title ? ' title="' + escapeAttr(mark.attrs.title) + '"' : ""
    return '<a href="' + href + '"' + title + ' target="_blank" rel="noopener">' + html + "</a>"
  }
  return html
}

function serializeInlineFragment(node) {
  let html = ""
  node.forEach((child) => {
    if (child.isText) {
      html += wrapMarks(escapeHtml(child.text), child.marks)
    } else if (child.type.name === "hard_break") {
      html += "<br>"
    } else if (child.type.name === "image") {
      html += serializeImageNode(child)
    } else if (child.type.name === "math_inline") {
      const tex = escapeHtml(child.attrs.latex || "")
      html += '<span class="math-inline">\\(' + tex + "\\)</span>"
    } else if (child.type.name === "citation_ref") {
      const ids = child.attrs.ref_ids || []
      const label = ids.length ? `[${ids.map((_, i) => i + 1).join(",")}]` : "[]"
      html += '<span class="citation-ref" data-refs="' + escapeAttr(ids.join(",")) + '">' + escapeHtml(label) + "</span>"
    } else if (child.type.name === "footnote_ref") {
      html += '<sup class="footnote-ref" data-fn="' + escapeAttr(child.attrs.footnote_id || "") + '">*</sup>'
    } else if (child.type.name === "formula_image_inline") {
      const src = escapeAttr(child.attrs.src || "")
      const alt = escapeAttr(child.attrs.alt || "")
      const lh = child.attrs.latex_hint
        ? ' data-latex-hint="' + escapeAttr(child.attrs.latex_hint) + '"'
        : ""
      html += '<img class="formula-image-inline" src="' + src + '" alt="' + alt + '"' + lh + ">"
    }
  })
  return html
}

function serializeImageNode(node) {
  const src = escapeAttr(node.attrs.src || "")
  const alt = escapeAttr(node.attrs.alt || "")
  const title = node.attrs.title ? ' title="' + escapeAttr(node.attrs.title) + '"' : ""
  return '<img class="inline-image" src="' + src + '" alt="' + alt + '"' + title + ">"
}

function serializeFigureImageNode(node) {
  const src = escapeAttr(node.attrs.src || "")
  const alt = escapeAttr(node.attrs.alt || "")
  const title = node.attrs.title ? ' title="' + escapeAttr(node.attrs.title) + '"' : ""
  return '<img class="figure-block-img" src="' + src + '" alt="' + alt + '"' + title + ">"
}

let headingCounter = 0

function nextHeadingId(text, level) {
  headingCounter += 1
  const slug = String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48)
  return slug ? slug + "-" + headingCounter : "h" + level + "-" + headingCounter
}

function serializeBlock(node, schema) {
  const n = node.type.name
  if (n === "paragraph") {
    return serializeParagraph(node)
  }
  if (n === "heading") {
    const level = Math.min(4, Math.max(1, node.attrs.level || 1))
    const text = node.textContent.trim()
    const id = nextHeadingId(text || "h", level)
    const align = node.attrs.align ? ' style="text-align:' + escapeAttr(node.attrs.align) + '"' : ""
    const hid = node.attrs.id ? String(node.attrs.id) : id
    const sec = node.attrs.sectionType
      ? ' data-section-type="' + escapeAttr(node.attrs.sectionType) + '"'
      : ""
    return "<h" + level + ' id="' + escapeAttr(hid) + '"' + sec + align + ">" + serializeInlineFragment(node) + "</h" + level + ">"
  }
  if (n === "blockquote") {
    let inner = ""
    node.forEach((ch) => {
      inner += serializeBlock(ch, schema)
    })
    return "<blockquote>" + inner + "</blockquote>"
  }
  if (n === "code_block") {
    const code = escapeHtml(node.textContent)
    return "<pre><code>" + code + "</code></pre>"
  }
  if (n === "horizontal_rule") {
    return "<hr>"
  }
  if (n === "bullet_list" || n === "ordered_list") {
    const tag = n === "bullet_list" ? "ul" : "ol"
    const start = n === "ordered_list" && node.attrs.order !== 1 ? ' start="' + node.attrs.order + '"' : ""
    let li = ""
    node.forEach((item) => {
      li += serializeListItem(item, schema)
    })
    return "<" + tag + start + ">" + li + "</" + tag + ">"
  }
  if (n === "formula_image_block") {
    const figAttrs = ['class="formula-image-block"']
    if (node.attrs.id) figAttrs.push('data-id="' + escapeAttr(String(node.attrs.id)) + '"')
    if (node.attrs.number) figAttrs.push('data-number="' + escapeAttr(String(node.attrs.number)) + '"')
    if (node.attrs.latex_hint) figAttrs.push('data-latex-hint="' + escapeAttr(node.attrs.latex_hint) + '"')
    const src = escapeAttr(node.attrs.src || "")
    const alt = escapeAttr(node.attrs.alt || "")
    return "<figure " + figAttrs.join(" ") + '><img src="' + src + '" alt="' + alt + '" /></figure>'
  }
  if (n === "math_block") {
    const tex = escapeHtml(node.attrs.latex || "")
    const label = node.attrs.label
    const mid = node.attrs.id ? ' id="' + escapeAttr(String(node.attrs.id)) + '"' : ""
    const labelHtml = label
      ? '<span class="formula-label">' + escapeHtml(String(label)) + "</span>"
      : ""
    return (
      '<div class="formula"' +
      mid +
      "><div class=\"formula-body\">\\[" +
      tex +
      "\\]</div>" +
      labelHtml +
      "</div>"
    )
  }
  if (n === "figure_block") {
    const fid = node.attrs.id ? ' id="' + escapeAttr(String(node.attrs.id)) + '"' : ""
    let inner = ""
    node.forEach((ch) => {
      if (ch.type.name === "figure_image") {
        inner += serializeFigureImageNode(ch)
      } else if (ch.type.name === "figcaption") {
        inner += "<figcaption>" + serializeInlineFragment(ch) + "</figcaption>"
      }
    })
    return "<figure data-schema-v2" + fid + ">" + inner + "</figure>"
  }
  if (n === "table_block") {
    let capHtml = ""
    let tableNode = null
    node.forEach((ch) => {
      if (ch.type.name === "table_caption") {
        capHtml = '<div class="table-caption">' + serializeInlineFragment(ch) + "</div>"
      } else if (ch.type.name === "table") {
        tableNode = ch
      }
    })
    if (!tableNode) return ""
    const wrapId = node.attrs.id ? ' id="' + escapeAttr(String(node.attrs.id)) + '"' : ""
    const inner = serializeTable(tableNode, null, schema)
    return '<div class="table-wrap"' + wrapId + ">" + capHtml + inner + "</div>"
  }
  if (n === "figure") {
    let img = ""
    const src = node.attrs.src
    if (src) {
      img =
        '<img src="' +
        escapeAttr(src) +
        '" alt="' +
        escapeAttr(node.attrs.alt || "") +
        '"' +
        (node.attrs.title ? ' title="' + escapeAttr(node.attrs.title) + '"' : "") +
        ">"
    }
    let cap = ""
    node.forEach((ch) => {
      if (ch.type.name === "figcaption") {
        cap = "<figcaption>" + serializeInlineFragment(ch) + "</figcaption>"
      }
    })
    return '<figure class="figure">' + img + cap + "</figure>"
  }
  if (n === "table") {
    return serializeTable(node, null, schema)
  }
  return ""
}

function serializeListItem(node, schema) {
  let inner = ""
  node.forEach((ch) => {
    inner += serializeBlock(ch, schema)
  })
  return "<li>" + inner + "</li>"
}

function serializeParagraph(node) {
  const st = node.attrs.styleType
  const inner = serializeInlineFragment(node)
  if (st === "fig-caption") {
    return (
      '<figure class="caption-block style-fig-caption"><figcaption>' + inner + "</figcaption></figure>"
    )
  }
  if (st === "table-caption") {
    return '<p class="style-table-caption">' + inner + "</p>"
  }
  const cls = st ? ' class="style-' + escapeAttr(st) + '"' : ""
  const id = node.attrs.id ? ' id="' + escapeAttr(node.attrs.id) + '"' : ""
  const lang = node.attrs.lang ? ' lang="' + escapeAttr(node.attrs.lang) + '"' : ""
  const align = node.attrs.align ? ' style="text-align:' + escapeAttr(node.attrs.align) + '"' : ""
  return "<p" + id + lang + cls + align + ">" + inner + "</p>"
}

function serializeTable(tableNode, captionHtml, schema) {
  let rows = ""
  tableNode.forEach((row) => {
    let cells = ""
    row.forEach((cell) => {
      const tag = cell.type.name === "table_header" ? "th" : "td"
      const cs = cell.attrs.colspan && cell.attrs.colspan !== 1 ? ' colspan="' + cell.attrs.colspan + '"' : ""
      const rs = cell.attrs.rowspan && cell.attrs.rowspan !== 1 ? ' rowspan="' + cell.attrs.rowspan + '"' : ""
      let cellInner = ""
      cell.forEach((block) => {
        cellInner += serializeBlock(block, schema)
      })
      cells += "<" + tag + cs + rs + ">" + cellInner + "</" + tag + ">"
    })
    rows += "<tr>" + cells + "</tr>"
  })
  const cap = captionHtml ? "<caption>" + captionHtml + "</caption>" : ""
  return "<table>" + cap + "<tbody>" + rows + "</tbody></table>"
}

function serializeDocumentBody(doc, schema) {
  headingCounter = 0
  const titleText = findFirstHeadingTitle(doc)
  const blocks = []
  doc.content.forEach((node) => {
    blocks.push(node)
  })
  if (
    blocks[0] &&
    blocks[0].type.name === "heading" &&
    blocks[0].attrs.level === 1 &&
    titleText &&
    blocks[0].textContent.trim() === titleText
  ) {
    blocks.shift()
  }
  const parts = []
  let i = 0
  while (i < blocks.length) {
    const node = blocks[i]
    if (node.type.name === "paragraph" && node.attrs.styleType === "table-caption") {
      const capText = serializeInlineFragment(node)
      if (blocks[i + 1] && blocks[i + 1].type.name === "table") {
        parts.push(serializeTable(blocks[i + 1], capText, schema))
        i += 2
        continue
      }
    }
    parts.push(serializeBlock(node, schema))
    i += 1
  }
  return parts.filter(Boolean).join("\n")
}
