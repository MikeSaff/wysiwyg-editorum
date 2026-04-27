import test from "node:test"
import assert from "node:assert/strict"
import { parseHTML } from "linkedom"
import { schema } from "../src/schema.js"
import { detectSectionType } from "../src/section-heading.js"
import { collectNavigationGroups } from "../src/navigation.js"
import { computeFigureCaptionGapCount } from "../scripts/formula-quality-lib.mjs"
import { normalizeImportedHtml } from "../src/word-import.js"

function makeDoc(content) {
  return schema.node("doc", null, content)
}

test("detectSectionType covers theoretical model and perturbed distribution functions", () => {
  assert.equal(detectSectionType("2. ТЕОРЕТИЧЕСКАЯ МОДЕЛЬ"), "methods")
  assert.equal(
    detectSectionType("3. ВОЗМУЩЕННЫЕ ФУНКЦИИ РАСПРЕДЕЛЕНИЯ ИОНОВ"),
    "results"
  )
  assert.equal(detectSectionType("Нечто совсем постороннее"), "other")
})

test("collectNavigationGroups keeps only structural nodes", () => {
  const doc = makeDoc([
    schema.node("heading", { level: 2, id: "sec-1", sectionType: "introduction" }, [
      schema.text("1. ВВЕДЕНИЕ"),
    ]),
    schema.node("paragraph", null, [
      schema.text("Рисунок 1. демонстрирует классические свойства солитонов."),
    ]),
    schema.node("figure_block", { id: "fig-1" }, [
      schema.node("figure_image", { src: "a.png", alt: "", title: "", placeholder: false }),
      schema.node("figcaption", { lang: null }, [schema.text("Рис. 1. Подпись")]),
    ]),
    schema.node("math_block", { id: "eq-1", latex: "x=1", mathml: "<math/>", label: "(1)" }),
    schema.node("math_block", { id: "eq-2", latex: "y=2", mathml: "<math/>", label: null }),
  ])

  const groups = collectNavigationGroups(doc)
  const sections = groups.find((group) => group.key === "sections")
  const figures = groups.find((group) => group.key === "figures")
  const formulas = groups.find((group) => group.key === "formulas")

  assert.equal(sections.items.length, 1)
  assert.equal(sections.items[0].targetId, "sec-1")
  assert.equal(figures.items.length, 1)
  assert.equal(figures.items[0].label, "Рис. 1")
  assert.equal(formulas.items.length, 1)
  assert.equal(formulas.items[0].label, "(1)")
})

test("collectNavigationGroups excludes references from sections group", () => {
  const doc = makeDoc([
    schema.node("heading", { level: 2, id: "sec-ref", sectionType: "references" }, [
      schema.text("Список литературы"),
    ]),
  ])

  const groups = collectNavigationGroups(doc)
  const sections = groups.find((group) => group.key === "sections")
  assert.equal(sections.items.length, 0)
})

test("computeFigureCaptionGapCount treats sub-numbered captions as one logical figure", () => {
  assert.equal(
    computeFigureCaptionGapCount(["Рис. 1А", "Рис. 1Б", "Рис. 2", "Рис. 3"]),
    0
  )
})

test("computeFigureCaptionGapCount detects primary numbering gaps", () => {
  assert.equal(computeFigureCaptionGapCount(["Рис. 1", "Рис. 2", "Рис. 4"]), 1)
})

test("normalizeImportedHtml strips figure-caption backmatter tail but keeps real figures and loose image", () => {
  const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prev = globalThis.document
  globalThis.document = document
  try {
    const html = [
      '<p>ПОДПИСИ К РИСУНКАМ</p>',
      '<p class="style-figure">Полный текст подписи к рисунку 4.</p>',
      '<p><img src="orphan.png" class="inline-image" alt=""></p>',
      '<figure class="figure-block" id="fig-1"><img src="a.png" class="figure-block-img" alt=""><figcaption class="figure-caption-ru">Рис. 1. Подпись.</figcaption></figure>',
      '<p><strong>Рис. 4.</strong></p>',
    ].join("\n")

    const out = normalizeImportedHtml(html)

    assert.doesNotMatch(out, /ПОДПИСИ К РИСУНКАМ/u)
    assert.doesNotMatch(out, /Рис\. 4\./u)
    assert.match(out, /orphan\.png/u)
    assert.match(out, /figure-block/u)
  } finally {
    if (prev) globalThis.document = prev
    else delete globalThis.document
  }
})
