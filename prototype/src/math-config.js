/**
 * MathJax v4 CHTML font presets (journal-specific switching later).
 */

export const DEFAULT_MATH_FONT = "stix2"

export const MATH_FONT_PRESETS = {
  stix2: {
    font: "stix2",
    fontURL: "https://cdn.jsdelivr.net/npm/mathjax@4/es5/output/chtml/fonts/stix2"
  },
  newcm: {
    font: "newcm",
    fontURL: "https://cdn.jsdelivr.net/npm/mathjax@4/es5/output/chtml/fonts/newcm"
  }
}

/**
 * Mutates global MathJax startup config (call before loading tex-mml-chtml.js).
 * @param {keyof typeof MATH_FONT_PRESETS} presetName
 */
export function applyMathFontPreset(presetName) {
  const preset = MATH_FONT_PRESETS[presetName] || MATH_FONT_PRESETS[DEFAULT_MATH_FONT]
  const MJ = globalThis.MathJax || {}
  MJ.chtml = MJ.chtml || {}
  MJ.chtml.font = preset.font
  MJ.chtml.fontURL = preset.fontURL
  globalThis.MathJax = MJ
}
