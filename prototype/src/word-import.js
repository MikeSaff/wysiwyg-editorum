import JSZip from "jszip"
import { schema } from "./schema.js"
import { DOMParser as ProseDOMParser } from "prosemirror-model"

/**
 * Import a .docx file directly, parsing OMML formulas into LaTeX.
 * This is the reliable path for Word documents with equations.
 *
 * DOCX = ZIP archive containing:
 *   word/document.xml — main content with OMML math
 *   word/media/* — images
 */

/**
 * Convert OMML (Office Math Markup Language) to LaTeX.
 * Handles common OMML structures: fractions, subscripts, superscripts,
 * square roots, matrices, integrals, summations.
 */
function ommlToLatex(ommlElement) {
  const ns = "http://schemas.openxmlformats.org/officeDocument/2006/math"

  function processNode(node) {
    if (!node) return ""

    const localName = node.localName || node.nodeName?.split(":").pop() || ""

    switch (localName) {
      case "oMath":
        return processChildren(node)

      case "r": // Run (text)
        const textEl = node.getElementsByTagNameNS(ns, "t")[0]
        return textEl ? textEl.textContent : ""

      case "f": // Fraction
        const num = node.getElementsByTagNameNS(ns, "num")[0]
        const den = node.getElementsByTagNameNS(ns, "den")[0]
        return `\\frac{${processChildren(num)}}{${processChildren(den)}}`

      case "sSub": // Subscript
        const subBase = node.getElementsByTagNameNS(ns, "e")[0]
        const sub = node.getElementsByTagNameNS(ns, "sub")[0]
        return `${processChildren(subBase)}_{${processChildren(sub)}}`

      case "sSup": // Superscript
        const supBase = node.getElementsByTagNameNS(ns, "e")[0]
        const sup = node.getElementsByTagNameNS(ns, "sup")[0]
        return `${processChildren(supBase)}^{${processChildren(sup)}}`

      case "sSubSup": // Sub-superscript
        const ssbBase = node.getElementsByTagNameNS(ns, "e")[0]
        const ssbSub = node.getElementsByTagNameNS(ns, "sub")[0]
        const ssbSup = node.getElementsByTagNameNS(ns, "sup")[0]
        return `${processChildren(ssbBase)}_{${processChildren(ssbSub)}}^{${processChildren(ssbSup)}}`

      case "rad": // Radical/square root
        const radDeg = node.getElementsByTagNameNS(ns, "deg")[0]
        const radE = node.getElementsByTagNameNS(ns, "e")[0]
        const degree = processChildren(radDeg).trim()
        if (degree && degree !== "") {
          return `\\sqrt[${degree}]{${processChildren(radE)}}`
        }
        return `\\sqrt{${processChildren(radE)}}`

      case "d": // Delimiter (parentheses, brackets, braces)
        const dPr = node.getElementsByTagNameNS(ns, "dPr")[0]
        let begChar = "("
        let endChar = ")"
        if (dPr) {
          const beg = dPr.getElementsByTagNameNS(ns, "begChr")[0]
          const end = dPr.getElementsByTagNameNS(ns, "endChr")[0]
          if (beg) begChar = beg.getAttribute("m:val") || beg.getAttributeNS(ns, "val") || "("
          if (end) endChar = end.getAttribute("m:val") || end.getAttributeNS(ns, "val") || ")"
        }
        const dContent = Array.from(node.getElementsByTagNameNS(ns, "e"))
          .map(e => processChildren(e))
          .join(", ")
        // Map to LaTeX delimiters
        const leftDel = begChar === "{" ? "\\{" : (begChar === "[" ? "[" : (begChar === "|" ? "|" : "("))
        const rightDel = endChar === "}" ? "\\}" : (endChar === "]" ? "]" : (endChar === "|" ? "|" : (endChar === "" ? "." : ")")))
        return `\\left${leftDel} ${dContent} \\right${rightDel}`

      case "nary": // N-ary operator (sum, integral, product)
        const naryPr = node.getElementsByTagNameNS(ns, "naryPr")[0]
        let operator = "\\int"
        if (naryPr) {
          const chr = naryPr.getElementsByTagNameNS(ns, "chr")[0]
          const val = chr ? (chr.getAttribute("m:val") || chr.getAttributeNS(ns, "val")) : null
          if (val === "∑" || val === "Σ") operator = "\\sum"
          else if (val === "∏" || val === "Π") operator = "\\prod"
          else if (val === "∫") operator = "\\int"
          else if (val === "∬") operator = "\\iint"
        }
        const narySub = node.getElementsByTagNameNS(ns, "sub")[0]
        const narySup = node.getElementsByTagNameNS(ns, "sup")[0]
        const naryE = node.getElementsByTagNameNS(ns, "e")[0]
        let naryLatex = operator
        if (narySub) naryLatex += `_{${processChildren(narySub)}}`
        if (narySup) naryLatex += `^{${processChildren(narySup)}}`
        naryLatex += ` ${processChildren(naryE)}`
        return naryLatex

      case "acc": // Accent (hat, bar, dot, etc.)
        const accPr = node.getElementsByTagNameNS(ns, "accPr")[0]
        const accE = node.getElementsByTagNameNS(ns, "e")[0]
        let accCmd = "\\hat"
        if (accPr) {
          const accChr = accPr.getElementsByTagNameNS(ns, "chr")[0]
          const accVal = accChr ? (accChr.getAttribute("m:val") || accChr.getAttributeNS(ns, "val")) : null
          if (accVal === "̇" || accVal === "˙") accCmd = "\\dot"
          else if (accVal === "̈") accCmd = "\\ddot"
          else if (accVal === "̄" || accVal === "¯") accCmd = "\\bar"
          else if (accVal === "⃗" || accVal === "→") accCmd = "\\vec"
          else if (accVal === "̃" || accVal === "~") accCmd = "\\tilde"
        }
        return `${accCmd}{${processChildren(accE)}}`

      case "m": // Matrix
        const mRows = node.getElementsByTagNameNS(ns, "mr")
        const rows = Array.from(mRows).map(row => {
          const cells = row.getElementsByTagNameNS(ns, "e")
          return Array.from(cells).map(cell => processChildren(cell)).join(" & ")
        })
        return `\\begin{pmatrix} ${rows.join(" \\\\ ")} \\end{pmatrix}`

      case "eqArr": // Equation array
        const eqRows = node.getElementsByTagNameNS(ns, "e")
        const eqLines = Array.from(eqRows).map(e => processChildren(e))
        return eqLines.join(" \\\\ ")

      case "bar": // Over/under bar
        const barE = node.getElementsByTagNameNS(ns, "e")[0]
        return `\\overline{${processChildren(barE)}}`

      case "box": // Box
        const boxE = node.getElementsByTagNameNS(ns, "e")[0]
        return processChildren(boxE)

      case "func": // Function (sin, cos, etc.)
        const fName = node.getElementsByTagNameNS(ns, "fName")[0]
        const funcE = node.getElementsByTagNameNS(ns, "e")[0]
        const funcName = processChildren(fName).trim()
        const knownFuncs = ["sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min"]
        const latexFunc = knownFuncs.includes(funcName) ? `\\${funcName}` : `\\mathrm{${funcName}}`
        return `${latexFunc} ${processChildren(funcE)}`

      case "groupChr": // Group character (over/under brace)
        const gcE = node.getElementsByTagNameNS(ns, "e")[0]
        return processChildren(gcE)

      case "limLow": // Lower limit
        const limBase = node.getElementsByTagNameNS(ns, "e")[0]
        const limLim = node.getElementsByTagNameNS(ns, "lim")[0]
        return `${processChildren(limBase)}_{${processChildren(limLim)}}`

      case "limUpp": // Upper limit
        const limUBase = node.getElementsByTagNameNS(ns, "e")[0]
        const limULim = node.getElementsByTagNameNS(ns, "lim")[0]
        return `${processChildren(limUBase)}^{${processChildren(limULim)}}`

      // Skip presentation/property elements
      case "rPr": case "ctrlPr": case "sSubPr": case "sSupPr":
      case "fPr": case "radPr": case "dPr": case "naryPr":
      case "accPr": case "mPr": case "mcs": case "mc":
      case "mcPr": case "count": case "mcJc": case "sSubSupPr":
      case "barPr": case "boxPr": case "funcPr": case "groupChrPr":
      case "limLowPr": case "limUppPr": case "eqArrPr":
      case "begChr": case "endChr": case "chr": case "pos":
      case "vertJc": case "type": case "grow": case "subHide":
      case "supHide": case "noBreak": case "wrapIndent":
      case "wrapRight": case "intLim": case "naryLim":
        return ""

      case "e": // Element container
      case "num": case "den": case "sub": case "sup":
      case "deg": case "lim": case "fName":
        return processChildren(node)

      case "t": // Text
        return node.textContent || ""

      default:
        return processChildren(node)
    }
  }

  function processChildren(node) {
    if (!node) return ""
    let result = ""
    for (const child of node.childNodes) {
      if (child.nodeType === 1) { // Element node
        result += processNode(child)
      }
    }
    return result
  }

  return processNode(ommlElement).trim()
}

