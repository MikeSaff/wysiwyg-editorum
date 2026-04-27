import test from "node:test"
import assert from "node:assert/strict"
import { parseHTML } from "linkedom"
import { extractMetadataFromImportedHtml } from "../src/metadata-extract.js"

function docFromHtml(fragmentHtml) {
  const { document } = parseHTML(`<!DOCTYPE html><html><body><div id="x">${fragmentHtml}</div></body></html>`)
  return document
}

test("v0.49: extractMetadata strips front + references + back sections", () => {
  const d = docFromHtml(`
<p><strong>LONG TITLE HERE FOR TESTING PURPOSES ONLY</strong></p>
<p class="style-author">И. И. Иванов*</p>
<p>Институт «Тест», Москва, Россия</p>
<p>E-mail: a@example.com</p>
<p>Ключевые слова: один, два, три</p>
<p>${"word ".repeat(80)}</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body text.</p>
<h2 data-section-type="funding">ФИНАНСИРОВАНИЕ</h2>
<p>Grant <strong>X</strong></p>
<h2 data-section-type="references">СПИСОК ЛИТЕРАТУРЫ</h2>
<p>[1] First ref</p>
<p>[2] Second ref <a href="https://doi.org/10.1000/182">link</a></p>
`)
  const holder = d.getElementById("x")
  const html = holder.innerHTML
  const { meta, references, cleanedBody } = extractMetadataFromImportedHtml(html, { rootDocument: d })

  assert.ok(
    (meta.title.ru && meta.title.ru.includes("LONG TITLE")) ||
      (meta.title.en && meta.title.en.includes("LONG TITLE"))
  )
  assert.equal(meta.authors.length, 1)
  assert.equal(meta.affiliations.length, 1)
  assert.match(meta.authors[0].email, /a@example\.com/)
  assert.ok(meta.keywords.ru.length >= 3)
  assert.ok(meta.abstract.ru.length > 50)
  assert.ok(meta.fundingInfo.includes("Grant"))
  assert.equal(references.length, 2)
  assert.equal(references[1].doi, "10.1000/182")

  assert.match(cleanedBody, /ВВЕДЕНИЕ/i)
  assert.match(cleanedBody, /Body text/)
  assert.doesNotMatch(cleanedBody, /СПИСОК ЛИТЕРАТУРЫ/)
  assert.doesNotMatch(cleanedBody, /LONG TITLE HERE/)
})

test("v0.53: Pleiades abstract paragraph splits dates and keywords (DocumentJSON §5)", () => {
  const d = docFromHtml(`
<p class="style-title-article">Title</p>
<p class="style-author">И. И. Иванов*</p>
<p class="style-affiliation">Институт</p>
<p class="style-abstract">Краткая аннотация. Поступила в редакцию 15.01.2024. Ключевые слова: один, два</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body.</p>
<h2 data-section-type="references">ЛИТЕРАТУРА</h2>
<p>[1] Ref</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.match(meta.abstracts.ru, /Краткая аннотация/)
  assert.doesNotMatch(meta.abstracts.ru || "", /Поступила/i)
  assert.equal(meta.dates.received, "2024-01-15")
  assert.deepEqual(meta.keywords.ru, ["один", "два"])
})

test("v0.53: two authors and unmarked e-mail paragraph — email not assigned", () => {
  const d = docFromHtml(`
<p class="style-author">И. И. Иванов, П. П. Петров</p>
<p class="style-email">E-mail: a@example.com</p>
<p class="style-affiliation">Институт</p>
<p class="style-abstract">Аннотация.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>x</p>
<h2 data-section-type="references">ЛИТЕРАТУРА</h2>
<p>[1] r</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.authors.length, 2)
  assert.equal(meta.authors[0].email || "", "")
  assert.equal(meta.authors[1].email || "", "")
})

test("v0.53: corresponding author receives e-mail from style-email", () => {
  const d = docFromHtml(`
<p class="style-author">И. И. Иванов*</p>
<p class="style-email">E-mail: z@example.com</p>
<p class="style-affiliation">Институт</p>
<p class="style-abstract">Аннотация.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>x</p>
<h2 data-section-type="references">ЛИТЕРАТУРА</h2>
<p>[1] r</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.authors[0].email, "z@example.com")
  assert.equal(meta.contributors[0].email, "z@example.com")
  assert.equal(meta.contributors[0].is_corresponding, true)
})

test("v0.54: single author with *e-mail is corresponding without star on name", () => {
  const d = docFromHtml(`
<p class="style-title-article">Title</p>
<p class="style-author">И. И. Иванов</p>
<p class="style-email">*E-mail: sole@example.com</p>
<p class="style-affiliation">Институт</p>
<p class="style-abstract">Аннотация.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>x</p>
<h2 data-section-type="references">ЛИТЕРАТУРА</h2>
<p>[1] r</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.authors.length, 1)
  assert.equal(meta.authors[0].email, "sole@example.com")
  assert.equal(meta.authors[0].isCorresponding, true)
  assert.equal(meta.contributors[0].is_corresponding, true)
})

