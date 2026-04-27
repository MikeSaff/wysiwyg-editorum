/**
 * v0.55: calibration for formula-quality counters (must fail loudly if metrics drift).
 */
import test from "node:test"
import assert from "node:assert/strict"
import { validateLatex } from "mtef-to-mathml"
import {
  countSemanticAtomsInMathML,
  countSingleCharFormula,
  computeMetadataCompletenessPct,
  scoreFormulaQualityForHtml,
  scoreFigureMetrics,
} from "../scripts/formula-quality-lib.mjs"
import { emptyMeta } from "../src/document-model.js"

test("countSingleCharFormula: single mi ξ counts as 1", () => {
  assert.equal(countSingleCharFormula("<math><mi>ξ</mi></math>"), 1)
  assert.equal(countSemanticAtomsInMathML("<math><mi>ξ</mi></math>"), 1)
})

test("countSingleCharFormula: x=5 has three atoms → 0", () => {
  const m = "<math><mi>x</mi><mo>=</mo><mn>5</mn></math>"
  assert.equal(countSemanticAtomsInMathML(m), 3)
  assert.equal(countSingleCharFormula(m), 0)
})

test("scoreFormulaQualityForHtml: single-char metric is block-only", () => {
  const html = [
    '<p><span class="math-inline" data-mathml="&lt;math&gt;&lt;mi&gt;ξ&lt;/mi&gt;&lt;/math&gt;" data-latex="\\xi"></span></p>',
    '<div class="math-block" data-mathml="&lt;math&gt;&lt;mi&gt;x&lt;/mi&gt;&lt;/math&gt;" data-latex="x"></div>',
  ].join("")
  const score = scoreFormulaQualityForHtml(html, null)
  assert.equal(score.formulas_total, 2)
  assert.equal(score.single_char_formula_count, 1)
})

test("validateLatex: \\partialt invalid with command-no-space", () => {
  const v = validateLatex(String.raw`\partialt`)
  assert.equal(v.valid, false)
  assert.ok(v.errors.includes("command-no-space"))
})

test("validateLatex: \\partial t valid", () => {
  const v = validateLatex(String.raw`\partial t`)
  assert.equal(v.valid, true)
})

test("figure_caption_truncated: short Рис. prefix only", () => {
  const html = `<figure class="figure-block"><figcaption class="figure-caption-ru">Рис. 1.</figcaption></figure>`
  const s = scoreFigureMetrics(html)
  assert.equal(s.figure_caption_truncated_count, 1)
  const html2 = `<figure class="figure-block"><figcaption class="figure-caption-ru">Рис. 1. Зависимость X от Y.</figcaption></figure>`
  const s2 = scoreFigureMetrics(html2)
  assert.equal(s2.figure_caption_truncated_count, 0)
})

test("metadata_completeness_pct: empty EN fields < 100%", () => {
  const meta = emptyMeta()
  meta.title.ru = "Заголовок"
  meta.abstracts.ru = "Абстракт"
  meta.keywords.ru = ["a"]
  meta.dates.received = "2020-01-01"
  meta.dates.accepted = "2020-02-01"
  meta.contributors = [{ is_corresponding: true }]
  const pct = computeMetadataCompletenessPct(meta)
  assert.ok(pct < 100)
  meta.title.en = "Title"
  meta.abstracts.en = "Abstract"
  meta.keywords.en = ["k"]
  const pct2 = computeMetadataCompletenessPct(meta)
  assert.equal(pct2, 100)
})