/**
 * Parse DOCX document.xml and convert to HTML with LaTeX math.
 */
function docxXmlToHtml(xmlString, images) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, "application/xml")

  const wNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  const mNs = "http://schemas.openxmlformats.org/officeDocument/2006/math"
  const wpNs = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  const rNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

  const body = doc.getElementsByTagNameNS(wNs, "body")[0]
  if (!body) return "<p>Не удалось прочитать документ</p>"

  let html = ""

  // Process paragraphs
  for (const child of body.childNodes) {
    if (child.nodeType !== 1) continue
    const localName = child.localName || child.nodeName?.split(":").pop()

    if (localName === "p") {
      // Check if paragraph contains oMathPara (display/block math)
      const oMathParas = child.getElementsByTagNameNS(mNs, "oMathPara")
      if (oMathParas.length > 0) {
        for (const omp of oMathParas) {
          const oMaths = omp.getElementsByTagNameNS(mNs, "oMath")
          for (const oMath of oMaths) {
            const latex = ommlToLatex(oMath)
            if (latex) {
              html += `<div class="math-block" data-latex="${escapeAttr(latex)}">${escapeHtml(latex)}</div>\n`
            }
          }
        }
      } else {
        html += processParagraph(child, wNs, mNs)
      }
    } else if (localName === "tbl") {
      // Check if table is actually a formula container (Word trick)
      const tblHtml = processTableOrFormula(child, wNs, mNs)
      html += tblHtml
    } else if (localName === "oMathPara") {
      // Display math paragraph (top-level)
      const oMaths = child.getElementsByTagNameNS(mNs, "oMath")
      for (const oMath of oMaths) {
        const latex = ommlToLatex(oMath)
        if (latex) {
          html += `<div class="math-block" data-latex="${escapeAttr(latex)}">${escapeHtml(latex)}</div>\n`
        }
      }
    }
  }

  return html

  function processParagraph(p, wNs, mNs) {
    const pPr = p.getElementsByTagNameNS(wNs, "pPr")[0]
    let tag = "p"
    let level = 0

    // Check for heading style
    if (pPr) {
      const pStyle = pPr.getElementsByTagNameNS(wNs, "pStyle")[0]
      if (pStyle) {
        const styleVal = pStyle.getAttribute("w:val") || pStyle.getAttributeNS(wNs, "val") || ""
        // Word heading styles: "Heading1", "Heading 1", "1", "2", etc.
        const headingMatch = styleVal.match(/Heading\s*(\d)/i)
        const numericStyle = styleVal.match(/^(\d)$/)
        if (headingMatch) {
          level = parseInt(headingMatch[1]) || 1
          if (level >= 1 && level <= 4) tag = `h${level}`
        } else if (numericStyle) {
          // Russian Word uses numeric style IDs: "1" = Heading 1, "2" = Heading 2
          level = parseInt(numericStyle[1]) || 1
          if (level >= 1 && level <= 4) tag = `h${level}`
        }
      }
    }

    let content = ""
    let hasContent = false

    for (const child of p.childNodes) {
      if (child.nodeType !== 1) continue
      const cName = child.localName || child.nodeName?.split(":").pop()

      if (cName === "r") {
        // Text run
        const text = processRun(child, wNs)
        if (text) {
          content += text
          hasContent = true
        }
      } else if (cName === "oMath") {
        // Inline math
        const latex = ommlToLatex(child)
        if (latex) {
          content += `<span class="math-inline" data-latex="${escapeAttr(latex)}">${escapeHtml(latex)}</span>`
          hasContent = true
        }
      } else if (cName === "oMathPara") {
        // Display math inside paragraph (shouldn't normally reach here, but just in case)
        const oMaths = child.getElementsByTagNameNS(mNs, "oMath")
        for (const oMath of oMaths) {
          const latex = ommlToLatex(oMath)
          if (latex) {
            content += `<span class="math-inline" data-latex="${escapeAttr(latex)}">${escapeHtml(latex)}</span>`
            hasContent = true
          }
        }
      } else if (cName === "hyperlink") {
        // Hyperlink
        for (const hChild of child.childNodes) {
          if (hChild.nodeType === 1) {
            const hcName = hChild.localName || hChild.nodeName?.split(":").pop()
            if (hcName === "r") {
              content += processRun(hChild, wNs)
              hasContent = true
            }
          }
        }
      }
    }

    if (!hasContent) return ""
    return `<${tag}>${content}</${tag}>\n`
  }

  function processRun(r, wNs) {
    const rPr = r.getElementsByTagNameNS(wNs, "rPr")[0]
    let text = ""

    // Get text content
    for (const child of r.childNodes) {
      const cName = child.localName || child.nodeName?.split(":").pop()
      if (cName === "t") {
        text += child.textContent || ""
      } else if (cName === "br") {
        text += "<br>"
      } else if (cName === "tab") {
        text += "    "
      }
    }

    if (!text) return ""

    // Apply formatting
    if (rPr) {
      const bold = rPr.getElementsByTagNameNS(wNs, "b")[0]
      const italic = rPr.getElementsByTagNameNS(wNs, "i")[0]
      const underline = rPr.getElementsByTagNameNS(wNs, "u")[0]
      const strike = rPr.getElementsByTagNameNS(wNs, "strike")[0]
      const superscript = rPr.getElementsByTagNameNS(wNs, "vertAlign")[0]

      // Check if bold is explicitly turned off
      const boldVal = bold?.getAttribute("w:val") || bold?.getAttributeNS(wNs, "val")
      if (bold && boldVal !== "0" && boldVal !== "false") text = `<strong>${text}</strong>`

      const italicVal = italic?.getAttribute("w:val") || italic?.getAttributeNS(wNs, "val")
      if (italic && italicVal !== "0" && italicVal !== "false") text = `<em>${text}</em>`

      if (underline) text = `<u>${text}</u>`
      if (strike) text = `<s>${text}</s>`

      if (superscript) {
        const va = superscript.getAttribute("w:val") || superscript.getAttributeNS(wNs, "val")
        if (va === "superscript") text = `<sup>${text}</sup>`
        else if (va === "subscript") text = `<sub>${text}</sub>`
      }
    }

    return text
  }

  /**
   * Detect if a table is actually a Word formula container.
   * Word uses tables to align equations: | formula | (1) |
   * If detected, convert to math_block. Otherwise, process as real table.
   */
  function processTableOrFormula(tbl, wNs, mNs) {
    const rows = tbl.getElementsByTagNameNS(wNs, "tr")

    // Formula tables typically have 1 row, 2-3 columns
    if (rows.length === 1) {
      const cells = rows[0].getElementsByTagNameNS(wNs, "tc")
      if (cells.length >= 1 && cells.length <= 3) {
        // Check if any cell contains oMath or oMathPara
        let formulaLatex = ""
        let label = ""

        for (let ci = 0; ci < cells.length; ci++) {
          const cell = cells[ci]
          const oMathParas = cell.getElementsByTagNameNS(mNs, "oMathPara")
          const oMaths = cell.getElementsByTagNameNS(mNs, "oMath")
          const cellText = cell.textContent.trim()

          if (oMathParas.length > 0 || oMaths.length > 0) {
            // This cell contains a formula
            const mathEls = oMathParas.length > 0
              ? oMathParas[0].getElementsByTagNameNS(mNs, "oMath")
              : oMaths
            for (const m of mathEls) {
              formulaLatex += ommlToLatex(m) + " "
            }
          } else if (cellText.match(/^\(\d+\)$/)) {
            // This cell contains a label like (1), (2), etc.
            label = cellText
          }
        }

        if (formulaLatex.trim()) {
          // This is a formula table, not a data table
          const labelAttr = label ? ` data-label="${escapeAttr(label)}"` : ""
          return `<div class="math-block" data-latex="${escapeAttr(formulaLatex.trim())}"${labelAttr}>${escapeHtml(formulaLatex.trim())}</div>\n`
        }
      }
    }

    // Not a formula table — process as regular table
    return processTable(tbl, wNs, mNs)
  }

  function processTable(tbl, wNs, mNs) {
    let html = "<table>"
    const rows = tbl.getElementsByTagNameNS(wNs, "tr")
    for (const row of rows) {
      html += "<tr>"
      const cells = row.getElementsByTagNameNS(wNs, "tc")
      for (const cell of cells) {
        html += "<td>"
        for (const child of cell.childNodes) {
          const cName = child.localName || child.nodeName?.split(":").pop()
          if (cName === "p") {
            // Don't wrap in <p> inside table cells for simplicity
            let cellContent = ""
            for (const pChild of child.childNodes) {
              if (pChild.nodeType !== 1) continue
              const pcName = pChild.localName || pChild.nodeName?.split(":").pop()
              if (pcName === "r") cellContent += processRun(pChild, wNs)
              else if (pcName === "oMath") {
                const latex = ommlToLatex(pChild)
                if (latex) cellContent += `<span class="math-inline" data-latex="${escapeAttr(latex)}">${escapeHtml(latex)}</span>`
              }
            }
            html += cellContent
          }
        }
        html += "</td>"
      }
      html += "</tr>"
    }
    html += "</table>"
    return html
  }
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttr(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Main import function: reads .docx file, returns ProseMirror doc.
 */
export async function importDocx(file) {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // Read document.xml
  const docXmlFile = zip.file("word/document.xml")
  if (!docXmlFile) {
    throw new Error("Не найден word/document.xml в файле")
  }

  const xmlString = await docXmlFile.async("string")

  // Read images (for future use)
  const images = {}
  const mediaFolder = zip.folder("word/media")
  if (mediaFolder) {
    for (const [path, file] of Object.entries(zip.files)) {
      if (path.startsWith("word/media/")) {
        const data = await file.async("base64")
        const ext = path.split(".").pop().toLowerCase()
        const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/" + ext
        images[path.replace("word/", "")] = `data:${mime};base64,${data}`
      }
    }
  }

  // Convert to HTML
  const html = docxXmlToHtml(xmlString, images)

  // Parse HTML into ProseMirror doc
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  const domParser = ProseDOMParser.fromSchema(schema)
  const doc = domParser.parse(tempDiv)

  return { doc, html, formulaCount: (html.match(/math-inline|math-block/g) || []).length }
}
