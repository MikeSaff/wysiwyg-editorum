import { MathMLToLaTeX } from "mathml-to-latex"
import { schema } from "./schema.js"
import { Fragment, Slice } from "prosemirror-model"

/**
 * Convert OMML (Office Math Markup Language) to MathML.
 * Word uses OMML internally; when copying, it sometimes includes MathML
 * in the clipboard HTML, but more often it's OMML wrapped in <m:oMath> tags.
 *
 * Strategy:
 * 1. Look for MathML (<math> elements) in pasted HTML — use directly
 * 2. Look for OMML (<m:oMath>) — convert via simple XSLT-like transform
 * 3. Look for Word equation images with alt text — extract alt as LaTeX
 */

/**
 * Extract MathML from HTML and convert to LaTeX
 */
function extractMathFromHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  // Strategy 1: Find <math> elements (MathML)
  const mathElements = doc.querySelectorAll("math")
  if (mathElements.length > 0) {
    const results = []
    mathElements.forEach(mathEl => {
      try {
        const mathml = mathEl.outerHTML
        const latex = MathMLToLaTeX.convert(mathml)
        results.push({ element: mathEl, latex, display: mathEl.getAttribute("display") === "block" })
      } catch (e) {
        console.warn("MathML conversion failed:", e)
      }
    })
    return results
  }

  return []
}

/**
 * Clean up Word HTML before ProseMirror parses it.
 * Modifies the HTML string to improve paste quality.
 */
export function cleanWordHtml(html) {
  if (!html) return html

  let cleaned = html

  // Remove Word-specific XML namespaces and comments
  cleaned = cleaned.replace(/<!\[if[^]*?\]>/gi, "")
  cleaned = cleaned.replace(/<!\[endif\]>/gi, "")
  cleaned = cleaned.replace(/<!--\[if[^]*?endif\]-->/gi, "")
  cleaned = cleaned.replace(/<o:p><\/o:p>/gi, "")
  cleaned = cleaned.replace(/<o:p>.*?<\/o:p>/gi, "")

  // Remove Word-specific tags but keep content
  cleaned = cleaned.replace(/<\/?o:[^>]*>/gi, "")
  cleaned = cleaned.replace(/<\/?v:[^>]*>/gi, "")
  cleaned = cleaned.replace(/<\/?w:[^>]*>/gi, "")
  cleaned = cleaned.replace(/<\/?m:[^>]*>/gi, "")

  // Remove class="Mso*" Word styles
  cleaned = cleaned.replace(/\s*class="Mso[^"]*"/gi, "")

  // Remove empty spans
  cleaned = cleaned.replace(/<span\s*>\s*<\/span>/gi, "")

  // Remove Word's font-family declarations (we use our own fonts)
  cleaned = cleaned.replace(/font-family:[^;"']*(;|\s*(?=['"]))/gi, "")

  // Remove Word's font-size declarations (we use our own sizes)
  cleaned = cleaned.replace(/font-size:\s*[\d.]+pt\s*(;|\s*(?=['"]))/gi, "")

  // Remove empty style attributes
  cleaned = cleaned.replace(/\s*style="\s*"/gi, "")

  // Convert Word's equation images to LaTeX placeholders
  // Word sometimes exports formulas as images with alt text containing the equation
  cleaned = cleaned.replace(
    /<img[^>]*?alt="([^"]*)"[^>]*?class="[^"]*equation[^"]*"[^>]*?\/?>/gi,
    (match, alt) => {
      if (alt && alt.trim()) {
        return `<span class="math-inline" data-latex="${escapeHtml(alt.trim())}">${escapeHtml(alt.trim())}</span>`
      }
      return match
    }
  )

  // Handle Word's VML equation objects
  // These appear as <v:shape> with equation content
  cleaned = cleaned.replace(
    /<v:shape[^>]*>.*?<\/v:shape>/gi,
    ""
  )

  // Clean up multiple blank paragraphs (Word loves these)
  cleaned = cleaned.replace(/(<p[^>]*>\s*(&nbsp;|\s)*\s*<\/p>\s*){3,}/gi, "<p>&nbsp;</p>")

  // Convert Word's <b style="font-weight:normal"> to just text (not bold)
  cleaned = cleaned.replace(
    /<b\s+style="[^"]*font-weight:\s*normal[^"]*">(.*?)<\/b>/gi,
    "$1"
  )

  // Convert Word's numbered equation tables to formula blocks
  // Word uses tables with 2-3 columns: [space] [formula] [(number)]
  cleaned = convertEquationTables(cleaned)

  return cleaned
}

/**
 * Detect and convert Word equation tables.
 * Word uses invisible tables to align equations:
 * | (empty or space) | formula text | (1) |
 */
function convertEquationTables(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, "text/html")

  const tables = doc.querySelectorAll("table")
  tables.forEach(table => {
    const rows = table.querySelectorAll("tr")
    if (rows.length === 1) {
      const cells = rows[0].querySelectorAll("td")
      // Pattern: 1-3 cells, last cell contains only a number in parentheses like (1) or (2)
      if (cells.length >= 2 && cells.length <= 3) {
        const lastCell = cells[cells.length - 1]
        const lastText = lastCell.textContent.trim()
        const labelMatch = lastText.match(/^\((\d+)\)$/)

        if (labelMatch) {
          // This is likely an equation table
          const formulaCell = cells.length === 3 ? cells[1] : cells[0]
          const formulaText = formulaCell.textContent.trim()

          if (formulaText) {
            const div = doc.createElement("div")
            div.className = "math-block"
            div.setAttribute("data-latex", formulaText)
            div.textContent = formulaText

            const labelSpan = doc.createElement("span")
            labelSpan.className = "math-label"
            labelSpan.textContent = lastText
            div.appendChild(labelSpan)

            table.replaceWith(div)
          }
        }
      }
    }
  })

  return doc.body.innerHTML
}

/**
 * Process MathML in pasted content after ProseMirror parsing.
 * Called from handlePaste to post-process the parsed slice.
 */
export function processMathInPaste(view, html) {
  const mathResults = extractMathFromHtml(html)

  if (mathResults.length > 0) {
    console.log(`Found ${mathResults.length} math expressions in paste`)
    // Math was found and will be handled by parseDOM rules
    // The cleaned HTML should have math converted to our format
  }

  return mathResults.length > 0
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
