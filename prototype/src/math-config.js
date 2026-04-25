/**
 * MathJax v4 CHTML font presets (journal-specific switching later).
 */

export const DEFAULT_MATH_FONT = "stix2"

/** CHTML fonts ship in separate @mathjax/*-font packages; paths under mathjax@4/es5/…/fonts/* are not published on npm CDN. */
const MJX_FONT_CDN = "https://cdn.jsdelivr.net/npm"

export const MATH_FONT_PRESETS = {
  stix2: {
    font: "stix2",
    fontURL: `${MJX_FONT_CDN}/@mathjax/mathjax-stix2-font@4/chtml/woff2`
  },
  newcm: {
    font: "newcm",
    fontURL: `${MJX_FONT_CDN}/@mathjax/mathjax-newcm-font@4/chtml/woff2`
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
