/**
 * Early MathJax v4 configuration (imported from index.html before tex-mml-chtml.js).
 */
import { DEFAULT_MATH_FONT, MATH_FONT_PRESETS } from "./math-config.js"

const preset = MATH_FONT_PRESETS[DEFAULT_MATH_FONT] || MATH_FONT_PRESETS.stix2

globalThis.MathJax = {
  loader: {
    load: ["[tex]/ams", "[tex]/newcommand", "[tex]/color"]
  },
  tex: {
    inlineMath: [["\\(", "\\)"]],
    displayMath: [["\\[", "\\]"]],
    processEscapes: true,
    packages: { "[+]": ["mhchem"] }
  },
  chtml: {
    fontURL: preset.fontURL,
    font: preset.font,
    displayOverflow: "linebreak",
    mtextInheritFont: true,
    merrorInheritFont: true
  },
  options: { enableMenu: false }
}
