/**
 * Shared metrics for corpus-baseline.mjs and corpus-diff.mjs
 */

/** @param {string} xml */
/** @param {string} html */
export function computeFileMetrics(xml, html) {
  const figure_blocks = (html.match(/class="figure-block"/g) || []).length
  const figure_placeholders = (html.match(/figure-placeholder/g) || []).length
  const figure_caption_ru = (html.match(/figure-caption-ru/g) || []).length
  const figure_caption_en = (html.match(/figure-caption-en/g) || []).length
  const table_blocks = (html.match(/<table\b/g) || []).length
  const table_wraps = (html.match(/class="table-wrap"/g) || []).length
  const table_caption_ru = (html.match(/class="table-caption table-caption-ru"/g) || []).length
  const table_caption_en = (html.match(/class="table-caption table-caption-en"/g) || []).length
  const math_blocks = (html.match(/class="math-block"/g) || []).length
  const math_inline = (html.match(/class="math-inline"/g) || []).length
  const omml_in_source = (xml.match(/<m:oMath\b/gi) || []).length
  const ole_in_source = (xml.match(/<w:object\b/gi) || []).length
  const denom = omml_in_source + ole_in_source
  const math_extraction_rate = denom > 0 ? (math_blocks + math_inline) / denom : 0
  const headings_h1 = (html.match(/<h1\b/g) || []).length
  const headings_h2 = (html.match(/<h2\b/g) || []).length
  const headings_h3 = (html.match(/<h3\b/g) || []).length
  const lonely_number_paragraphs = (html.match(/<p[^>]*>\s*\(\d{1,3}\)\s*<\/p>/gi) || []).length

  return {
    figure_blocks,
    figure_placeholders,
    figure_caption_ru,
    figure_caption_en,
    table_blocks,
    table_wraps,
    table_caption_ru,
    table_caption_en,
    math_blocks,
    math_inline,
    omml_in_source,
    ole_in_source,
    math_extraction_rate,
    headings_h1,
    headings_h2,
    headings_h3,
    lonely_number_paragraphs
  }
}

/** Metric key → true if larger is better */
export const HIGHER_IS_BETTER = {
  figure_blocks: true,
  figure_placeholders: false,
  figure_caption_ru: true,
  figure_caption_en: true,
  table_blocks: true,
  table_wraps: true,
  table_caption_ru: true,
  table_caption_en: true,
  math_blocks: true,
  math_inline: true,
  omml_in_source: true,
  ole_in_source: true,
  math_extraction_rate: true,
  headings_h1: true,
  headings_h2: true,
  headings_h3: true,
  lonely_number_paragraphs: false
}
