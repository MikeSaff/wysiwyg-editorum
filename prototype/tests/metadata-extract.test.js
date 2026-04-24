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
<p>А. А. Иванов, Б. Б. Петров</p>
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
  assert.equal(meta.authors.length, 2)
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
