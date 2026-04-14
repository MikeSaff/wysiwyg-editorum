/**
 * Статический рендер формул через MathLive (без side-effect импортов — можно импортировать из schema в Node-тестах).
 */
import { convertLatexToMarkup } from "mathlive"
import { MathMLToLaTeX } from "mathml-to-latex"

/**
 * @param {HTMLElement} host узел `.math-render-host`; `data-mathml` / `data-latex` на `.math-inline` | `.math-block`
 */
export function renderMathLive(host) {
  if (typeof window === "undefined" || !host?.closest) return

  const container = host.closest(".math-inline") || host.closest(".math-block")
  if (!container) return

  const mathml = container.getAttribute("data-mathml") || ""
  const latex = container.getAttribute("data-latex") || ""
  const displayMode = container.classList.contains("math-block")

  let tex = (latex || "").trim()
  if (mathml.trim()) {
    try {
      const converted = MathMLToLaTeX.convert(mathml)
      if (converted && converted.trim()) tex = converted.trim()
    } catch (e) {
      console.warn("[MathLive] MathML→LaTeX", e)
    }
  }

  if (!tex) {
    host.innerHTML = ""
    return
  }

  host.innerHTML = convertLatexToMarkup(tex, {
    defaultMode: displayMode ? "math" : "inline-math",
  })
}