test("v0.54: second English metadata block fills title.en, abstracts.en, keywords.en", () => {
  const d = docFromHtml(`
<p class="style-title-article">Заголовок на русском</p>
<p class="style-author">И. И. Иванов</p>
<p class="style-affiliation">Институт</p>
<p class="style-abstract">Русская аннотация короткая.</p>
<p class="style-keywords">Ключевые слова: один</p>
<p class="style-title-article">English Title For Journal</p>
<p class="style-author">I. I. Ivanov</p>
<p class="style-abstract">English abstract narrative here.</p>
<p class="style-keywords">Keywords: alpha, beta</p>
<h2 data-section-type="introduction">INTRODUCTION</h2>
<p>Body.</p>
<h2 data-section-type="references">REFERENCES</h2>
<p>[1] ref</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.match(meta.title.ru || "", /Заголовок/u)
  assert.match(meta.title.en || "", /English Title/u)
  assert.match(meta.abstracts.en || "", /English abstract/u)
  assert.deepEqual(meta.keywords.en, ["alpha", "beta"])
  assert.ok(meta.authorsEn.length >= 1)
  assert.ok(meta.contributorsEn.length >= 1)
})

test("v0.57: RU-only metadata block leaves English fields empty", () => {
  const d = docFromHtml(`
<p class="style-title-article">Заголовок на русском</p>
<p class="style-author">И. И. Иванов</p>
<p class="style-affiliation">Институт</p>
<p class="style-abstract">Русская аннотация.</p>
<p class="style-keywords">Ключевые слова: один, два</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body.</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.title.ru, "Заголовок на русском")
  assert.equal(meta.title.en, "")
  assert.equal(meta.abstracts.en, "")
  assert.deepEqual(meta.keywords.en, [])
})

test("v0.57: EN-only metadata block fills English fields only", () => {
  const d = docFromHtml(`
<p class="style-title-article">English Title Only</p>
<p class="style-author">I. I. Ivanov</p>
<p class="style-affiliation">Institute</p>
<p class="style-abstract">English abstract narrative.</p>
<p class="style-keywords">Keywords: alpha, beta</p>
<h2 data-section-type="introduction">INTRODUCTION</h2>
<p>Body.</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.title.ru, "")
  assert.equal(meta.title.en, "English Title Only")
})

test("v0.58: style-udk extracts Russian UDK value", () => {
  const d = docFromHtml(`
<p class="style-udk">УДК 533.9</p>
<p class="style-title-article">Заголовок</p>
<p class="style-abstract">Аннотация.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body.</p>
`)
  const holder = d.getElementById("x")
  const { meta, cleanedBody } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.udk, "533.9")
  assert.doesNotMatch(cleanedBody, /УДК 533\.9/u)
})

test("v0.58: style-udk extracts English UDC value", () => {
  const d = docFromHtml(`
<p class="style-udk">UDC 533.9</p>
<p class="style-title-article">English Title</p>
<p class="style-abstract">Abstract.</p>
<h2 data-section-type="introduction">INTRODUCTION</h2>
<p>Body.</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.udk, "533.9")
})

test("v0.58: malformed style-udk leaves meta.udk empty", () => {
  const d = docFromHtml(`
<p class="style-udk">533.9</p>
<p class="style-title-article">Заголовок</p>
<p class="style-abstract">Аннотация.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body.</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.udk, "")
})

test("v0.57: reference extraction stops before figure-caption backmatter", () => {
  const refs = Array.from({ length: 26 }, (_, i) => `<p class="style-reference">[${i + 1}] Reference ${i + 1}</p>`).join("\n")
  const d = docFromHtml(`
<p class="style-title-article">Заголовок</p>
<p class="style-abstract">Аннотация.</p>
<p class="style-title-article">English Title</p>
<p class="style-abstract">English abstract narrative.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body.</p>
<h2 data-section-type="references">СПИСОК ЛИТЕРАТУРЫ</h2>
${refs}
<p>ПОДПИСИ К РИСУНКАМ</p>
<p>Рис. 1. Полная подпись.</p>
<p>Рис. 2. Полная подпись.</p>
<p>Рис. 3. Полная подпись.</p>
<p>Рис. 4. Полная подпись.</p>
`)
  const holder = d.getElementById("x")
  const { meta, references } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(references.length, 26)
  assert.equal(meta.title.ru, "Заголовок")
  assert.equal(meta.title.en, "English Title")
})

test("v0.56: styled TitleArticle overrides issue header fallback", () => {
  const d = docFromHtml(`
<p>Физика плазмы_1_2025</p>
<p class="style-title-article">Ионные функции распределения</p>
<p class="style-author">Ф.М. Трухачев*</p>
<p class="style-affiliation">Институт</p>
<p class="style-email">*e-mail: ftru@example.com</p>
<p class="style-abstract">Аннотация.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body.</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.title.ru, "Ионные функции распределения")
  assert.notEqual(meta.title.ru, "Физика плазмы_1_2025")
})

test("v0.56: multi-author starred author receives e-mail and contributors stay complete", () => {
  const d = docFromHtml(`
<p class="style-title-article">Заголовок</p>
<p class="style-author">Ф.М.&#160;Трухачев*, М.М.&#160;Васильев, О.Ф.&#160;Петров</p>
<p class="style-affiliation">Объединенный институт</p>
<p class="style-affiliation">*e-mail: ftru@mail.ru</p>
<p class="style-abstract">Аннотация.</p>
<h2 data-section-type="introduction">ВВЕДЕНИЕ</h2>
<p>Body.</p>
`)
  const holder = d.getElementById("x")
  const { meta } = extractMetadataFromImportedHtml(holder.innerHTML, { rootDocument: d })
  assert.equal(meta.authors.length, 3)
  assert.equal(meta.contributors.length, 3)
  assert.equal(meta.contributors[0].email, "ftru@mail.ru")
  assert.equal(meta.contributors[0].is_corresponding, true)
  assert.deepEqual(meta.contributors.map((c) => c.affiliation_ids), [["aff_1"], ["aff_1"], ["aff_1"]])
})
