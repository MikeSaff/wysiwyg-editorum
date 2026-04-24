import JSZip from "jszip"
import { schema } from "./schema.js"
import { DOMParser as ProseDOMParser } from "prosemirror-model"
import { normalizeTypographyPlainText } from "./typography-rules.js"
import { detectSectionType } from "./section-heading.js"
import { extractMetadataFromImportedHtml } from "./metadata-extract.js"

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
export function ommlToLatex(ommlElement, options = {}) {
  const ns = "http://schemas.openxmlformats.org/officeDocument/2006/math"
  const { display = false } = options

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
        let ancestor = getParentElement(node)
        while (ancestor) {
          const aName = ancestor.localName || ancestor.nodeName?.split(":").pop()
          if (aName === "sup" || aName === "sub" || aName === "deg" ||
              aName === "num" || aName === "den") {
            inSubSup = true
            break
          }
          if (aName === "oMath") break
          ancestor = getParentElement(ancestor)
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
        return `${processChildren(subBase)}_{${formatIndexLatex(sub, processChildren(sub))}}`

      case "sSup": // Superscript
        const supBase = getFirstDirectChildByLocalName(node, "e")
        const sup = getFirstDirectChildByLocalName(node, "sup")
        return `${processChildren(supBase)}^{${formatIndexLatex(sup, processChildren(sup))}}`

      case "sSubSup": // Sub-superscript
        const ssbBase = getFirstDirectChildByLocalName(node, "e")
        const ssbSub = getFirstDirectChildByLocalName(node, "sub")
        const ssbSup = getFirstDirectChildByLocalName(node, "sup")
        return `${processChildren(ssbBase)}_{${formatIndexLatex(ssbSub, processChildren(ssbSub))}}^{${formatIndexLatex(ssbSup, processChildren(ssbSup))}}`

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
            // If matrix already wrapped in left-brace aligned form, return as-is
            if (innerContent.includes("\\left\\{\\begin{aligned}")) {
              return innerContent
            }
            // If content has line breaks but is not yet wrapped
            if (innerContent.includes("\\\\")) {
              return buildLeftBraceAlignedLatex(innerContent)
            }
          }
        }

        if (dElements.length === 1) {
          const innerContent = processChildren(dElements[0]).trim()
          if (isDelimitedMatrixAlreadyWrapped(innerContent, begChar, endChar)) {
            return innerContent
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
        const parentD = getParentElement(node)
        if (parentD) {
          const parentName = parentD.localName || parentD.nodeName?.split(":").pop()
          if (parentName === "e") {
            const grandParent = getParentElement(parentD)
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
          // System of equations: matrix handles left brace + aligned directly,
          // parent delimiter (d) should not wrap again
          return buildLeftBraceAlignedLatex(rows.join(" \\\\ "))
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

  const latex = normalizeGeneratedLatex(processNode(ommlElement).trim())
  return display ? applyDisplayFractionLatex(latex) : latex
}

export function ommlToMathML(ommlElement, options = {}) {
  const ns = "http://schemas.openxmlformats.org/officeDocument/2006/math"
  const { display = false, wrap = true } = options

  function processNode(node) {
    if (!node) return ""

    const localName = node.localName || node.nodeName?.split(":").pop() || ""

    switch (localName) {
      case "oMath":
        return wrapMrow(processChildren(node))

      case "r":
        return textToMathML(getMathRunText(node))

      case "f": {
        const num = getFirstDirectChildByLocalName(node, "num")
        const den = getFirstDirectChildByLocalName(node, "den")
        return `<mfrac>${wrapMrow(processChildren(num))}${wrapMrow(processChildren(den))}</mfrac>`
      }

      case "sSub": {
        const base = getFirstDirectChildByLocalName(node, "e")
        const sub = getFirstDirectChildByLocalName(node, "sub")
        return `<msub>${wrapMrow(processChildren(base))}${formatIndexMathML(sub, processChildren(sub))}</msub>`
      }

      case "sSup": {
        const base = getFirstDirectChildByLocalName(node, "e")
        const sup = getFirstDirectChildByLocalName(node, "sup")
        return `<msup>${wrapMrow(processChildren(base))}${formatIndexMathML(sup, processChildren(sup))}</msup>`
      }

      case "sSubSup": {
        const base = getFirstDirectChildByLocalName(node, "e")
        const sub = getFirstDirectChildByLocalName(node, "sub")
        const sup = getFirstDirectChildByLocalName(node, "sup")
        return `<msubsup>${wrapMrow(processChildren(base))}${formatIndexMathML(sub, processChildren(sub))}${formatIndexMathML(sup, processChildren(sup))}</msubsup>`
      }

      case "rad": {
        const degree = getFirstDirectChildByLocalName(node, "deg")
        const radicand = getFirstDirectChildByLocalName(node, "e")
        const degreeMathML = processChildren(degree)
        if (normalizeMathMLContent(degreeMathML)) {
          return `<mroot>${wrapMrow(processChildren(radicand))}${wrapMrow(degreeMathML)}</mroot>`
        }
        return `<msqrt>${wrapMrow(processChildren(radicand))}</msqrt>`
      }

      case "d": {
        const dPr = getFirstDirectChildByLocalName(node, "dPr")
        let begChar = "("
        let endChar = ")"
        if (dPr) {
          const beg = getFirstDirectChildByLocalName(dPr, "begChr")
          const end = getFirstDirectChildByLocalName(dPr, "endChr")
          if (beg) {
            const bv = beg.getAttribute("m:val") ?? beg.getAttributeNS(ns, "val")
            if (bv !== null && bv !== undefined) begChar = bv
          }
          if (end) {
            const ev = end.getAttribute("m:val") ?? end.getAttributeNS(ns, "val")
            if (ev !== null && ev !== undefined) endChar = ev
          }
        }

        const eElements = getDirectChildElementsByLocalName(node, "e")
        let innerContent = ""
        if (eElements.length === 1) {
          innerContent = processChildren(eElements[0])
        } else if (eElements.length > 1) {
          innerContent = eElements.map((e) => wrapMrow(processChildren(e))).join("")
        }

        const isLeftBraceSystem = begChar === "{" && (endChar === "" || endChar === " ")
        if (isLeftBraceSystem && /<mtable\b/.test(innerContent)) {
          const displayTable = innerContent.replace(/<mtable(?![^>]*displaystyle=)/, '<mtable displaystyle="true"')
          return `<mfenced open="{" close="" separators="">${displayTable}</mfenced>`
        }

        const useStretchy = !(begChar === "(" && endChar === ")")
        const parts = []
        if (begChar && begChar !== " ") {
          parts.push(
            `<mo fence="true" form="prefix" stretchy="${useStretchy ? "true" : "false"}">${escapeXml(begChar)}</mo>`
          )
        }
        parts.push(innerContent)
        if (endChar && endChar !== " " && endChar !== "") {
          parts.push(
            `<mo fence="true" form="postfix" stretchy="${useStretchy ? "true" : "false"}">${escapeXml(endChar)}</mo>`
          )
        } else if (begChar && begChar !== " ") {
          parts.push(
            `<mo fence="true" form="postfix" stretchy="${useStretchy ? "true" : "false"}" style="visibility:hidden">.</mo>`
          )
        }
        return wrapMrow(parts.join(""))
      }

      case "nary": {
        const naryPr = getFirstDirectChildByLocalName(node, "naryPr")
        const narySub = getFirstDirectChildByLocalName(node, "sub")
        const narySup = getFirstDirectChildByLocalName(node, "sup")
        const naryE = getFirstDirectChildByLocalName(node, "e")
        let operator = "∫"
        if (naryPr) {
          const chr = naryPr.getElementsByTagNameNS(ns, "chr")[0]
          const val = chr ? (chr.getAttribute("m:val") || chr.getAttributeNS(ns, "val")) : null
          if (val) operator = val
        }
        const op = `<mo>${escapeXml(operator)}</mo>`
        const sub = processChildren(narySub)
        const sup = processChildren(narySup)
        const body = processChildren(naryE)
        let head = op
        if (sub && sup) {
          const scriptedTag = operator === "∑" || operator === "Σ" || operator === "∏" || operator === "Π" ? "munderover" : "msubsup"
          head = `<${scriptedTag}>${op}${wrapMrow(sub)}${wrapMrow(sup)}</${scriptedTag}>`
        } else if (sub) {
          head = `<msub>${op}${wrapMrow(sub)}</msub>`
        } else if (sup) {
          head = `<msup>${op}${wrapMrow(sup)}</msup>`
        }
        return wrapMrow(`${head}${wrapMrow(body)}`)
      }

      case "acc": {
        const accPr = getFirstDirectChildByLocalName(node, "accPr")
        const accE = getFirstDirectChildByLocalName(node, "e")
        let accent = "̂"
        if (accPr) {
          const accChr = accPr.getElementsByTagNameNS(ns, "chr")[0]
          accent = accChr ? (accChr.getAttribute("m:val") || accChr.getAttributeNS(ns, "val") || accent) : accent
        }
        return `<mover accent="true">${wrapMrow(processChildren(accE))}<mo>${escapeXml(accent)}</mo></mover>`
      }

      case "m": {
        const rows = []
        const directMrs = getDirectChildElementsByLocalName(node, "mr")
        for (const row of directMrs) {
          const cells = getDirectChildElementsByLocalName(row, "e")
            .map((cell) => `<mtd>${wrapMrow(processChildren(cell))}</mtd>`)
            .join("")
          rows.push(`<mtr>${cells}</mtr>`)
        }
        return `<mtable>${rows.join("")}</mtable>`
      }

      case "eqArr": {
        const rows = getDirectChildElementsByLocalName(node, "e")
          .map((row) => `<mtr><mtd>${wrapMrow(processChildren(row))}</mtd></mtr>`)
          .join("")
        return `<mtable>${rows}</mtable>`
      }

      case "bar": {
        const barE = getFirstDirectChildByLocalName(node, "e")
        return `<mover accent="true">${wrapMrow(processChildren(barE))}<mo>¯</mo></mover>`
      }

      case "box": {
        const boxE = getFirstDirectChildByLocalName(node, "e")
        return wrapMrow(processChildren(boxE))
      }

      case "func": {
        const fName = getFirstDirectChildByLocalName(node, "fName")
        const funcE = getFirstDirectChildByLocalName(node, "e")
        return wrapMrow(`${processChildren(fName)}${wrapMrow(processChildren(funcE))}`)
      }

      case "groupChr": {
        const gcE = getFirstDirectChildByLocalName(node, "e")
        return wrapMrow(processChildren(gcE))
      }

      case "limLow": {
        const limBase = getFirstDirectChildByLocalName(node, "e")
        const limLim = getFirstDirectChildByLocalName(node, "lim")
        return `<munder>${wrapMrow(processChildren(limBase))}${wrapMrow(processChildren(limLim))}</munder>`
      }

      case "limUpp": {
        const limBase = getFirstDirectChildByLocalName(node, "e")
        const limLim = getFirstDirectChildByLocalName(node, "lim")
        return `<mover>${wrapMrow(processChildren(limBase))}${wrapMrow(processChildren(limLim))}</mover>`
      }

      case "e":
      case "num":
      case "den":
      case "sub":
      case "sup":
      case "deg":
      case "lim":
      case "fName":
        return wrapMrow(processChildren(node))

      case "t":
        return textToMathML(node.textContent || "")

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

      default:
        return processChildren(node)
    }
  }

  function processChildren(node) {
    if (!node) return ""
    let result = ""
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i]
      if (child.nodeType === 1) {
        result += processNode(child)
      }
    }
    return result
  }

  const content = normalizeMathMLContent(processNode(ommlElement))
  const normalizedContent = display ? applyDisplayFractionMathML(content) : content
  if (!wrap) return normalizedContent
  return `<math xmlns="http://www.w3.org/1998/Math/MathML"${display ? ' display="block"' : ""}>${wrapMrow(normalizedContent)}</math>`
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
            const latex = ommlToLatex(oMath, { display: true })
            const mathml = ommlToMathML(oMath, { display: true })
            if (latex || mathml) {
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
              html += renderMathHtml({ display: true, latex, mathml, labelAttr })
            }
          }
        }
      } else {
        const paragraph = processParagraphDescriptor(child, wNs, mNs)
        if (!paragraph) continue

        if (paragraph.tag === "p" && paragraph.isImageOnly) {
          const nextParagraph = getBodyParagraphDescriptor(bodyChildren, idx + 1, wNs, mNs)
          if (nextParagraph?.styleType === "fig-caption") {
            html += renderFigureBlockHtml(paragraph, nextParagraph)
            skipIndices.add(idx + 1)
            continue
          }
        }

        if (paragraph.tag === "p" && (paragraph.styleType === "table-number" || paragraph.styleType === "table-caption")) {
          const tableWrap = getFollowingTableWrap(bodyChildren, idx, paragraph, wNs, mNs)
          if (tableWrap) {
            html += tableWrap.html
            tableWrap.skipIndices.forEach((skipIndex) => skipIndices.add(skipIndex))
            continue
          }
        }

        html += paragraph.html
      }
    } else if (localName === "tbl") {
      // Check if table is actually a formula container (Word trick)
      const tblHtml = processTableOrFormula(child, wNs, mNs)
      html += tblHtml
    } else if (localName === "oMathPara") {
      // Display math paragraph (top-level)
      const oMaths = findElementsByLocalName(child, "oMath")
      for (const oMath of oMaths) {
        const latex = ommlToLatex(oMath, { display: true })
        const mathml = ommlToMathML(oMath, { display: true })
        if (latex || mathml) {
          html += renderMathHtml({ display: true, latex, mathml })
        }
      }
    }
  }

  return html

  function processParagraphDescriptor(p, wNs, mNs) {
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
        const mathml = ommlToMathML(child)
        if (latex || mathml) {
          content = appendInlineMathWithSpacing(content, p.childNodes, i, renderMathHtml({ display: false, latex, mathml }).trim(), wNs)
          hasContent = true
        }
      } else if (cName === "oMathPara") {
        // Display math inside paragraph
        let inlineMathContent = ""
        const oMaths = findElementsByLocalName(child, "oMath")
        for (const oMath of oMaths) {
          const latex = ommlToLatex(oMath)
          const mathml = ommlToMathML(oMath)
          if (latex || mathml) {
            inlineMathContent += renderMathHtml({ display: false, latex, mathml }).trim()
            hasContent = true
          }
        }
        if (inlineMathContent) {
          content = appendInlineMathWithSpacing(content, p.childNodes, i, inlineMathContent, wNs)
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
    // Skip empty or near-empty paragraphs
    const stripped = content.replace(/&nbsp;/g, "").replace(/<br\s*\/?>/g, "").replace(/\s+/g, "").trim()
    if (stripped.length < 2) return ""

    // Auto-detect caption styles by text pattern
    const plainText = content.replace(/<[^>]+>/g, "").trim()
    let styleType = null
    if (/^(Рис\.|Рисунок)\s*\d/i.test(plainText)) {
      styleType = "fig-caption"
    } else if (/^(Табл\.|Таблица)\s*\d/i.test(plainText)) {
      styleType = /^(Табл\.|Таблица)\s*\d+\s*$/i.test(plainText) ? "table-number" : "table-caption"
    }

    const id = createImportedNodeId()
    const sectionType = tag.startsWith("h") ? detectSectionType(plainText) : null
    const attrs = buildImportedElementAttrs({
      id,
      className: styleType ? `style-${styleType}` : "",
      sectionType
    })

    return {
      id,
      tag,
      level,
      content,
      plainText,
      styleType,
      isImageOnly: tag === "p" && /^\s*<img\b[^>]*>\s*$/iu.test(content),
      html: `<${tag}${attrs}>${content}</${tag}>\n`
    }
  }

  function getBodyParagraphDescriptor(children, index, wNs, mNs) {
    const next = children[index]
    if (!next) return null
    const nextName = next.localName || next.nodeName?.split(":").pop()
    if (nextName !== "p") return null
    if (findElementsByLocalName(next, "oMathPara").length > 0) return null
    return processParagraphDescriptor(next, wNs, mNs) || null
  }

  function getFollowingTableWrap(children, index, firstParagraph, wNs, mNs) {
    const next = children[index + 1]
    const nextName = next?.localName || next?.nodeName?.split(":").pop()

    if (firstParagraph.styleType === "table-caption" && nextName === "tbl") {
      return {
        html: renderTableBlockHtml({ numberParagraph: null, captionParagraph: firstParagraph, tableHtml: processTable(next, wNs, mNs) }),
        skipIndices: [index + 1]
      }
    }

    if (firstParagraph.styleType !== "table-number") return null

    if (nextName === "tbl") {
      return {
        html: renderTableBlockHtml({ numberParagraph: firstParagraph, captionParagraph: null, tableHtml: processTable(next, wNs, mNs) }),
        skipIndices: [index + 1]
      }
    }

    const secondParagraph = getBodyParagraphDescriptor(children, index + 1, wNs, mNs)
    const third = children[index + 2]
    const thirdName = third?.localName || third?.nodeName?.split(":").pop()
    if (secondParagraph?.styleType === "table-caption" && thirdName === "tbl") {
      return {
        html: renderTableBlockHtml({
          numberParagraph: firstParagraph,
          captionParagraph: secondParagraph,
          tableHtml: processTable(third, wNs, mNs)
        }),
        skipIndices: [index + 1, index + 2]
      }
    }

    return null
  }

  function renderFigureBlockHtml(imageParagraph, captionParagraph) {
    const figureId = createImportedNodeId()
    const captionContent = normalizeImportedParagraphHtml(captionParagraph.content, ' class="style-fig-caption"')
    return `<figure id="${escapeAttr(figureId)}">${imageParagraph.content}<figcaption>${captionContent}</figcaption></figure>\n`
  }

  function renderTableBlockHtml({ numberParagraph, captionParagraph, tableHtml }) {
    const tableId = createImportedNodeId()
    const parts = []
    if (numberParagraph) parts.push(numberParagraph.html.trim())
    if (captionParagraph) parts.push(captionParagraph.html.trim())
    parts.push(tableHtml.trim())
    return `<div class="table-wrap" id="${escapeAttr(tableId)}">${parts.join("")}</div>\n`
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
        text += " "
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
          blocks.push(renderMathHtml({ display: true, latex: rowFormula.latex, mathml: rowFormula.mathml, labelAttr }))
          if (rowFormula.trailingHtml) {
            blocks.push(rowFormula.trailingHtml)
          }
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
              formulaLatex += ommlToLatex(m, { display: true }) + " "
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
          return renderMathHtml({
            display: true,
            latex: formulaLatex.trim(),
            mathml: wrapFormulaMathML([{ latex: formulaLatex.trim(), mathml: textToMathML(formulaLatex.trim()) }], false),
            labelAttr
          })
        }
      }
    }

    // Not a formula table — process as regular table
    return processTable(tbl, wNs, mNs)
  }

  function processTable(tbl, wNs, mNs) {
    let html = `<table id="${escapeAttr(createImportedNodeId())}">`
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
                const mathml = ommlToMathML(pChild)
                if (latex || mathml) {
                  cellContent = appendInlineMathWithSpacing(cellContent, child.childNodes, pi, renderMathHtml({ display: false, latex, mathml }).trim(), wNs)
                }
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
    const auxiliarySegments = []
    let label = ""

    for (const cell of cells) {
      const hasMath = findElementsByLocalName(cell, "oMath").length > 0 || findElementsByLocalName(cell, "oMathPara").length > 0
      const cellText = normalizeFormulaWhitespace(cell.textContent || "")

      if (hasMath) {
        const cellContent = extractFormulaContentFromCell(cell)
        formulaLines.push(...cellContent.formulaLines)
        auxiliarySegments.push(...cellContent.auxiliarySegments)
      } else if (!label) {
        label = extractFormulaLabel(cellText) || label
      }
    }

    if (formulaLines.length === 0) return null

    return {
      latex: formatFormulaLines(formulaLines),
      mathml: wrapFormulaMathML(formulaLines, shouldWrapFormulaLinesInCases(formulaLines)),
      label,
      trailingHtml: buildAuxiliaryMathParagraph(auxiliarySegments)
    }
  }

  function extractFormulaContentFromCell(cell) {
    const formulaLines = []
    const auxiliarySegments = []
    const paragraphs = getDirectChildElementsByLocalName(cell, "p")

    for (const paragraph of paragraphs) {
      const segments = extractFormulaSegmentsFromParagraph(paragraph)
      if (segments.length === 0) continue
      const auxiliaryOnly = segments.every((segment) => isAuxiliaryFormulaSegment(segment))
      if (auxiliaryOnly && shouldMergeAuxiliarySegmentsIntoFormula(formulaLines, segments)) {
        formulaLines.push(combineAuxiliarySegmentsIntoLine(segments))
        continue
      }
      for (const segment of segments) {
        if (isAuxiliaryFormulaSegment(segment)) {
          auxiliarySegments.push(segment)
        } else {
          formulaLines.push(segment)
        }
      }
    }

    if (formulaLines.length > 0 || auxiliarySegments.length > 0) {
      return { formulaLines, auxiliarySegments }
    }

    const fallbackMaths = findElementsByLocalName(cell, "oMath")
    if (fallbackMaths.length === 0) {
      return { formulaLines: [], auxiliarySegments: [] }
    }

    return {
      formulaLines: fallbackMaths.map((m) => ({
        latex: ommlToLatex(m),
        mathml: ommlToMathML(m, { wrap: false })
      })).filter((line) => line.latex || line.mathml),
      auxiliarySegments: []
    }
  }

  function extractFormulaSegmentsFromParagraph(paragraph) {
    let line = { latex: "", mathml: "" }
    let hasMath = false
    const segments = []
    const meaningfulChildren = []

    for (let i = 0; i < paragraph.childNodes.length; i++) {
      const child = paragraph.childNodes[i]
      if (child.nodeType !== 1) continue
      const childName = child.localName || child.nodeName?.split(":").pop()
      if (childName === "pPr") continue
      meaningfulChildren.push(child)
    }

    function flushSegment() {
      const normalizedLatex = normalizeFormulaWhitespace(line.latex)
      const normalizedMathML = normalizeMathMLContent(line.mathml)
      if (normalizedLatex || normalizedMathML) {
        segments.push({ latex: normalizedLatex, mathml: normalizedMathML })
      }
      line = { latex: "", mathml: "" }
      hasMath = false
    }

    for (let i = 0; i < meaningfulChildren.length; i++) {
      const child = meaningfulChildren[i]
      const childName = child.localName || child.nodeName?.split(":").pop()
      const nextMeaningfulChild = getNextFormulaRelevantChild(meaningfulChildren, i + 1)

      if (childName === "oMath") {
        const payload = {
          latex: ommlToLatex(child),
          mathml: ommlToMathML(child, { wrap: false })
        }
        if (!payload.latex && !payload.mathml) continue
        hasMath = true
        line = appendFormulaMath(line, payload)
      } else if (childName === "oMathPara") {
        const maths = findElementsByLocalName(child, "oMath")
        for (const math of maths) {
          const payload = {
            latex: ommlToLatex(math),
            mathml: ommlToMathML(math, { wrap: false })
          }
          if (!payload.latex && !payload.mathml) continue
          hasMath = true
          line = appendFormulaMath(line, payload)
        }
      } else if (childName === "r") {
        const runText = extractPlainTextFromRun(child)
        line = appendFormulaText(line, runText)
        if (hasMath && shouldSplitFormulaSegment(runText, nextMeaningfulChild)) {
          flushSegment()
        }
      }
    }

    if (hasMath || normalizeFormulaWhitespace(line.latex)) {
      flushSegment()
    }

    return segments
  }

  function appendFormulaMath(current, payload) {
    const nextLatex = payload.latex?.trim() || ""
    const nextMathML = payload.mathml || ""
    if (!current.latex) {
      return { latex: nextLatex, mathml: `${current.mathml}${nextMathML}` }
    }
    if (/[({[\s]$/.test(current.latex) || /[=+\-*/]\\?$/.test(current.latex)) {
      return { latex: `${current.latex}${nextLatex}`, mathml: `${current.mathml}${nextMathML}` }
    }
    return { latex: `${current.latex} ${nextLatex}`, mathml: `${current.mathml}${nextMathML}` }
  }

  function appendFormulaText(current, text) {
    const normalized = normalizeFormulaWhitespace(text)
    if (!normalized) return current

    if (/^[,.;:]$/.test(normalized)) {
      return {
        latex: `${current.latex.replace(/\s+$/u, "")}${normalized}`,
        mathml: `${current.mathml}${textToMathML(normalized)}`
      }
    }

    if (!current.latex) {
      return { latex: normalized, mathml: `${current.mathml}${textToMathML(normalized)}` }
    }
    return {
      latex: `${current.latex} ${normalized}`,
      mathml: `${current.mathml}${textToMathML(normalized)}`
    }
  }

  function shouldSplitFormulaSegment(runText, nextMeaningfulChild) {
    const normalized = normalizeFormulaWhitespace(runText)
    if (!normalized) return false
    if (!/[,;.]$/.test(normalized)) return false
    if (!nextMeaningfulChild) return false
    const nextName = nextMeaningfulChild.localName || nextMeaningfulChild.nodeName?.split(":").pop()
    return nextName === "oMath" || nextName === "oMathPara"
  }

  function getNextFormulaRelevantChild(children, startIndex) {
    for (let i = startIndex; i < children.length; i++) {
      const child = children[i]
      const childName = child.localName || child.nodeName?.split(":").pop()
      if (childName !== "r") return child
      if (normalizeFormulaWhitespace(extractPlainTextFromRun(child))) return child
    }
    return null
  }

  function isAuxiliaryFormulaSegment(segment) {
    return !segment.latex.includes("=") && /\\in|\\notin|\\subset|\\supset/.test(segment.latex)
  }

  function shouldMergeAuxiliarySegmentsIntoFormula(formulaLines, segments) {
    if (formulaLines.length >= 2) return true
    if (formulaLines.length >= 1 && segments.length >= 2) return true
    return false
  }

  function combineAuxiliarySegmentsIntoLine(segments) {
    return {
      latex: segments
        .map((segment) => normalizeFormulaWhitespace(segment.latex))
        .filter(Boolean)
        .join("\\; "),
      mathml: segments
        .map((segment) => normalizeMathMLContent(segment.mathml))
        .filter(Boolean)
        .join('<mspace width="0.2778em"/>')
    }
  }

  function formatFormulaLines(lines) {
    const normalizedLines = lines
      .map(line => applyDisplayFractionLatex(normalizeFormulaWhitespace(line.latex)))
      .filter(Boolean)

    if (normalizedLines.length === 0) return ""

    const joined = normalizedLines.join(" \\\\ ")
    if (shouldWrapFormulaLinesInCases(lines)) {
      return `\\begin{cases} ${joined} \\end{cases}`
    }
    if (normalizedLines.length > 1) {
      return buildLeftAlignedArrayLatex(joined)
    }
    return joined
  }

  function shouldWrapFormulaLinesInCases(lines) {
    // Never wrap — cases should come from OMML structure itself
    // (handled by ommlNodeToMathML "d" case with begChr="{" endChr="")
    // Adding extra { at wrapFormulaMathML level was causing
    // false positives (formulas 2, 4, 11)
    return false
  }

  function buildAuxiliaryMathParagraph(segments) {
    if (segments.length === 0) return ""
    const content = segments
      .map(segment => renderMathHtml({ display: false, latex: segment.latex, mathml: wrapInlineMathML(segment.mathml) }).trim())
      .join(" ")
    return `<p>${content}</p>\n`
  }

  function renderMathHtml({ display, latex, mathml, labelAttr = "" }) {
    const finalLatex = (latex || "").trim()
    const finalMathml = mathml || ""
    const attrs = ` data-mathml="${escapeAttr(finalMathml)}" data-latex="${escapeAttr(finalLatex)}"`
    if (display) {
      return `<div class="math-block"${attrs}${labelAttr} id="${escapeAttr(createImportedNodeId())}">${finalMathml || escapeHtml(finalLatex)}</div>\n`
    }
    return `<span class="math-inline"${attrs}>${finalMathml || escapeHtml(finalLatex)}</span>`
  }

  function wrapInlineMathML(mathml) {
    const content = normalizeMathMLContent(mathml)
    if (!content) return ""
    return `<math xmlns="http://www.w3.org/1998/Math/MathML">${wrapMrow(content)}</math>`
  }

  function wrapFormulaMathML(lines, asCases = false) {
    if (lines.length === 0) return ""
    if (lines.length === 1 && !asCases) {
      const mathml = normalizeMathMLContent(lines[0].mathml) || textToMathML(lines[0].latex)
      return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${wrapMrow(applyDisplayFractionMathML(mathml))}</math>`
    }

    const rows = lines
      .map((line) => {
        const mathml = normalizeMathMLContent(line.mathml) || textToMathML(line.latex)
        return `<mtr><mtd>${wrapMrow(applyDisplayFractionMathML(mathml))}</mtd></mtr>`
      })
      .join("")
    const table = asCases ? `<mtable>${rows}</mtable>` : `<mtable columnalign="left">${rows}</mtable>`
    const content = asCases
      ? `<mfenced open="{" close="" separators=""><mrow>${table}</mrow></mfenced>`
      : table
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${content}</math>`
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

  function appendInlineMathWithSpacing(content, siblings, index, mathHtml, wNs) {
    let nextContent = content
    const prevText = getAdjacentInlineText(siblings, index, -1, wNs)
    const nextText = getAdjacentInlineText(siblings, index, 1, wNs)

    if (shouldInsertSpaceBeforeInlineMath(prevText) && !/\s$/u.test(nextContent)) {
      nextContent += " "
    }

    nextContent += mathHtml

    if (shouldInsertSpaceAfterInlineMath(nextText) && !/\s$/u.test(nextContent)) {
      nextContent += " "
    }

    return nextContent
  }

  function getAdjacentInlineText(siblings, index, direction, wNs) {
    for (let i = index + direction; i >= 0 && i < siblings.length; i += direction) {
      const sibling = siblings[i]
      if (sibling.nodeType !== 1) continue
      const siblingName = sibling.localName || sibling.nodeName?.split(":").pop()
      if (siblingName === "pPr") continue
      if (siblingName === "r") return extractPlainTextFromRun(sibling)
      if (siblingName === "hyperlink") return extractPlainTextFromHyperlink(sibling)
      return ""
    }
    return ""
  }

  function shouldInsertSpaceBeforeInlineMath(prevText) {
    const trimmed = (prevText || "").replace(/\s+$/u, "")
    if (!trimmed) return false
    const lastChar = Array.from(trimmed).pop() || ""
    return /[\p{Letter}\p{Number},;]/u.test(lastChar)
  }

  function shouldInsertSpaceAfterInlineMath(nextText) {
    if (!nextText) return false
    if (/^\s/u.test(nextText)) return false
    const firstChar = Array.from(nextText)[0] || ""
    if (/^[,.;:!?)\]}»"]$/u.test(firstChar)) return false
    return true
  }
}

export function normalizeImportedHtml(html) {
  if (!html) return ""

  let out = html.replace(/<p([^>]*)>([\s\S]*?)<\/p>\n?/gu, (match, attrs = "", inner = "") => {
    const normalizedInner = normalizeImportedParagraphHtml(inner, attrs)
    const normalizedAttrs = normalizeImportedParagraphAttrs(attrs, normalizedInner)
    if (shouldDropImportedParagraph(normalizedInner)) {
      return ""
    }
    return `<p${normalizedAttrs}>${normalizedInner}</p>\n`
  })

  // v0.48: weak-path journals — UPPERCASE + whole-paragraph bold → h2 (browser / import pipeline only)
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    try {
      const holder = document.createElement("div")
      holder.innerHTML = out
      applyWeakPathUppercaseHeadingHeuristicToRoot(holder)
      out = holder.innerHTML
    } catch {
      // keep out
    }
  }
  return out
}

/**
 * Promote `<p><strong>SECTION TITLE</strong></p>` (etc.) to `<h2>` when the paragraph matches
 * weak-path heuristics. Mutates `root` in place (fragment or element).
 * @param {ParentNode & { querySelectorAll: typeof Element.prototype.querySelectorAll }} root
 */
export function applyWeakPathUppercaseHeadingHeuristicToRoot(root) {
  if (!root || typeof root.querySelectorAll !== "function") return

  const heuristicHeadings = []
  root.querySelectorAll("p").forEach((p) => {
    const text = (p.textContent || "").trim()
    if (p.querySelector("img, .math-inline, .math-block, table")) return
    if (text.length < 3 || text.length > 80) return
    if (!/[А-ЯA-Z]/.test(text)) return
    if (text !== text.toUpperCase()) return
    if (/[а-яa-z]/.test(text)) return
    const strongText = Array.from(p.querySelectorAll("strong, b"))
      .map((s) => s.textContent || "")
      .join("")
      .trim()
    if (strongText !== text) return
    heuristicHeadings.push(p)
  })

  heuristicHeadings.forEach((p) => {
    const ownerDoc = p.ownerDocument || ("ownerDocument" in root ? root.ownerDocument : null)
    if (!ownerDoc || typeof ownerDoc.createElement !== "function") return
    const h2 = ownerDoc.createElement("h2")
    h2.textContent = (p.textContent || "").trim()
    const sectionType = detectSectionType(h2.textContent)
    h2.setAttribute("id", createImportedNodeId())
    if (sectionType) h2.setAttribute("data-section-type", sectionType)
    p.replaceWith(h2)
  })
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

function getParentElement(node) {
  let parent = node?.parentElement || node?.parentNode || null
  while (parent && parent.nodeType !== 1) {
    parent = parent.parentNode || null
  }
  return parent || null
}

function getMathRunText(node) {
  const texts = node.getElementsByTagNameNS("http://schemas.openxmlformats.org/officeDocument/2006/math", "t")
  let result = ""
  for (let i = 0; i < texts.length; i++) {
    result += texts[i].textContent || ""
  }
  return result
}

function extractPlainTextFromHyperlink(node) {
  let text = ""
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i]
    if (child.nodeType !== 1) continue
    const childName = child.localName || child.nodeName?.split(":").pop()
    if (childName === "r") {
      for (let j = 0; j < child.childNodes.length; j++) {
        const runChild = child.childNodes[j]
        const runChildName = runChild.localName || runChild.nodeName?.split(":").pop()
        if (runChildName === "t" || runChildName === "instrText") {
          text += runChild.textContent || ""
        } else if (runChildName === "br" || runChildName === "tab") {
          text += " "
        }
      }
    } else if (childName === "t") {
      text += child.textContent || ""
    } else if (childName === "br" || childName === "tab") {
      text += " "
    }
  }
  return text
}

function wrapMrow(content) {
  const normalized = normalizeMathMLContent(content)
  if (!normalized) return "<mrow></mrow>"
  if (/^\s*<mrow[\s>]/.test(normalized) && /<\/mrow>\s*$/.test(normalized)) return normalized
  return `<mrow>${normalized}</mrow>`
}

function normalizeMathMLContent(content) {
  return (content || "").replace(/\s+/gu, " ").trim()
}

function textToMathML(text) {
  const normalized = (text || "").trim()
  if (!normalized) return ""

  const tokens = []
  let buffer = ""
  let currentType = ""
  const chars = Array.from(normalized)

  function flush() {
    if (!buffer) return
    if (currentType === "mi") tokens.push(`<mi>${escapeXml(buffer)}</mi>`)
    else if (currentType === "mn") tokens.push(`<mn>${escapeXml(buffer)}</mn>`)
    else if (currentType === "mtext") tokens.push(`<mtext>${escapeXml(buffer)}</mtext>`)
    buffer = ""
  }

  // Unicode symbol normalization for MathML
  const symbolMap = {
    '∙': '⋅',  // bullet operator → dot operator (smaller)
    '•': '⋅',  // bullet → dot
    '−': '−',  // minus sign (keep)
    '⨂': '⊗', // large tensor → normal tensor
    '⨁': '⊕', // large oplus → normal
  }

  for (let char of chars) {
    char = symbolMap[char] || char

    if (/\s/u.test(char)) {
      flush()
      currentType = ""
      continue
    }

    const type = classifyMathChar(char)
    if (type === "mo") {
      flush()
      tokens.push(`<mo>${escapeXml(char)}</mo>`)
      currentType = ""
      continue
    }

    if (type !== currentType && buffer) {
      flush()
    }
    currentType = type
    buffer += char
  }

  flush()
  return tokens.join("")
}

function classifyMathChar(char) {
  if (/\p{Number}/u.test(char)) return "mn"
  if (/^[=+\-−*∙•·∞∈∉⊂⊃∀∃≤≥≠≈→←↔≺≻∂∇…⋯,:;()[\]{}|‖/\\]$/u.test(char)) return "mo"
  if (/\p{Letter}/u.test(char)) return "mi"
  return "mtext"
}

function escapeXml(text) {
  return (text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function escapeAttr(text) {
  return text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function createImportedNodeId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID()
  }
  return `import-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function buildImportedElementAttrs({ id = null, className = "", sectionType = null }) {
  let attrs = ""
  if (id) attrs += ` id="${escapeAttr(id)}"`
  if (className) attrs += ` class="${escapeAttr(className)}"`
  if (sectionType) attrs += ` data-section-type="${escapeAttr(sectionType)}"`
  return attrs
}

function normalizeImportedParagraphHtml(inner, attrs = "") {
  const normalizedAttrText = attrs || ""
  const protectedSegments = []
  let nextInner = protectImportedHtmlSegments(inner || "", protectedSegments)
  nextInner = normalizeImportedTextSegments(nextInner)
  nextInner = restoreImportedHtmlSegments(nextInner, protectedSegments)

  if (/style-fig-caption/.test(normalizedAttrText) || isFigureCaptionText(nextInner)) {
    nextInner = fixFigureCaptionDot(nextInner)
  }

  return nextInner
}

function normalizeImportedParagraphAttrs(attrs, inner) {
  let nextAttrs = attrs || ""
  const plainText = getImportedParagraphPlainText(inner)
  if (/^\d+[.)]\s/u.test(plainText)) {
    nextAttrs = addClassToHtmlAttrs(nextAttrs, "list-item-numbered")
  }
  return nextAttrs
}

function getImportedParagraphPlainText(inner) {
  return (inner || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, "\u00A0")
    .trim()
}

function addClassToHtmlAttrs(attrs, className) {
  const nextAttrs = attrs || ""
  const classPattern = /\bclass="([^"]*)"/u
  const classMatch = nextAttrs.match(classPattern)

  if (!classMatch) {
    return `${nextAttrs} class="${className}"`
  }

  const classes = classMatch[1]
    .split(/\s+/u)
    .map((value) => value.trim())
    .filter(Boolean)

  if (classes.includes(className)) {
    return nextAttrs
  }

  classes.push(className)
  return nextAttrs.replace(classPattern, `class="${classes.join(" ")}"`)
}

function protectImportedHtmlSegments(html, protectedSegments) {
  return (html || "").replace(
    /<span\b(?=[^>]*\bclass="[^"]*\bmath-inline\b[^"]*")[^>]*>[\s\S]*?<\/span>|<div\b(?=[^>]*\bclass="[^"]*\bmath-block\b[^"]*")[^>]*>[\s\S]*?<\/div>|<img\b[^>]*>/giu,
    (segment) => {
      const token = `__IMPORTED_SEGMENT_${protectedSegments.length}__`
      protectedSegments.push(segment)
      return token
    }
  )
}

function restoreImportedHtmlSegments(html, protectedSegments) {
  return protectedSegments.reduce(
    (nextHtml, segment, index) => nextHtml.replace(`__IMPORTED_SEGMENT_${index}__`, segment),
    html || ""
  )
}

function normalizeImportedTextSegments(html) {
  const parts = (html || "").split(/(<[^>]+>)/gu)
  const textIndexes = []

  for (let index = 0; index < parts.length; index++) {
    if (/^<[^>]+>$/u.test(parts[index])) continue
    parts[index] = normalizeImportedTextNode(parts[index])
    textIndexes.push(index)
  }

  const firstIndex = textIndexes.find((index) => parts[index].length > 0)
  const lastIndex = [...textIndexes].reverse().find((index) => parts[index].length > 0)

  if (firstIndex !== undefined) {
    parts[firstIndex] = parts[firstIndex].replace(/^[ \t]+/u, "")
  }

  if (lastIndex !== undefined) {
    parts[lastIndex] = parts[lastIndex].replace(/[ \t]+$/u, "")
  }

  normalizeImportedTextSegmentBoundaries(parts, textIndexes)

  return parts.join("")
}

function normalizeImportedTextSegmentBoundaries(parts, textIndexes) {
  for (let index = 0; index < textIndexes.length; index++) {
    const currentPartIndex = textIndexes[index]
    let currentText = parts[currentPartIndex]

    if (!currentText) continue

    currentText = currentText.replace(/^[ \t]+([,.;:!?)\]}»"])/u, "$1")

    if (index > 0) {
      const previousPartIndex = textIndexes[index - 1]
      const previousText = parts[previousPartIndex] || ""

      if (/[ \t]$/u.test(previousText) && /^[ \t]+/u.test(currentText)) {
        currentText = currentText.replace(/^[ \t]+/u, "")
      } else if (!/[ \t]$/u.test(previousText) && /^[ \t]{2,}/u.test(currentText)) {
        currentText = currentText.replace(/^[ \t]+/u, " ")
      }
    }

    parts[currentPartIndex] = currentText
  }
}

function normalizeImportedTextNode(text) {
  let nextText = text || ""
  nextText = nextText.replace(/[ \t]{2,}/gu, " ")
  nextText = nextText.replace(/[ \t]+([,.;:!?)\]}»"])/gu, "$1")
  nextText = normalizeTypographyPlainText(nextText)
  nextText = nextText.replace(/([А-ЯA-Z])\.\s([А-ЯA-Z][а-яa-zёЁ]+)/gu, "$1.\u00A0$2")
  nextText = nextText.replace(/([А-ЯA-Z])\.\s([А-ЯA-Z])\./gu, "$1.\u00A0$2.")
  return nextText
}

function shouldDropImportedParagraph(inner) {
  if (!inner) return true
  if (/<span class="math-inline"/.test(inner) || /<img\b/i.test(inner)) return false
  const plainText = inner
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/[\s\u00A0]+/gu, "")
  return plainText.length === 0
}

function isFigureCaptionText(text) {
  const plainText = (text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/g, " ")
    .trim()
  return /^(Рис(?:унок)?\.?\s*\d+)\s+[А-ЯA-Zа-яa-zЁё]/u.test(plainText)
}

function fixFigureCaptionDot(text) {
  return (text || "").replace(
    /^(.*?)(Рис(?:унок)?\.?\s*\d+)\s+([А-ЯA-Zа-яa-zЁё])/u,
    (_, prefix, label, firstLetter) => `${prefix}${label}. ${firstLetter}`
  )
}

function normalizeGeneratedLatex(text) {
  return (text || "")
    .replace(/(\\[A-Za-z]+)\s+([,.;:!?])/g, "$1$2")
    .replace(/\s+/gu, " ")
    .trim()
}

function applyDisplayFractionLatex(text) {
  return (text || "").replace(/\\tfrac\b/g, "\\dfrac")
}

function applyDisplayFractionMathML(mathml) {
  return (mathml || "").replace(/<mfrac(?![^>]*displaystyle=)/g, '<mfrac displaystyle="true"')
}

function buildLeftBraceAlignedLatex(content) {
  return `\\left\\{${buildAlignedLatex(content)}\\right.`
}

function buildAlignedLatex(content) {
  return `\\begin{aligned} ${addAlignedEqualityMarkers(content)} \\end{aligned}`
}

function buildLeftAlignedArrayLatex(content) {
  return `\\begin{array}{l} ${normalizeArrayRows(content)} \\end{array}`
}

function normalizeArrayRows(content) {
  return (content || "")
    .split(/\s*\\\\\s*/u)
    .map((line) => normalizeArrayLine(line))
    .filter(Boolean)
    .join(" \\\\ ")
}

function normalizeArrayLine(line) {
  return (line || "")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:])/gu, "$1")
    .trim()
}

function addAlignedEqualityMarkers(content) {
  return (content || "")
    .split(/\s*\\\\\s*/u)
    .map((line) => alignFirstEquality(line))
    .filter(Boolean)
    .join(" \\\\ ")
}

function alignFirstEquality(line) {
  const normalized = (line || "")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:])/gu, "$1")
    .trim()
  if (!normalized) return ""
  if (normalized.includes("&=")) return normalized
  if (/&\\(?:in|notin|subset|supset|leq|geq|neq|approx)\b/.test(normalized)) return normalized
  const index = normalized.indexOf("=")
  if (index !== -1) {
    return `${normalized.slice(0, index)}&=${normalized.slice(index + 1)}`
  }
  const relationMatch = normalized.match(/\\(?:in|notin|subset|supset|leq|geq|neq|approx)\b/)
  if (relationMatch?.index !== undefined) {
    const beforeRelation = normalized.slice(0, relationMatch.index).replace(/\s+$/u, "")
    return `${beforeRelation} &${normalized.slice(relationMatch.index)}`
  }
  return normalized
}

function extractPlainIndexText(node) {
  if (!node) return null
  let text = ""

  function walk(current) {
    for (let i = 0; i < current.childNodes.length; i++) {
      const child = current.childNodes[i]
      if (child.nodeType === 3) {
        text += child.nodeValue || ""
        continue
      }
      if (child.nodeType !== 1) continue
      const childName = child.localName || child.nodeName?.split(":").pop() || ""
      if (["sub", "sup", "e", "r", "t", "rPr"].includes(childName)) {
        walk(child)
        continue
      }
      text = ""
      throw new Error("__non_plain_index__")
    }
  }

  try {
    walk(node)
  } catch (error) {
    if (error?.message === "__non_plain_index__") return null
    throw error
  }

  const normalized = (text || "").replace(/\s+/gu, "")
  return normalized || null
}

function shouldTextStyleIndex(text) {
  if (!text) return false
  if (!/^\p{Letter}+$/u.test(text)) return false
  if (/\p{Script=Cyrillic}/u.test(text)) return true
  return /^[A-Za-z]{2,}$/u.test(text)
}

function formatIndexLatex(node, fallback) {
  const plainText = extractPlainIndexText(node)
  if (plainText && shouldTextStyleIndex(plainText)) {
    return `\\text{${plainText}}`
  }
  return fallback
}

function formatIndexMathML(node, fallbackContent) {
  const plainText = extractPlainIndexText(node)
  if (plainText && shouldTextStyleIndex(plainText)) {
    return `<mtext>${escapeXml(plainText)}</mtext>`
  }
  return wrapMrow(fallbackContent)
}

function isDelimitedMatrixAlreadyWrapped(innerContent, begChar, endChar) {
  if (!innerContent) return false
  const matrixEnvByDelimiter = new Map([
    ["[]", "bmatrix"],
    ["()", "pmatrix"],
    ["{}", "Bmatrix"],
    ["||", "vmatrix"],
    ["‖‖", "Vmatrix"]
  ])
  const env = matrixEnvByDelimiter.get(`${begChar || ""}${endChar || ""}`)
  if (!env) return false
  const pattern = new RegExp(String.raw`^\\begin\{${env}\}[\s\S]*\\end\{${env}\}$`)
  return pattern.test(innerContent.trim())
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
  const rawHtml = docxXmlToHtml(xmlString, images, imageRels, footnotes)
  const html = normalizeImportedHtml(rawHtml)

  const extraction = extractMetadataFromImportedHtml(html, { rootDocument: document })
  const bodyHtml = extraction.cleanedBody

  // Parse HTML into ProseMirror doc
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = bodyHtml

  const domParser = ProseDOMParser.fromSchema(schema)
  const doc = domParser.parse(tempDiv)

  return {
    doc,
    html: bodyHtml,
    formulaCount: (bodyHtml.match(/math-inline|math-block/g) || []).length,
    extraction: { meta: extraction.meta, references: extraction.references }
  }
}
