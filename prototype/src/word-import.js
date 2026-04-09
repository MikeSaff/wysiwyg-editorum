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
export function ommlToLatex(ommlElement) {
  const ns = "http://schemas.openxmlformats.org/officeDocument/2006/math"

  function processNode(node) {
    if (!node) return ""

    const localName = node.localName || node.nodeName?.split(":").pop() || ""

    switch (localName) {
      case "oMath":
        return processChildren(node)

      case "r": // Run (text)
        const textEl = node.getElementsByTagNameNS(ns, "t")[0]
        if (!textEl) return ""
        let rText = textEl.textContent || ""

        // Replace Unicode math symbols with LaTeX commands
        rText = rText.replace(/⨂/g, "\\otimes ")
        rText = rText.replace(/⊗/g, "\\otimes ")
        rText = rText.replace(/⨁/g, "\\oplus ")
        rText = rText.replace(/⊕/g, "\\oplus ")
        rText = rText.replace(/∑/g, "\\Sigma ")
        rText = rText.replace(/∏/g, "\\Pi ")
        rText = rText.replace(/∙/g, "\\cdot ")
        rText = rText.replace(/•/g, "\\cdot ")
        rText = rText.replace(/·/g, "\\cdot ")
        rText = rText.replace(/∞/g, "\\infty ")
        rText = rText.replace(/∈/g, "\\in ")
        rText = rText.replace(/∉/g, "\\notin ")
        rText = rText.replace(/⊂/g, "\\subset ")
        rText = rText.replace(/⊃/g, "\\supset ")
        rText = rText.replace(/∀/g, "\\forall ")
        rText = rText.replace(/∃/g, "\\exists ")
        rText = rText.replace(/≤/g, "\\leq ")
        rText = rText.replace(/≥/g, "\\geq ")
        rText = rText.replace(/≠/g, "\\neq ")
        rText = rText.replace(/≈/g, "\\approx ")
        rText = rText.replace(/→/g, "\\to ")
        rText = rText.replace(/←/g, "\\leftarrow ")
        rText = rText.replace(/↔/g, "\\leftrightarrow ")
        rText = rText.replace(/≺/g, "\\prec ")
        rText = rText.replace(/≻/g, "\\succ ")
        rText = rText.replace(/∂/g, "\\partial ")
        rText = rText.replace(/∇/g, "\\nabla ")
        rText = rText.replace(/…/g, "\\ldots ")
        rText = rText.replace(/⋯/g, "\\cdots ")

        // Check if we're inside a superscript/subscript — don't add spaces there
        let inSubSup = false
        let ancestor = node.parentElement
        while (ancestor) {
          const aName = ancestor.localName || ancestor.nodeName?.split(":").pop()
          if (aName === "sup" || aName === "sub" || aName === "deg" ||
              aName === "num" || aName === "den") {
            inSubSup = true
            break
          }
          if (aName === "oMath") break
          ancestor = ancestor.parentElement
        }

        if (inSubSup) {
          return rText
        }

        // Add LaTeX spacing around operators for readability
        if (rText === "=") return " = "
        if (rText === "+") return " + "
        if (rText === "-" || rText === "−" || rText === "\u2212") return " - "
        if (rText === ",") return ","
        if (rText === ".") return "."
        if (rText === ";") return ";"
        if (rText === "[") return "\\left["
        if (rText === "]") return "\\right]"
        return rText

      case "f": // Fraction
        const num = getFirstDirectChildByLocalName(node, "num")
        const den = getFirstDirectChildByLocalName(node, "den")
        const numText = processChildren(num).trim()
        const denText = processChildren(den).trim()

        // Check fPr for linear fraction type
        const fPr = getFirstDirectChildByLocalName(node, "fPr")
        if (fPr) {
          const fType = fPr.getElementsByTagNameNS(ns, "type")[0]
          const typeVal = fType ? (fType.getAttribute("m:val") || fType.getAttributeNS(ns, "val")) : null
          if (typeVal === "lin") {
            return `{${numText}}/{${denText}} `
          }
        }

        // d/dt → medium fraction with thin space after
        if (numText === "d" && denText.startsWith("dt")) {
          return `\\tfrac{d}{dt}\\,`
        }

        // Simple fractions (1/Ix, 1/2) → tfrac for compact rendering
        const isSimpleFrac = numText.length <= 2 && denText.length <= 5 &&
          !numText.includes("\\frac") && !denText.includes("\\frac")
        if (isSimpleFrac) {
          return `\\tfrac{${numText}}{${denText}}`
        }

        // Complex fractions → dfrac for full display
        return `\\dfrac{${numText}}{${denText}}`

      case "sSub": // Subscript
        const subBase = getFirstDirectChildByLocalName(node, "e")
        const sub = getFirstDirectChildByLocalName(node, "sub")
        return `${processChildren(subBase)}_{${processChildren(sub)}}`

      case "sSup": // Superscript
        const supBase = getFirstDirectChildByLocalName(node, "e")
        const sup = getFirstDirectChildByLocalName(node, "sup")
        return `${processChildren(supBase)}^{${processChildren(sup)}}`

      case "sSubSup": // Sub-superscript
        const ssbBase = getFirstDirectChildByLocalName(node, "e")
        const ssbSub = getFirstDirectChildByLocalName(node, "sub")
        const ssbSup = getFirstDirectChildByLocalName(node, "sup")
        return `${processChildren(ssbBase)}_{${processChildren(ssbSub)}}^{${processChildren(ssbSup)}}`

      case "rad": // Radical/square root
        const radDeg = getFirstDirectChildByLocalName(node, "deg")
        const radE = getFirstDirectChildByLocalName(node, "e")
        const degree = processChildren(radDeg).trim()
        if (degree && degree !== "") {
          return `\\sqrt[${degree}]{${processChildren(radE)}}`
        }
        return `\\sqrt{${processChildren(radE)}}`

      case "d": // Delimiter (parentheses, brackets, braces)
        const dPr = getFirstDirectChildByLocalName(node, "dPr")
        let begChar = "("
        let endChar = ")"
        if (dPr) {
          const beg = dPr.getElementsByTagNameNS(ns, "begChr")[0]
          const end = dPr.getElementsByTagNameNS(ns, "endChr")[0]
          if (beg) {
            const bv = beg.getAttribute("m:val") ?? beg.getAttributeNS(ns, "val")
            if (bv !== null) begChar = bv
          }
          if (end) {
            const ev = end.getAttribute("m:val") ?? end.getAttributeNS(ns, "val")
            if (ev !== null) endChar = ev
          }
        }

        // Check if this is a system of equations: { + matrix with no right delimiter
        const dElements = Array.from(node.childNodes).filter(n => n.nodeType === 1 && (n.localName === "e" || n.nodeName?.endsWith(":e")))
        if (begChar === "{" && (endChar === "" || endChar === " " || endChar === ")")) {
          // System of equations with { on the left only
          if (dElements.length === 1) {
            const innerContent = processChildren(dElements[0])
            // If matrix already wrapped in \begin{cases}, return as-is
            if (innerContent.includes("\\begin{cases}")) {
              return innerContent
            }
            // If content has line breaks but not yet wrapped in cases
            if (innerContent.includes("\\\\")) {
              return `\\begin{cases} ${innerContent} \\end{cases}`
            }
          }
        }

        // Handle mismatched delimiters: { on left, ) on right — only show left
        if (begChar === "{" && endChar === ")") {
          const dContent2 = dElements.map(e => processChildren(e)).join(", ")
          return `\\left\\{ ${dContent2} \\right.`
        }

        const dContent = dElements
          .map(e => processChildren(e))
          .join(", ")
        // Map to LaTeX delimiters - use simple delimiters for compact rendering
        const delimMap = { "{": "\\{", "[": "[", "|": "|", "‖": "\\|", "(": "(" }
        const delimMapR = { "}": "\\}", "]": "]", "|": "|", "‖": "\\|", ")": ")", "": "" }
        const leftDel = delimMap[begChar] || "("
        const rightDel = delimMapR[endChar] || ")"

        // Use simple parens for most content — \left\right only for tall expressions
        const needsAutoSize = dContent.includes("\\frac{") || dContent.includes("\\begin{") ||
          dContent.includes("\\sum") || dContent.includes("\\int") || dContent.includes("\\prod")
        if (!needsAutoSize) {
          if (endChar === "" || endChar === " ") return `${leftDel}${dContent}`
          return `${leftDel}${dContent}${rightDel}`
        }
        if (endChar === "" || endChar === " ") return `\\left${leftDel} ${dContent} \\right.`
        return `\\left${leftDel} ${dContent} \\right${rightDel}`

      case "nary": // N-ary operator (sum, integral, product)
        const naryPr = getFirstDirectChildByLocalName(node, "naryPr")
        let operator = "\\int"
        if (naryPr) {
          const chr = naryPr.getElementsByTagNameNS(ns, "chr")[0]
          const val = chr ? (chr.getAttribute("m:val") || chr.getAttributeNS(ns, "val")) : null
          if (val === "∑" || val === "Σ") operator = "\\sum"
          else if (val === "∏" || val === "Π") operator = "\\prod"
          else if (val === "∫") operator = "\\int"
          else if (val === "∬") operator = "\\iint"
        }
        const narySub = getFirstDirectChildByLocalName(node, "sub")
        const narySup = getFirstDirectChildByLocalName(node, "sup")
        const naryE = getFirstDirectChildByLocalName(node, "e")
        let naryLatex = operator
        if (narySub) naryLatex += `_{${processChildren(narySub)}}`
        if (narySup) naryLatex += `^{${processChildren(narySup)}}`
        naryLatex += ` ${processChildren(naryE)}`
        return naryLatex

      case "acc": // Accent (hat, bar, dot, etc.)
        const accPr = getFirstDirectChildByLocalName(node, "accPr")
        const accE = getFirstDirectChildByLocalName(node, "e")
        let accCmd = "\\hat"
        if (accPr) {
          const accChr = accPr.getElementsByTagNameNS(ns, "chr")[0]
          const accVal = accChr ? (accChr.getAttribute("m:val") || accChr.getAttributeNS(ns, "val")) : null
          if (accVal === "\u0307" || accVal === "\u02D9" || accVal === "̇" || accVal === "˙") accCmd = "\\dot"
          else if (accVal === "\u0308" || accVal === "̈") accCmd = "\\ddot"
          else if (accVal === "\u0304" || accVal === "\u00AF" || accVal === "̄" || accVal === "¯") accCmd = "\\bar"
          else if (accVal === "\u20D7" || accVal === "\u2192" || accVal === "⃗" || accVal === "→") accCmd = "\\vec"
          else if (accVal === "\u0303" || accVal === "~" || accVal === "̃") accCmd = "\\tilde"
          else if (accVal === "\u0302" || accVal === "^" || accVal === "̂") accCmd = "\\hat"
        }
        return `${accCmd}{${processChildren(accE)}}`

      case "m": // Matrix
        const mRows = node.getElementsByTagNameNS(ns, "mr")
        // Get column count from mPr
        let colCount = 1
        const mPr = node.getElementsByTagNameNS(ns, "mPr")[0]
        if (mPr) {
          const countEl = mPr.getElementsByTagNameNS(ns, "count")[0]
          if (countEl) {
            colCount = parseInt(countEl.getAttribute("m:val") || countEl.getAttributeNS(ns, "val") || "1")
          }
        }

        // Determine matrix type from parent delimiter
        let matrixEnv = "pmatrix" // default: parentheses
        let isSystemOfEq = false
        const parentD = node.parentElement
        if (parentD) {
          const parentName = parentD.localName || parentD.nodeName?.split(":").pop()
          if (parentName === "e") {
            const grandParent = parentD.parentElement
            if (grandParent) {
              const gpName = grandParent.localName || grandParent.nodeName?.split(":").pop()
              if (gpName === "d") {
                const gpPr = grandParent.getElementsByTagNameNS(ns, "dPr")[0]
                if (gpPr) {
                  const beg = gpPr.getElementsByTagNameNS(ns, "begChr")[0]
                  const end = gpPr.getElementsByTagNameNS(ns, "endChr")[0]
                  const begVal = beg ? (beg.getAttribute("m:val") || beg.getAttributeNS(ns, "val")) : "("
                  const endVal = end ? (end.getAttribute("m:val") || end.getAttributeNS(ns, "val")) : ")"
                  if (begVal === "[") matrixEnv = "bmatrix"
                  else if (begVal === "{" && (endVal === "" || endVal === " ")) {
                    // System of equations: { with no right delimiter
                    if (colCount === 1) {
                      matrixEnv = "cases"
                      isSystemOfEq = true
                    } else {
                      matrixEnv = "Bmatrix"
                    }
                  }
                  else if (begVal === "{") matrixEnv = "Bmatrix"
                  else if (begVal === "|") matrixEnv = "vmatrix"
                  else if (begVal === "‖" || begVal === "∥") matrixEnv = "Vmatrix"
                }
              }
            }
          }
        }

        // Process rows - only direct child mr elements
        const directMrs = []
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i]
          if (child.nodeType === 1 && (child.localName === "mr" || child.nodeName?.endsWith(":mr"))) {
            directMrs.push(child)
          }
        }

        const rows = directMrs.map(row => {
          // Get only direct child e elements of this row
          const cells = []
          for (let i = 0; i < row.childNodes.length; i++) {
            const child = row.childNodes[i]
            if (child.nodeType === 1 && (child.localName === "e" || child.nodeName?.endsWith(":e"))) {
              cells.push(processChildren(child))
            }
          }
          return cells.join(" & ")
        })

        if (isSystemOfEq) {
          // System of equations: matrix handles cases directly,
          // parent delimiter (d) should not wrap again
          return `\\begin{cases} ${rows.join(" \\\\ ")} \\end{cases}`
        }
        return `\\begin{${matrixEnv}} ${rows.join(" \\\\ ")} \\end{${matrixEnv}}`

      case "eqArr": // Equation array
        // Only direct child <e> elements, not nested ones
        const eqRows = []
        for (let i = 0; i < node.childNodes.length; i++) {
          const child = node.childNodes[i]
          if (child.nodeType === 1 && (child.localName === "e" || child.nodeName?.endsWith(":e"))) {
            eqRows.push(processChildren(child))
          }
        }
        return eqRows.join(" \\\\ ")

      case "bar": // Over/under bar
        const barE = getFirstDirectChildByLocalName(node, "e")
        return `\\overline{${processChildren(barE)}}`

      case "box": // Box
        const boxE = getFirstDirectChildByLocalName(node, "e")
        return processChildren(boxE)

      case "func": // Function (sin, cos, etc.)
        const fName = getFirstDirectChildByLocalName(node, "fName")
        const funcE = getFirstDirectChildByLocalName(node, "e")
        // fName may contain limLow/limUpp — don't duplicate
        const fNameContent = processChildren(fName).trim()
        const funcContent = processChildren(funcE)
        // If fName already produced a \lim or similar, just return it
        if (fNameContent.includes("\\lim") || fNameContent.includes("\\max") || fNameContent.includes("\\min")) {
          return `${fNameContent} ${funcContent}`
        }
        const knownFuncs = ["sin", "cos", "tan", "log", "ln", "exp", "lim", "max", "min", "sup", "inf", "det", "dim"]
        const latexFunc = knownFuncs.includes(fNameContent) ? `\\${fNameContent}` : `\\operatorname{${fNameContent}}`
        return `${latexFunc} ${funcContent}`

      case "groupChr": // Group character (over/under brace)
        const gcE = getFirstDirectChildByLocalName(node, "e")
        return processChildren(gcE)

      case "limLow": // Lower limit (e.g., lim_{x→∞})
        const limBase = getFirstDirectChildByLocalName(node, "e")
        const limLim = getFirstDirectChildByLocalName(node, "lim")
        const limBaseText = processChildren(limBase).trim()
        const limLimText = processChildren(limLim).trim()
        // If base is "lim", use \lim with subscript
        if (limBaseText === "lim") {
          return `\\lim_{${limLimText}}`
        }
        return `${limBaseText}_{${limLimText}}`

      case "limUpp": // Upper limit
        const limUBase = getFirstDirectChildByLocalName(node, "e")
        const limULim = getFirstDirectChildByLocalName(node, "lim")
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
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
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
export function docxXmlToHtml(xmlString, images, imageRels, footnotes) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, "application/xml")

  const wNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  const mNs = "http://schemas.openxmlformats.org/officeDocument/2006/math"
  const wpNs = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  const rNs = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

  const body = doc.getElementsByTagNameNS(wNs, "body")[0]
  if (!body) return "<p>Не удалось прочитать документ</p>"

  let html = ""

  // Collect all child elements into array for look-ahead
  const bodyChildren = []
  for (let i = 0; i < body.childNodes.length; i++) {
    const child = body.childNodes[i]
    if (child.nodeType === 1) bodyChildren.push(child)
  }

  const skipIndices = new Set()

  // Process paragraphs with look-ahead
  for (let idx = 0; idx < bodyChildren.length; idx++) {
    if (skipIndices.has(idx)) continue
    const child = bodyChildren[idx]
    const localName = child.localName || child.nodeName?.split(":").pop()

    if (localName === "p") {
      // Check if paragraph contains oMathPara (display/block math)
      const oMathParas = findElementsByLocalName(child, "oMathPara")
      if (oMathParas.length > 0) {
        for (const omp of oMathParas) {
          const oMaths = findElementsByLocalName(omp, "oMath")
          for (const oMath of oMaths) {
            const latex = ommlToLatex(oMath)
            if (latex) {
              // Look ahead: is next element a formula number like (1)?
              let label = null
              if (idx + 1 < bodyChildren.length) {
                const next = bodyChildren[idx + 1]
                const nextName = next.localName || next.nodeName?.split(":").pop()
                if (nextName === "p") {
                  const nextTexts = []
                  const nextTextRuns = next.getElementsByTagNameNS(wNs, "t")
                  for (let ti = 0; ti < nextTextRuns.length; ti++) {
                    const t = nextTextRuns[ti]
                    if (t.textContent) nextTexts.push(t.textContent)
                  }
                  const nextText = nextTexts.join("").trim()
                  const labelMatch = nextText.match(/^\((\d+)\)$/)
                  if (labelMatch) {
                    label = nextText
                    skipIndices.add(idx + 1)
                  }
                }
              }
              const labelAttr = label ? ` data-label="${escapeAttr(label)}"` : ""
              html += `<div class="math-block" data-latex="${escapeAttr(latex)}"${labelAttr}>${escapeHtml(latex)}</div>\n`
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
      const oMaths = findElementsByLocalName(child, "oMath")
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

    for (let i = 0; i < p.childNodes.length; i++) {
      const child = p.childNodes[i]
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
        // Display math inside paragraph
        const oMaths = findElementsByLocalName(child, "oMath")
        for (const oMath of oMaths) {
          const latex = ommlToLatex(oMath)
          if (latex) {
            content += `<span class="math-inline" data-latex="${escapeAttr(latex)}">${escapeHtml(latex)}</span>`
            hasContent = true
          }
        }
      } else if (cName === "hyperlink") {
        // Hyperlink
        for (let hi = 0; hi < child.childNodes.length; hi++) {
          const hChild = child.childNodes[hi]
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
    // Skip empty or near-empty paragraphs (spaces, nbsp, br, tabs)
    const stripped = content.replace(/&nbsp;/g, "").replace(/<br\s*\/?>/g, "").replace(/\s+/g, "").trim()
    if (stripped.length < 2) return ""
    return `<${tag}>${content}</${tag}>\n`
  }

  function processRun(r, wNs) {
    const rPr = r.getElementsByTagNameNS(wNs, "rPr")[0]
    let text = ""

    // Get text content
    for (let i = 0; i < r.childNodes.length; i++) {
      const child = r.childNodes[i]
      const cName = child.localName || child.nodeName?.split(":").pop()
      if (cName === "t") {
        text += child.textContent || ""
      } else if (cName === "br") {
        text += "<br>"
      } else if (cName === "tab") {
        text += "    "
      } else if (cName === "footnoteReference") {
        const fnId = child.getAttribute("w:id") || child.getAttributeNS(wNs, "id")
        if (fnId && footnotes && footnotes[fnId]) {
          text += `<sup title="${escapeAttr(footnotes[fnId])}">[${fnId}]</sup>`
        } else if (fnId) {
          text += `<sup>[${fnId}]</sup>`
        }
      } else if (cName === "drawing") {
        // Extract image from drawing element
        const blips = child.getElementsByTagNameNS("http://schemas.openxmlformats.org/drawingml/2006/main", "blip")
        for (let bi = 0; bi < blips.length; bi++) {
          const blip = blips[bi]
          const rEmbed = blip.getAttribute("r:embed") || blip.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "embed")
          if (rEmbed && imageRels[rEmbed]) {
            text += `<img src="${imageRels[rEmbed]}" alt="image" class="inline-image">`
          }
        }
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
    // Namespace-agnostic row/cell finding
    const rows = getDirectChildElementsByLocalName(tbl, "tr")

    // Check if this table contains ANY math — if so, treat as formula table
    const allMathInTable = findElementsByLocalName(tbl, "oMath")
    if (allMathInTable.length > 0 && rows.length <= 3) {
      const blocks = []

      for (const row of rows) {
        const rowFormula = extractFormulaFromRow(row)
        if (rowFormula?.latex) {
          const labelAttr = rowFormula.label ? ` data-label="${escapeAttr(rowFormula.label)}"` : ""
          blocks.push(`<div class="math-block" data-latex="${escapeAttr(rowFormula.latex)}"${labelAttr}>${escapeHtml(rowFormula.latex)}</div>\n`)
        }
      }

      if (blocks.length > 0) {
        return blocks.join("")
      }
    }

    // Legacy path for single-row tables (kept for compatibility)
    if (rows.length === 1) {
      const cells = findElementsByLocalName(rows[0], "tc")
      if (cells.length >= 1 && cells.length <= 3) {
        // Debug: log cell contents
        const debugCells = []
        for (let ci = 0; ci < cells.length; ci++) {
          const ct = cells[ci].textContent.trim().substring(0, 30)
          const hasMath = findElementsByLocalName(cells[ci], "oMath").length
          debugCells.push(`[${ct}|math:${hasMath}]`)
        }
        console.log(`[DOCX] tbl ${cells.length} cells: ${debugCells.join(' ')}`)
        // Check if any cell contains oMath or oMathPara
        let formulaLatex = ""
        let label = ""

        for (let ci = 0; ci < cells.length; ci++) {
          const cell = cells[ci]
          const cellText = cell.textContent.trim()

          // Find math elements by walking DOM — namespace-agnostic
          const mathElements = findElementsByLocalName(cell, "oMath")
          const mathParaElements = findElementsByLocalName(cell, "oMathPara")

          if (mathParaElements.length > 0 || mathElements.length > 0) {
            // This cell contains a formula
            const mathEls = mathParaElements.length > 0
              ? findElementsByLocalName(mathParaElements[0], "oMath")
              : mathElements
            // Only use top-level oMath (not nested inside other oMath)
            const topMaths = mathEls.length > 0 ? mathEls : mathElements
            for (const m of topMaths) {
              formulaLatex += ommlToLatex(m) + " "
            }
          } else {
            // Check for formula label: (1), (2) or Word SEQ field: ( SEQ Формула \* ARABIC 1)
            console.log(`[DOCX] label cell text: "${cellText.substring(0, 60)}" (len=${cellText.length})`)
            const simpleLabel = cellText.match(/^\((\d+)\)$/)
            const seqLabel = cellText.match(/SEQ\s+\S+\s+\\?\*\s*ARABIC\s+(\d+)/)
            if (simpleLabel) {
              label = `(${simpleLabel[1]})`
            } else if (seqLabel) {
              label = `(${seqLabel[1]})`
            }
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
    const rows = findElementsByLocalName(tbl, "tr")
    for (const row of rows) {
      html += "<tr>"
      const cells = findElementsByLocalName(row, "tc")
      for (const cell of cells) {
        html += "<td>"
        for (let i = 0; i < cell.childNodes.length; i++) {
          const child = cell.childNodes[i]
          const cName = child.localName || child.nodeName?.split(":").pop()
          if (cName === "p") {
            // Don't wrap in <p> inside table cells for simplicity
            let cellContent = ""
            for (let pi = 0; pi < child.childNodes.length; pi++) {
              const pChild = child.childNodes[pi]
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

  function extractFormulaFromRow(row) {
    const cells = getDirectChildElementsByLocalName(row, "tc")
    const formulaLines = []
    let label = ""

    for (const cell of cells) {
      const hasMath = findElementsByLocalName(cell, "oMath").length > 0 || findElementsByLocalName(cell, "oMathPara").length > 0
      const cellText = normalizeFormulaWhitespace(cell.textContent || "")

      if (hasMath) {
        const cellLines = extractFormulaLinesFromCell(cell)
        if (cellLines.length > 0) {
          formulaLines.push(...cellLines)
        }
      } else if (!label) {
        label = extractFormulaLabel(cellText) || label
      }
    }

    if (formulaLines.length === 0) return null

    return {
      latex: formulaLines.join(" \\\\ "),
      label
    }
  }

  function extractFormulaLinesFromCell(cell) {
    const lines = []
    const paragraphs = getDirectChildElementsByLocalName(cell, "p")

    for (const paragraph of paragraphs) {
      const line = extractFormulaLineFromParagraph(paragraph)
      if (line) lines.push(line)
    }

    if (lines.length > 0) return lines

    const fallbackMaths = findElementsByLocalName(cell, "oMath")
    if (fallbackMaths.length === 0) return []

    return [fallbackMaths.map(m => ommlToLatex(m)).filter(Boolean).join(" ")]
  }

  function extractFormulaLineFromParagraph(paragraph) {
    let line = ""
    let hasMath = false

    for (let i = 0; i < paragraph.childNodes.length; i++) {
      const child = paragraph.childNodes[i]
      if (child.nodeType !== 1) continue
      const childName = child.localName || child.nodeName?.split(":").pop()

      if (childName === "oMath") {
        const latex = ommlToLatex(child)
        if (!latex) continue
        hasMath = true
        line = appendFormulaMath(line, latex)
      } else if (childName === "oMathPara") {
        const maths = findElementsByLocalName(child, "oMath")
        for (const math of maths) {
          const latex = ommlToLatex(math)
          if (!latex) continue
          hasMath = true
          line = appendFormulaMath(line, latex)
        }
      } else if (childName === "r") {
        line = appendFormulaText(line, extractPlainTextFromRun(child))
      }
    }

    if (!hasMath) return ""
    return normalizeFormulaWhitespace(line)
  }

  function appendFormulaMath(current, latex) {
    if (!current) return latex.trim()
    if (/[({[\s]$/.test(current)) return `${current}${latex.trim()}`
    if (/[=+\-*/]\\?$/.test(current)) return `${current}${latex.trim()}`
    return `${current} ${latex.trim()}`
  }

  function appendFormulaText(current, text) {
    const normalized = normalizeFormulaWhitespace(text)
    if (!normalized) return current

    if (/^[,.;:]$/.test(normalized)) {
      return `${current.replace(/\s+$/u, "")}${normalized}`
    }

    if (!current) return normalized
    return `${current} ${normalized}`
  }

  function extractPlainTextFromRun(run) {
    let text = ""
    for (let i = 0; i < run.childNodes.length; i++) {
      const child = run.childNodes[i]
      const childName = child.localName || child.nodeName?.split(":").pop()
      if (childName === "t" || childName === "instrText") {
        text += child.textContent || ""
      } else if (childName === "tab" || childName === "br") {
        text += " "
      }
    }
    return text
  }

  function extractFormulaLabel(text) {
    const simpleLabel = text.match(/^\((\d+)\)$/)
    const seqLabel = text.match(/SEQ\s+\S+\s+\\?\*\s*ARABIC\s+(\d+)/)
    const fieldResult = text.match(/\(?\s*(\d+)\s*\)?/)

    if (simpleLabel) return `(${simpleLabel[1]})`
    if (seqLabel) return `(${seqLabel[1]})`
    if (fieldResult && text.length < 40 && /SEQ|ARABIC/.test(text)) {
      return `(${fieldResult[1]})`
    }
    return ""
  }

  function normalizeFormulaWhitespace(text) {
    return text
      .replace(/\s+/gu, " ")
      .replace(/\s+([,.;:])/gu, "$1")
      .trim()
  }
}

/**
 * Find elements by localName — namespace-agnostic.
 * Works in any DOMParser regardless of namespace handling.
 */
function findElementsByLocalName(parent, localName) {
  const results = []
  function walk(node) {
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
      if (child.nodeType === 1) {
        const ln = child.localName || child.nodeName?.split(":").pop() || ""
        if (ln === localName) {
          results.push(child)
        } else {
          walk(child)
        }
      }
    }
  }
  walk(parent)
  return results
}

function getDirectChildElementsByLocalName(parent, localName) {
  const results = []
  for (let i = 0; i < parent.childNodes.length; i++) {
    const child = parent.childNodes[i]
    if (child.nodeType !== 1) continue
    const ln = child.localName || child.nodeName?.split(":").pop() || ""
    if (ln === localName) results.push(child)
  }
  return results
}

function getFirstDirectChildByLocalName(parent, localName) {
  return getDirectChildElementsByLocalName(parent, localName)[0] || null
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

  // Read images — convert unsupported formats
  const images = {}
  for (const [path, file] of Object.entries(zip.files)) {
    if (path.startsWith("word/media/") && !file.dir) {
      const ext = path.split(".").pop().toLowerCase()
      // Skip formats browsers can't display — mark as placeholder
      if (ext === "wmf" || ext === "emf" || ext === "tiff" || ext === "tif") {
        const fname = path.split("/").pop()
        const label = ext.toUpperCase() + ": " + fname
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="80" viewBox="0 0 400 80">' +
          '<rect fill="#f5f5f5" stroke="#ddd" width="400" height="80" rx="4"/>' +
          '<text x="200" y="45" text-anchor="middle" fill="#999" font-family="sans-serif" font-size="13">' +
          '[' + label + ']</text></svg>'
        images[path.replace("word/", "")] = "data:image/svg+xml," + encodeURIComponent(svg)
        continue
      }
      const data = await file.async("base64")
      const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "gif" ? "image/gif" : "image/" + ext
      images[path.replace("word/", "")] = `data:${mime};base64,${data}`
    }
  }

  // Read relationships to map rId -> media path
  const relsFile = zip.file("word/_rels/document.xml.rels")
  const imageRels = {}
  if (relsFile) {
    const relsXml = await relsFile.async("string")
    const relsParser = new DOMParser()
    const relsDoc = relsParser.parseFromString(relsXml, "application/xml")
    const rels = relsDoc.getElementsByTagName("Relationship")
    for (let i = 0; i < rels.length; i++) {
      const rel = rels[i]
      const id = rel.getAttribute("Id")
      const target = rel.getAttribute("Target")
      if (target && target.startsWith("media/")) {
        imageRels[id] = images[target] || null
      }
    }
  }

  // Read footnotes if present
  const footnotesFile = zip.file("word/footnotes.xml")
  let footnotes = {}
  if (footnotesFile) {
    const fnXml = await footnotesFile.async("string")
    const fnParser = new DOMParser()
    const fnDoc = fnParser.parseFromString(fnXml, "application/xml")
    const wNs = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    const fnNodes = fnDoc.getElementsByTagNameNS(wNs, "footnote")
    for (let i = 0; i < fnNodes.length; i++) {
      const fn = fnNodes[i]
      const fnId = fn.getAttribute("w:id") || fn.getAttributeNS(wNs, "id")
      if (fnId && fnId !== "0" && fnId !== "-1") {
        // Get text content of footnote
        let fnText = ""
        const runs = fn.getElementsByTagNameNS(wNs, "t")
        for (let ri = 0; ri < runs.length; ri++) {
          const t = runs[ri]
          fnText += t.textContent || ""
        }
        footnotes[fnId] = fnText.trim()
      }
    }
  }

  // Convert to HTML
  const html = docxXmlToHtml(xmlString, images, imageRels, footnotes)

  // Parse HTML into ProseMirror doc
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  const domParser = ProseDOMParser.fromSchema(schema)
  const doc = domParser.parse(tempDiv)

  return { doc, html, formulaCount: (html.match(/math-inline|math-block/g) || []).length }
}
