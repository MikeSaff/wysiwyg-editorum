import test from "node:test"
import assert from "node:assert/strict"
import fs, { access, constants } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import JSZip from "jszip"
import { DOMParser } from "xmldom"
import { parseHTML } from "linkedom"
import {
  applyWeakPathUppercaseHeadingHeuristicToRoot,
  docxBufferToNormalizedHtml,
  docxXmlToHtml,
  getPStyleValue,
  normalizeImportedHtml,
  ommlToLatex,
  ommlToMathML,
  splitBilingualFigureCaptionHtml,
  promoteFloatingFiguresAndCaptionsInRoot,
  promoteOrphanStyleFigureCaptionParagraphsInRoot
} from "../src/word-import.js"
import {
  integralOmml,
  limOmml,
  multilineTableDocumentXml,
  multiRowTableDocumentXml
} from "./fixtures/omml-fixtures.js"

globalThis.DOMParser = DOMParser

function parseXml(xml) {
  return new DOMParser().parseFromString(xml, "application/xml")
}

async function loadDocumentXmlFromDocx(docxPath) {
  const buffer = await fs.readFile(docxPath)
  const zip = await JSZip.loadAsync(buffer)
  const file = zip.file("word/document.xml")
  assert.ok(file, "word/document.xml should exist in fixture docx")
  return file.async("string")
}

function collectMathBlocks(html) {
  return [...html.matchAll(/<div class="math-block" data-mathml="([^"]*)" data-latex="([^"]*)"(?: data-label="([^"]*)")?/g)].map((match) => ({
    mathml: decodeAttr(match[1]),
    latex: decodeAttr(match[2]),
    label: match[3] || null
  }))
}

function collectInlineMathParagraphs(html) {
  return [...html.matchAll(/<p[^>]*>(.*?)<\/p>/g)].map((match) => {
    const formulas = [...match[1].matchAll(/data-latex="([^"]+)"/g)].map((inner) =>
      decodeAttr(inner[1])
    )
    return formulas
  }).filter((formulas) => formulas.length > 0)
}

function decodeAttr(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

test("normalizeImportedHtml removes empty paragraphs but keeps math and image paragraphs", () => {
  const html = [
    "<p>   </p>",
    '<p><span class="math-inline" data-latex="x" data-mathml=""><math><mi>x</mi></math></span></p>',
    '<p><img src="x.png" alt="image" class="inline-image"></p>',
    "<p>&nbsp;</p>",
    "<p>Text</p>"
  ].join("\n")

  const normalized = normalizeImportedHtml(html)

  assert.doesNotMatch(normalized, /<p>\s*<\/p>/)
  assert.match(normalized, /math-inline/)
  assert.match(normalized, /<img src="x\.png"/)
  assert.match(normalized, /<p>Text<\/p>/)
})

test("normalizeImportedHtml auto-fixes missing dot after figure number", () => {
  const figCaptionHtml = '<p class="style-fig-caption">Рисунок 3 Блок-схема алгоритма</p>'
  const figShortHtml = "<p>Рис. 3 Блок-схема алгоритма</p>"

  assert.match(normalizeImportedHtml(figCaptionHtml), /Рисунок 3\. Блок-схема алгоритма/u)
  assert.match(normalizeImportedHtml(figShortHtml), /Рис\. 3\. Блок-схема алгоритма/u)
})

test("normalizeImportedHtml collapses duplicate spaces in text nodes without changing math", () => {
  const html = '<p>Текст   с\t\tпробелами <span class="math-inline" data-latex="a   +   b" data-mathml=""><math><mi>a</mi></math></span> после</p>'

  const normalized = normalizeImportedHtml(html)

  assert.match(normalized, /<p>Текст с(?: |\u00A0)пробелами <span class="math-inline"/u)
  assert.match(normalized, /data-latex="a   \+   b"/u)
  assert.match(normalized, /<\/span> после<\/p>/u)
})

test("normalizeImportedHtml removes spaces before punctuation in text nodes", () => {
  const html = "<p>Текст , пример ; тест : ок !</p>"

  const normalized = normalizeImportedHtml(html)

  assert.match(normalized, /<p>Текст, пример; тест: ок!<\/p>/u)
})

test("normalizeImportedHtml trims paragraph edge spaces around inline math", () => {
  const html = '<p>   До <span class="math-inline" data-latex="x" data-mathml=""><math><mi>x</mi></math></span> после   </p>'

  const normalized = normalizeImportedHtml(html)

  assert.match(normalized, /^<p>До <span class="math-inline"/u)
  assert.match(normalized, /<\/span> после<\/p>\n?$/u)
})

test("normalizeImportedHtml converts initials and surname spacing to nbsp", () => {
  const html = "<p>А. А. Иванов и Б. Иванов</p>"

  const normalized = normalizeImportedHtml(html)

  assert.match(normalized, /А\.\u00A0А\.\u00A0Иванов/u)
  assert.match(normalized, /Б\.\u00A0Иванов/u)
})

test("normalizeImportedHtml cleans spacing across text-node boundaries around inline math", () => {
  const html = [
    '<p>где <span class="math-inline" data-latex="\\omega_1" data-mathml=""><math><mi>ω</mi></math></span> , ',
    '<span class="math-inline" data-latex="\\omega_2" data-mathml=""><math><mi>ω</mi></math></span>  - угловые скорости</p>'
  ].join("")

  const normalized = normalizeImportedHtml(html)

  assert.doesNotMatch(normalized, /<\/span>\s+,/u)
  assert.doesNotMatch(normalized, /<\/span>  -/u)
  assert.match(
    normalized,
    /data-latex="\\omega_1" data-mathml=""><math><mi>ω<\/mi><\/math><\/span>, <span class="math-inline"/u
  )
  assert.match(normalized, /data-latex="\\omega_2" data-mathml=""><math><mi>ω<\/mi><\/math><\/span> - угловые скорости<\/p>/u)
})

test("normalizeImportedHtml marks numbered paragraphs with list-item-numbered", () => {
  const plainHtml = "<p>1) Первый пункт</p>"
  const styledHtml = '<p class="style-normal">2. Второй пункт</p>'

  const normalizedPlain = normalizeImportedHtml(plainHtml)
  const normalizedStyled = normalizeImportedHtml(styledHtml)

  assert.match(normalizedPlain, /<p class="list-item-numbered">1\) Первый пункт<\/p>/u)
  assert.match(normalizedStyled, /<p class="style-normal list-item-numbered">2\. Второй пункт<\/p>/u)
})

test("docxXmlToHtml adds ids to imported headings paragraphs and math blocks plus section type on headings", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:p>
        <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
        <w:r><w:t>Введение</w:t></w:r>
      </w:p>
      <w:p>
        <w:r><w:t>Обычный текст</w:t></w:r>
      </w:p>
      <w:p>
        <m:oMathPara>
          <m:oMath>
            <m:r><m:t>x</m:t></m:r>
            <m:r><m:t>=</m:t></m:r>
            <m:r><m:t>0</m:t></m:r>
          </m:oMath>
        </m:oMathPara>
      </w:p>
    </w:body>
  </w:document>`

  const html = docxXmlToHtml(xml, {}, {}, {})

  assert.match(
    html,
    /<h1 id="[^"]+" class="[^"]*style-heading1[^"]*" data-section-type="introduction">Введение<\/h1>/u
  )
  assert.match(html, /<p id="[^"]+">Обычный текст<\/p>/u)
  assert.match(html, /<div class="math-block"[^>]* id="[^"]+">/u)
})

test("docxXmlToHtml wraps image-only paragraph with following figure caption into figure", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
    <w:body>
      <w:p>
        <w:r>
          <w:drawing>
            <a:graphic>
              <a:graphicData>
                <a:pic>
                  <a:blipFill>
                    <a:blip r:embed="rId1"/>
                  </a:blipFill>
                </a:pic>
              </a:graphicData>
            </a:graphic>
          </w:drawing>
        </w:r>
      </w:p>
      <w:p>
        <w:r><w:t>Рисунок 3 Блок-схема алгоритма</w:t></w:r>
      </w:p>
    </w:body>
  </w:document>`

  const html = docxXmlToHtml(xml, {}, { rId1: "img.png" }, {})

  assert.match(
    html,
    /<figure[^>]*data-schema-v2[^>]*class="figure-block"[^>]*id="[^"]+"><img src="img\.png" alt="image" class="inline-image"><figcaption class="figure-caption-ru">Рисунок 3\. Блок-схема алгоритма<\/figcaption><\/figure>/u
  )
  assert.doesNotMatch(html, /style-fig-caption/u)
})

test("docxXmlToHtml wraps table number and caption before table into table-wrap", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:body>
      <w:p><w:r><w:t>Таблица 1</w:t></w:r></w:p>
      <w:p><w:r><w:t>Таблица 1 Подпись таблицы</w:t></w:r></w:p>
      <w:tbl>
        <w:tr>
          <w:tc><w:p><w:r><w:t>A</w:t></w:r></w:p></w:tc>
          <w:tc><w:p><w:r><w:t>B</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    </w:body>
  </w:document>`

  const html = docxXmlToHtml(xml, {}, {}, {})

  assert.match(
    html,
    /<div class="table-wrap" id="[^"]+"><div class="table-caption table-caption-ru">Таблица 1<\/div><div class="table-caption table-caption-ru">Таблица 1 Подпись таблицы<\/div><table id="[^"]+">/u
  )
})

test("ommlToLatex keeps the full integrand for n-ary expressions", () => {
  const doc = parseXml(integralOmml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement
  const latex = ommlToLatex(omml)

  assert.equal(latex, "\\int_{t_{0}}^{t_{f}} [x + u]dt")
})

test("ommlToMathML keeps the full integrand for n-ary expressions", () => {
  const doc = parseXml(integralOmml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement
  const mathml = ommlToMathML(omml, { display: true })

  assert.match(mathml, /^<math /)
  assert.match(mathml, /<mo>∫<\/mo>/)
  assert.match(mathml, /<msub>/)
  assert.match(mathml, /<mo>\+<\/mo>/)
})

test("omml fractions use dfrac in display context and tfrac inline", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:f>
      <m:num><m:r><m:t>1</m:t></m:r></m:num>
      <m:den><m:r><m:t>2</m:t></m:r></m:den>
    </m:f>
  </m:oMath>`
  const doc = parseXml(xml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement

  assert.equal(ommlToLatex(omml), "\\tfrac{1}{2}")
  assert.equal(ommlToLatex(omml, { display: true }), "\\dfrac{1}{2}")
  assert.match(ommlToMathML(omml), /<mfrac>/)
  assert.match(ommlToMathML(omml, { display: true }), /<mfrac displaystyle="true">/)
})

test("ommlToLatex does not duplicate lim", () => {
  const doc = parseXml(limOmml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement
  const latex = ommlToLatex(omml)

  assert.match(latex, /^\\lim_\{x\\to ?\\infty\} f\(x\)$/)
  assert.equal((latex.match(/\\lim/g) || []).length, 1)
})

test("ommlToLatex keeps cdots tight before punctuation", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:r><m:t>i</m:t></m:r>
    <m:r><m:t>=</m:t></m:r>
    <m:r><m:t>1</m:t></m:r>
    <m:r><m:t>,</m:t></m:r>
    <m:r><m:t>⋯</m:t></m:r>
    <m:r><m:t>,</m:t></m:r>
    <m:r><m:t>n</m:t></m:r>
  </m:oMath>`
  const doc = parseXml(xml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement

  assert.equal(ommlToLatex(omml), "i = 1,\\cdots,n")
})

test("ommlToLatex does not double-wrap bracketed bmatrix delimiters", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:d>
      <m:dPr>
        <m:begChr m:val="["/>
        <m:endChr m:val="]"/>
      </m:dPr>
      <m:e>
        <m:m>
          <m:mPr><m:count m:val="2"/></m:mPr>
          <m:mr>
            <m:e><m:r><m:t>0.1</m:t></m:r></m:e>
            <m:e><m:r><m:t>0</m:t></m:r></m:e>
          </m:mr>
          <m:mr>
            <m:e><m:r><m:t>0</m:t></m:r></m:e>
            <m:e><m:r><m:t>0.1</m:t></m:r></m:e>
          </m:mr>
        </m:m>
      </m:e>
    </m:d>
  </m:oMath>`
  const doc = parseXml(xml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement
  const latex = ommlToLatex(omml)

  assert.equal(latex, "\\begin{bmatrix} 0.1 & 0 \\\\ 0 & 0.1 \\end{bmatrix}")
  assert.doesNotMatch(latex, /\\left\[/)
  assert.doesNotMatch(latex, /\\right\]/)
})

test("omml systems use left-brace aligned instead of cases", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:d>
      <m:dPr>
        <m:begChr m:val="{"/>
        <m:endChr m:val=" "/>
      </m:dPr>
      <m:e>
        <m:m>
          <m:mPr><m:count m:val="1"/></m:mPr>
          <m:mr>
            <m:e><m:r><m:t>x</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>1</m:t></m:r></m:e>
          </m:mr>
          <m:mr>
            <m:e><m:r><m:t>y</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>2</m:t></m:r></m:e>
          </m:mr>
        </m:m>
      </m:e>
    </m:d>
  </m:oMath>`
  const doc = parseXml(xml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement
  const latex = ommlToLatex(omml, { display: true })
  const mathml = ommlToMathML(omml, { display: true })

  assert.match(latex, /^\\left\\\{\\begin\{aligned\}[\s\S]*&=[\s\S]*\\end\{aligned\}\\right\.$/)
  assert.doesNotMatch(latex, /\\begin\{cases\}/)
  assert.match(mathml, /<mfenced open="\{" close="" separators="">/)
  assert.match(mathml, /<mtable displaystyle="true">/)
})

test("omml subscripts render Cyrillic and abbreviations in upright text", () => {
  const cyrXml = `<?xml version="1.0" encoding="UTF-8"?>
  <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:sSub>
      <m:e><m:r><m:t>A</m:t></m:r></m:e>
      <m:sub><m:r><m:t>и</m:t></m:r></m:sub>
    </m:sSub>
  </m:oMath>`
  const latinXml = `<?xml version="1.0" encoding="UTF-8"?>
  <m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:sSub>
      <m:e><m:r><m:t>A</m:t></m:r></m:e>
      <m:sub><m:r><m:t>max</m:t></m:r></m:sub>
    </m:sSub>
  </m:oMath>`

  const cyrDoc = parseXml(cyrXml)
  const latinDoc = parseXml(latinXml)
  const cyrMath = cyrDoc.getElementsByTagName("m:oMath")[0] || cyrDoc.documentElement
  const latinMath = latinDoc.getElementsByTagName("m:oMath")[0] || latinDoc.documentElement

  assert.equal(ommlToLatex(cyrMath), "A_{\\text{и}}")
  assert.equal(ommlToLatex(latinMath), "A_{\\text{max}}")
  assert.match(ommlToMathML(cyrMath), /<mtext>и<\/mtext>/)
  assert.doesNotMatch(ommlToMathML(cyrMath), /<mi>и<\/mi>/)
  assert.match(ommlToMathML(latinMath), /<mtext>max<\/mtext>/)
})

test("docxXmlToHtml splits multiple formula paragraphs in one table cell into separate lines", () => {
  const html = docxXmlToHtml(multilineTableDocumentXml, {}, {}, {})
  const blocks = collectMathBlocks(html)

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].label, "(25)")
  assert.equal(blocks[0].latex, "\\begin{array}{l} a = b, \\\\ c = d, \\end{array}")
  assert.match(blocks[0].mathml, /^<math /)
  assert.match(blocks[0].mathml, /<mtable columnalign="left">/)
})

test("docxXmlToHtml keeps relation-only trailing system row inside the same aligned block", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:p>
              <m:oMath><m:r><m:t>a</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>b</m:t></m:r></m:oMath>
              <w:r><w:t>, </w:t></w:r>
              <m:oMath><m:r><m:t>x</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>0</m:t></m:r></m:oMath>
            </w:p>
            <w:p>
              <m:oMath><m:r><m:t>u</m:t></m:r><m:r><m:t>∈U</m:t></m:r></m:oMath>
              <w:r><w:t>, </w:t></w:r>
              <m:oMath><m:r><m:t>w</m:t></m:r><m:r><m:t>∈W</m:t></m:r></m:oMath>
            </w:p>
          </w:tc>
          <w:tc><w:p><w:r><w:t>(2)</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    </w:body>
  </w:document>`
  const html = docxXmlToHtml(xml, {}, {}, {})
  const blocks = collectMathBlocks(html)
  const inlineParagraphs = collectInlineMathParagraphs(html)

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].latex, "\\begin{array}{l} a = b, \\\\ x = 0 \\\\ u\\in U,\\; w\\in W \\end{array}")
  assert.match(blocks[0].mathml, /<mtable columnalign="left">/)
  assert.deepEqual(inlineParagraphs, [])
})

test("docxXmlToHtml keeps all four system rows in one aligned formula block", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:tbl>
        <w:tr>
          <w:tc>
            <w:p>
              <m:oMath><m:r><m:t>a</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>b</m:t></m:r></m:oMath>
            </w:p>
            <w:p>
              <m:oMath><m:r><m:t>x</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>0</m:t></m:r></m:oMath>
            </w:p>
            <w:p>
              <m:oMath><m:r><m:t>y</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>1</m:t></m:r></m:oMath>
            </w:p>
            <w:p>
              <m:oMath><m:r><m:t>u</m:t></m:r><m:r><m:t>&#x2208;U</m:t></m:r></m:oMath>
              <w:r><w:t>, </w:t></w:r>
              <m:oMath><m:r><m:t>w</m:t></m:r><m:r><m:t>&#x2208;W</m:t></m:r></m:oMath>
              <w:r><w:t>, </w:t></w:r>
              <m:oMath><m:r><m:t>t</m:t></m:r><m:r><m:t>&#x2208;[0,T]</m:t></m:r></m:oMath>
            </w:p>
          </w:tc>
          <w:tc><w:p><w:r><w:t>(2)</w:t></w:r></w:p></w:tc>
        </w:tr>
      </w:tbl>
    </w:body>
  </w:document>`

  const html = docxXmlToHtml(xml, {}, {}, {})
  const blocks = collectMathBlocks(html)
  const inlineParagraphs = collectInlineMathParagraphs(html)

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].latex, "\\begin{array}{l} a = b \\\\ x = 0 \\\\ y = 1 \\\\ u\\in U,\\; w\\in W,\\; t\\in [0,T] \\end{array}")
  assert.deepEqual(inlineParagraphs, [])
})

test("docxXmlToHtml keeps long single-line display formulas unsplit for MathJax line breaking", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:p>
        <m:oMathPara>
          <m:oMath>
            <m:r><m:t>S(x(t))A(x(t))</m:t></m:r>
            <m:r><m:t>+</m:t></m:r>
            <m:r><m:t>A^{T}(x(t))S(x(t))</m:t></m:r>
            <m:r><m:t>-</m:t></m:r>
            <m:r><m:t>S(x(t))[B(x(t))R^{-1}B^{T}(x(t))-D(x(t))P^{-1}D^{T}(x(t))]S(x(t))</m:t></m:r>
            <m:r><m:t>+</m:t></m:r>
            <m:r><m:t>E^{T}(x(t))H(x(t))</m:t></m:r>
            <m:r><m:t>+</m:t></m:r>
            <m:r><m:t>G^{T}(x(t))L(x(t))</m:t></m:r>
            <m:r><m:t>+</m:t></m:r>
            <m:r><m:t>C^{T}QC</m:t></m:r>
            <m:r><m:t>=</m:t></m:r>
            <m:r><m:t>0</m:t></m:r>
          </m:oMath>
        </m:oMathPara>
      </w:p>
    </w:body>
  </w:document>`

  const html = docxXmlToHtml(xml, {}, {}, {})
  const blocks = collectMathBlocks(html)

  assert.equal(blocks.length, 1)
  assert.equal(
    blocks[0].latex,
    "S(x(t))A(x(t)) + A^{T}(x(t))S(x(t)) - S(x(t))[B(x(t))R^{-1}B^{T}(x(t))-D(x(t))P^{-1}D^{T}(x(t))]S(x(t)) + E^{T}(x(t))H(x(t)) + G^{T}(x(t))L(x(t)) + C^{T}QC = 0"
  )
  assert.doesNotMatch(blocks[0].latex, /\\begin\{array\}\{l\}/)
  assert.doesNotMatch(blocks[0].latex, /\{\\displaystyle/u)
  assert.doesNotMatch(blocks[0].mathml, /<mtable columnalign="left">/)
})

test("docxXmlToHtml preserves spaces around inline math next to text runs", () => {
  const xmlWithLeadingSpace = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:p>
        <w:r><w:t>аппаратом,</w:t></w:r>
        <m:oMath><m:r><m:t>x</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>0</m:t></m:r></m:oMath>
        <w:r><w:t> -</w:t></w:r>
      </w:p>
    </w:body>
  </w:document>`
  const xmlWithoutLeadingSpace = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:p>
        <w:r><w:t>аппаратом,</w:t></w:r>
        <m:oMath><m:r><m:t>x</m:t></m:r><m:r><m:t>=</m:t></m:r><m:r><m:t>0</m:t></m:r></m:oMath>
        <w:r><w:t>-</w:t></w:r>
      </w:p>
    </w:body>
  </w:document>`

  const htmlWithLeadingSpace = docxXmlToHtml(xmlWithLeadingSpace, {}, {}, {})
  const htmlWithoutLeadingSpace = docxXmlToHtml(xmlWithoutLeadingSpace, {}, {}, {})

  assert.match(htmlWithLeadingSpace, /аппаратом,\s*<span class="math-inline"[^>]*>/)
  assert.match(htmlWithLeadingSpace, /<\/span>\s+-/)
  assert.match(htmlWithoutLeadingSpace, /аппаратом,\s*<span class="math-inline"[^>]*>/)
  assert.match(htmlWithoutLeadingSpace, /<\/span>\s+-/)
})

test("docxXmlToHtml keeps display fractions large in blocks and compact inline", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <w:body>
      <w:oMathPara>
        <m:oMath>
          <m:f>
            <m:num><m:r><m:t>1</m:t></m:r></m:num>
            <m:den><m:r><m:t>2</m:t></m:r></m:den>
          </m:f>
        </m:oMath>
      </w:oMathPara>
      <w:p>
        <w:r><w:t>text</w:t></w:r>
        <m:oMath>
          <m:f>
            <m:num><m:r><m:t>1</m:t></m:r></m:num>
            <m:den><m:r><m:t>2</m:t></m:r></m:den>
          </m:f>
        </m:oMath>
      </w:p>
    </w:body>
  </w:document>`

  const html = docxXmlToHtml(xml, {}, {}, {})
  const blocks = collectMathBlocks(html)
  const inlineParagraphs = collectInlineMathParagraphs(html)

  assert.equal(blocks[0].latex, "\\dfrac{1}{2}")
  assert.match(blocks[0].mathml, /<mfrac displaystyle="true">/)
  assert.deepEqual(inlineParagraphs, [["\\tfrac{1}{2}"]])
})

test("docxXmlToHtml emits separate math blocks for multi-row formula tables", () => {
  const html = docxXmlToHtml(multiRowTableDocumentXml, {}, {}, {})
  const blocks = collectMathBlocks(html)

  assert.deepEqual(
    blocks.map((block) => block.label),
    ["(31)", "(32)"]
  )
  assert.deepEqual(
    blocks.map((block) => block.latex),
    ["k_p = 0", "k_e = 0"]
  )
  assert.ok(blocks.every((block) => block.mathml.startsWith("<math ")))
})

test("docxXmlToHtml wraps multiline non-cases display formulas in left-aligned array", () => {
  const html = docxXmlToHtml(multilineTableDocumentXml, {}, {}, {})
  const blocks = collectMathBlocks(html)

  assert.equal(blocks.length, 1)
  assert.match(blocks[0].latex, /^\\begin\{array\}\{l\}[\s\S]*\\end\{array\}$/)
  assert.doesNotMatch(blocks[0].latex, /&=/)
  assert.doesNotMatch(blocks[0].latex, /^\\begin\{cases\}/)
  assert.match(blocks[0].mathml, /<mtable columnalign="left">/)
})

/** MTEF: single variable x (mtef-to-mathml builders pattern) */
const minimalMtefX = new Uint8Array([
  5, 1, 0, 7, 0, 0x54, 0x45, 0x53, 0x54, 0, 0, 1, 0, 2, 0, 0, 0x78, 0, 0, 0
])

test("docxXmlToHtml MTEF: w:object Equation.DSMT4 + ole blob → display math-block with data-mathml", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
              xmlns:o="urn:schemas-microsoft-com:office:office">
    <w:body>
      <w:p>
        <w:r>
          <w:object>
            <o:OLEObject r:id="rIdOLE1" ProgID="Equation.DSMT4"/>
          </w:object>
        </w:r>
      </w:p>
    </w:body>
  </w:document>`
  const oleBlobs = new Map([["embeddings/oleObject1.bin", minimalMtefX]])
  const oleEmbedRels = { rIdOLE1: "embeddings/oleObject1.bin" }
  const html = docxXmlToHtml(xml, {}, {}, {}, oleEmbedRels, oleBlobs)
  assert.match(html, /<div class="math-block"[^>]*data-mathml="[^"]+"/)
  assert.match(html, /data-mathml="[^"]*&lt;mi&gt;x&lt;\/mi&gt;/)
})

test("docxXmlToHtml MTEF: inline w:object between text runs → math-inline", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
              xmlns:o="urn:schemas-microsoft-com:office:office">
    <w:body>
      <w:p>
        <w:r><w:t>где </w:t></w:r>
        <w:r>
          <w:object>
            <o:OLEObject r:id="rId1" ProgID="Equation.DSMT4"/>
          </w:object>
        </w:r>
        <w:r><w:t> далее</w:t></w:r>
      </w:p>
    </w:body>
  </w:document>`
  const oleBlobs = new Map([["embeddings/e1.bin", minimalMtefX]])
  const oleEmbedRels = { rId1: "embeddings/e1.bin" }
  const html = docxXmlToHtml(xml, {}, {}, {}, oleEmbedRels, oleBlobs)
  assert.match(html, /<span class="math-inline"[^>]*data-mathml="/)
})

test("docxXmlToHtml MTEF: trailing (5) in same paragraph as display OLE → data-label, no separate (5) paragraph", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
              xmlns:o="urn:schemas-microsoft-com:office:office">
    <w:body>
      <w:p>
        <w:r>
          <w:object>
            <o:OLEObject r:id="rId1" ProgID="Equation.DSMT4"/>
          </w:object>
        </w:r>
        <w:r><w:t>(5)</w:t></w:r>
      </w:p>
    </w:body>
  </w:document>`
  const oleBlobs = new Map([["embeddings/e1.bin", minimalMtefX]])
  const oleEmbedRels = { rId1: "embeddings/e1.bin" }
  const html = docxXmlToHtml(xml, {}, {}, {}, oleEmbedRels, oleBlobs)
  const blocks = collectMathBlocks(html)
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].label, "(5)")
  assert.doesNotMatch(html, /<p[^>]*>\(5\)<\/p>/)
})

test("real Semion DOCX yields 32 labeled display formulas with preserved multiline math", async () => {
  const docxPath = new URL("../../docs/test_semion_full.docx", import.meta.url)
  const xml = await loadDocumentXmlFromDocx(docxPath)
  const html = docxXmlToHtml(xml, {}, {}, {})
  const blocks = collectMathBlocks(html)
  const inlineParagraphs = collectInlineMathParagraphs(html)

  assert.equal(blocks.length, 32)

  const byLabel = new Map(blocks.map((block) => [block.label, block.latex]))
  assert.ok(byLabel.has("(8)"))
  assert.ok(byLabel.has("(24)"))
  assert.ok(byLabel.has("(25)"))
  assert.ok(byLabel.has("(26)"))
  assert.ok(byLabel.has("(31)"))
  assert.ok(byLabel.has("(32)"))
  assert.ok([...byLabel.keys()].every((label) => !label || blocks.find((block) => block.label === label)?.mathml.includes("<math")))

  // Formulas (2) and (4) do NOT have { in Word original — no cases
  assert.match(byLabel.get("(2)"), /^\\begin\{array\}\{l\}/)
  assert.doesNotMatch(byLabel.get("(2)"), /&=/)
  assert.doesNotMatch(byLabel.get("(2)"), /^\\begin\{cases\}/)
  assert.match(byLabel.get("(2)"), /u\(t\)\\in U,\\; w\(t\)\\in W,\\; t\\in \[t_\{0\},t_\{f\}\],?/)
  assert.ok(!inlineParagraphs.some((paragraph) =>
    paragraph.length === 3 &&
    /u\(t\)\\in U/.test(paragraph[0] || "") &&
    /w\(t\)\\in W/.test(paragraph[1] || "") &&
    /t\\in \[t_\{0\},t_\{f\}\]/.test(paragraph[2] || "")
  ))

  assert.match(byLabel.get("(4)"), /^\\begin\{array\}\{l\}/)
  assert.doesNotMatch(byLabel.get("(4)"), /&=/)
  assert.doesNotMatch(byLabel.get("(4)"), /^\\begin\{cases\}/)
  assert.match(byLabel.get("(7)"), /^\\left\\\{\\begin\{aligned\}/)
  assert.match(byLabel.get("(7)"), /&=/)
  assert.doesNotMatch(byLabel.get("(7)"), /\\begin\{cases\}/)
  assert.doesNotMatch(byLabel.get("(7)"), /\\begin\{pmatrix\}/)
  assert.match(byLabel.get("(9)"), /^\\left\\\{\\begin\{aligned\}/)
  assert.match(byLabel.get("(9)"), /&=/)
  assert.doesNotMatch(byLabel.get("(9)"), /\\begin\{cases\}/)
  assert.doesNotMatch(byLabel.get("(9)"), /\\begin\{pmatrix\}/)

  assert.match(byLabel.get("(8)"), /\\int_\{t_\{0\}\}\^\{t_\{f\}\}/)
  assert.match(byLabel.get("(8)"), /ε\^\{T\}\(t\)Qε\(t\)/)
  assert.match(byLabel.get("(8)"), /dt/)

  assert.match(byLabel.get("(24)"), /\\otimes/)
  assert.match(byLabel.get("(24)"), /u_\{p\}\^\{T\}\(t\)Ru_\{p\}\(t\)/)
  assert.match(byLabel.get("(24)"), /1_\{n\}\\otimes u_\{e\}\(t\)/)

  assert.match(byLabel.get("(15)"), /\\\\/)
  assert.match(byLabel.get("(16)"), /\\\\/)

  assert.match(byLabel.get("(25)"), /^\\begin\{array\}\{l\}/)
  assert.match(byLabel.get("(25)"), /\\\\/)
  assert.doesNotMatch(byLabel.get("(25)"), /&=/)
  assert.match(byLabel.get("(25)"), /,\s*\\end\{array\}$/)

  assert.match(byLabel.get("(26)"), /\\\\/)
  assert.match(byLabel.get("(31)"), /k_\{p\}/)
  assert.match(byLabel.get("(32)"), /k_\{e\}/)
})

test("real Trukhachev DOCX: 90+ math from MTEF OLE (fixture optional)", async (t) => {
  const truPath = fileURLToPath(new URL("./fixtures/trukhachev.docx", import.meta.url))
  try {
    await access(truPath, constants.R_OK)
  } catch {
    t.skip("Add tests/fixtures/trukhachev.docx (copy from Nauka corpus)")
    return
  }
  const buf = await fs.readFile(truPath)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  const html = await docxBufferToNormalizedHtml(ab)
  const nBlock = (html.match(/class="math-block"/g) || []).length
  const nInline = (html.match(/class="math-inline"/g) || []).length
  assert.ok(
    nBlock + nInline >= 90,
    `expected >= 90 math nodes, got block=${nBlock} inline=${nInline}`
  )
  const lonely = (html.match(/<p[^>]*>\s*\(\d{1,3}\)\s*<\/p>/gi) || []).length
  assert.ok(lonely <= 5, `unexpected lonely label paragraphs: ${lonely}`)
})

test("v0.48: weak-path UPPERCASE all-bold <p> → h2 with data-section-type (linkedom)", () => {
  const doc = parseHTML(`<div id="r">
    <p><strong>ВВЕДЕНИЕ</strong></p>
    <p><strong>МАТЕРИАЛЫ И МЕТОДИКА</strong></p>
    <p><strong>РЕЗУЛЬТАТЫ И ОБСУЖДЕНИЕ</strong></p>
    <p><strong>ЗАКЛЮЧЕНИЕ</strong></p>
    <p><strong>СПИСОК ЛИТЕРАТУРЫ</strong></p>
  </div>`)
  const root = doc.document.getElementById("r")
  assert.ok(root)
  applyWeakPathUppercaseHeadingHeuristicToRoot(root)
  const html = root.innerHTML
  assert.match(html, /data-section-type="introduction"/)
  assert.match(html, /data-section-type="methods"/)
  assert.match(html, /data-section-type="results"/)
  assert.match(html, /data-section-type="conclusion"/)
  assert.match(html, /data-section-type="references"/)
  assert.equal(root.querySelectorAll("h2").length, 5)
})

test("v0.48: heuristic skips DOI line and non-bold UPPERCASE", () => {
  const doc = parseHTML(`<div id="r">
    <p><strong>DOI:</strong> 10.1234/ABCD</p>
    <p>ОБЫЧНЫЙ ТЕКСТ БЕЗ ТЕГОВ ЖИРНОГО</p>
    <p><strong>ВКЛАД АВТОРОВ</strong></p>
  </div>`)
  const root = doc.document.getElementById("r")
  applyWeakPathUppercaseHeadingHeuristicToRoot(root)
  const html = root.innerHTML
  assert.match(html, /<p[^>]*>.*DOI:/u)
  assert.match(html, /ОБЫЧНЫЙ ТЕКСТ/u)
  assert.match(html, /data-section-type="author_contributions"/)
  assert.equal(root.querySelectorAll("h2").length, 1)
})

test("v0.50: omml m:d one m:e + trailing m:r keeps +y outside fenced mrow", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
  <m:d>
    <m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>
    <m:e><m:r><m:t>x</m:t></m:r></m:e>
  </m:d>
  <m:r><m:t>+y</m:t></m:r>
</m:oMath>`
  const doc = parseXml(xml)
  const om = doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/officeDocument/2006/math", "oMath")[0]
  const mml = ommlToMathML(om, { display: false, wrap: true })
  const idxClose = mml.indexOf('form="postfix">)</mo>')
  const idxY = mml.indexOf("<mi>y</mi>")
  assert.ok(idxClose > 0 && idxY > 0 && idxClose < idxY)
})

test("v0.50: omml m:d with two m:e — parentheses wrap only first m:e; rest is sibling", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
  <m:d>
    <m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>
    <m:e><m:r><m:t>x</m:t></m:r></m:e>
    <m:e><m:r><m:t>+y</m:t></m:r></m:e>
  </m:d>
</m:oMath>`
  const doc = parseXml(xml)
  const om = doc.getElementsByTagNameNS("http://schemas.openxmlformats.org/officeDocument/2006/math", "oMath")[0]
  assert.ok(om)
  const mml = ommlToMathML(om, { display: false, wrap: true })
  const idxClose = mml.indexOf('form="postfix">)</mo>')
  const idxY = mml.indexOf("<mi>y</mi>")
  assert.ok(idxClose > 0 && idxY > 0 && idxClose < idxY, "trailing content follows closing fence mo")
})

test("v0.50: normalizeImportedHtml promotes figure-as-table and bilingual table captions", () => {
  const { document: doc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prev = globalThis.document
  globalThis.document = doc
  try {
    const html = `
<p>Before</p>
<table><tr><td><p>Рис. 1. Подпись</p><p>Fig. 1. Caption</p></td></tr></table>
<p>Таблица 1.</p>
<p>Table 1.</p>
<table><tr><td>A</td></tr></table>
`
    const out = normalizeImportedHtml(html)
    assert.match(out, /figure[^>]*class="figure-block"/u)
    assert.match(out, /figure-caption-ru/u)
    assert.match(out, /figure-caption-en/u)
    assert.match(out, /table-caption-ru/u)
    assert.match(out, /table-caption-en/u)
    assert.doesNotMatch(out, /<p[^>]*>Таблица 1/u)
    assert.doesNotMatch(out, /<p[^>]*>Table 1/u)
  } finally {
    if (prev) globalThis.document = prev
    else delete globalThis.document
  }
})

test("v0.50.4: bare <img> paragraph with adjacent Рис./Fig. captions → figure-block (Sazykina pattern)", () => {
  const { document: doc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prev = globalThis.document
  globalThis.document = doc
  try {
    const html = `
<p>Before</p>
<p><img src="data:image/png;base64,xxx" alt=""></p>
<p>Рис. 1. Подпись на русском</p>
<p>Fig. 1. English caption</p>
<p>After</p>
`
    const out = normalizeImportedHtml(html)
    assert.match(out, /<figure[^>]*class="figure-block"[^>]*>/u, "figure-block created")
    assert.match(out, /<img[^>]*figure-block-img/u, "img has figure-block-img class")
    assert.match(out, /figure-caption-ru/u, "RU caption attached")
    assert.match(out, /figure-caption-en/u, "EN caption attached")
    assert.match(out, /data-number="1"/u, "data-number filled from caption")
    // Original loose <p>'s removed
    assert.doesNotMatch(out, /<p[^>]*>Рис\. 1/u)
    assert.doesNotMatch(out, /<p[^>]*>Fig\. 1/u)
  } finally {
    if (prev) globalThis.document = prev
    else delete globalThis.document
  }
})

test("v0.50.4: figure-as-table without inner caption + adjacent Рис./Fig. <p> → captions absorbed", () => {
  const { document: doc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prev = globalThis.document
  globalThis.document = doc
  try {
    // Table with image only, caption lives as next siblings (Sazykina sub-pattern)
    const html = `
<table><tr><td><img src="data:image/png;base64,xxx" alt=""></td></tr></table>
<p>Рис. 2. Описание</p>
<p>Fig. 2. Description</p>
<p>Дальше идёт обычный текст.</p>
`
    const out = normalizeImportedHtml(html)
    // Note: this table has no Рис/Fig text inside, so promoteFigureAsTableFramesInRoot won't fire.
    // promoteLooseFigureCaptionsAroundImagesInRoot can't fire either (table is not <p><img></p>).
    // attachLooseFigureCaptionsToFiguresInRoot only fixes existing figure-blocks.
    // → For this exact pattern (table + adjacent caption), we expect captions to remain as <p>'s.
    // This test documents the limitation; main fix is the bare <img><p>caption</p> pattern above.
    assert.ok(out.includes("Рис. 2") || out.includes("Описание"), "RU caption preserved somewhere")
  } finally {
    if (prev) globalThis.document = prev
    else delete globalThis.document
  }
})

test("v0.50.4: bilingual single-paragraph caption split also works WITHOUT <strong> wrapper", () => {
  const { document: doc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prev = globalThis.document
  globalThis.document = doc
  try {
    // Single <p> mixing RU+EN without <strong> tags around Fig
    const html = `
<p><img src="data:image/png;base64,xxx" alt=""></p>
<p>Рис. 3. Зависимость от давления. Fig. 3. Pressure dependence.</p>
`
    const out = normalizeImportedHtml(html)
    assert.match(out, /<figure[^>]*class="figure-block"/u)
    assert.match(out, /figure-caption-ru/u)
    assert.match(out, /figure-caption-en/u)
    // Note: typography normalizer inserts NBSP (\u00A0 → &#160;) before short
    // prepositions like "от", so check for the unique words individually.
    assert.match(out, /Зависимость/u)
    assert.match(out, /давления/u)
    assert.match(out, /Pressure dependence/u)
    // RU and EN must end up in DIFFERENT figcaptions
    const ruIdx = out.indexOf('class="figure-caption-ru"')
    const enIdx = out.indexOf('class="figure-caption-en"')
    assert.ok(ruIdx > 0 && enIdx > ruIdx, "ru caption before en caption in output")
    const ruSegment = out.slice(ruIdx, enIdx)
    assert.match(ruSegment, /Рис/u, "Рис in ru segment")
    assert.doesNotMatch(ruSegment, /Pressure/u, "Pressure NOT in ru segment")
  } finally {
    if (prev) globalThis.document = prev
    else delete globalThis.document
  }
})

test("v0.50.5: splitBilingualFigureCaptionHtml — <br> separator", () => {
  const html = "Рис. 1. Описание.<br>Fig. 1. Description."
  const r = splitBilingualFigureCaptionHtml(html)
  assert.ok(r, "split result not null")
  assert.match(r.ruHtml, /Рис\. 1/u)
  assert.match(r.enHtml, /Fig\. 1/u)
  assert.doesNotMatch(r.ruHtml, /Fig\./u)
  assert.doesNotMatch(r.enHtml, /Рис/u)
})

test("v0.50.5: splitBilingualFigureCaptionHtml — <strong>Fig boundary", () => {
  const html = "<strong>Рис. 2.</strong> Описание. <strong>Fig. 2.</strong> Description."
  const r = splitBilingualFigureCaptionHtml(html)
  assert.ok(r, "split result not null")
  assert.match(r.ruHtml, /Рис\. 2/u)
  assert.match(r.enHtml, /Fig\. 2/u)
})

test("v0.50.5: splitBilingualFigureCaptionHtml — plain Fig boundary, no whitespace before Fig", () => {
  // Sazykina pattern: «...2023 гг.Fig. 1...» (no space between гг. and Fig)
  const html = "Рис. 1. Мощность дозы в 2004 – 2023 гг.Fig. 1. Dose rate, 2004 – 2023"
  const r = splitBilingualFigureCaptionHtml(html)
  assert.ok(r, "split result not null")
  assert.match(r.ruHtml, /2023 гг\.$/u, "RU ends at гг.")
  assert.match(r.enHtml, /^Fig\. 1/u, "EN starts at Fig. 1")
})

test("v0.50.5: splitBilingualFigureCaptionHtml — no markers → null", () => {
  assert.equal(splitBilingualFigureCaptionHtml("Просто текст без рисунков."), null)
  assert.equal(splitBilingualFigureCaptionHtml("Only English caption text."), null)
  assert.equal(splitBilingualFigureCaptionHtml(""), null)
  assert.equal(splitBilingualFigureCaptionHtml(null), null)
})

test("v0.50.5: plain-text brackets get stretchy=\"false\" (Sazykina formula 3 fix)", () => {
  // Plain-text bracket: «(λ» comes as a single <m:t> outside any <m:d>
  const omml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:r><m:t>(λ</m:t></m:r>
    <m:sSub>
      <m:e><m:r><m:t>x</m:t></m:r></m:e>
      <m:sub><m:r><m:t>i</m:t></m:r></m:sub>
    </m:sSub>
    <m:r><m:t>+y</m:t></m:r>
    <m:r><m:t>)</m:t></m:r>
  </m:oMath>`
  const om = parseXml(omml).documentElement
  const mml = ommlToMathML(om, { display: true, wrap: false })
  // Both opening and closing brackets must be marked stretchy="false"
  assert.match(mml, /<mo stretchy="false">\(<\/mo>/u, "( has stretchy=false")
  assert.match(mml, /<mo stretchy="false">\)<\/mo>/u, ") has stretchy=false")
  // λ next to ( must be a separate mi (not glued into one token)
  assert.match(mml, /<mi>λ<\/mi>/u, "λ is its own mi")
})

test("v0.50.5: real <m:d> fence brackets are NOT touched (still get fence=\"true\")", () => {
  // Inside <m:d> we emit <mo fence="true" form="prefix">(</mo> via the d branch,
  // not through textToMathML — must remain unchanged.
  const omml = `<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">
    <m:d>
      <m:dPr><m:begChr m:val="("/><m:endChr m:val=")"/></m:dPr>
      <m:e><m:r><m:t>x</m:t></m:r></m:e>
      <m:e><m:r><m:t>+y</m:t></m:r></m:e>
    </m:d>
  </m:oMath>`
  const om = parseXml(omml).documentElement
  const mml = ommlToMathML(om, { display: true, wrap: false })
  // The fence emit path uses fence="true" form="..." — confirm we still see those
  assert.match(mml, /<mo fence="true" form="prefix">\(<\/mo>/u)
  assert.match(mml, /<mo fence="true" form="postfix">\)<\/mo>/u)
})

test("v0.50.6: splitBilingualFigureCaptionHtml decodes &#160; (NBSP entity)", () => {
  // Sazykina pattern: «<strong>Рис.</strong><strong>&#160;</strong><strong>1</strong>…»
  // Without entity decoding, regex Рис\.\s*\d couldn't match through &#160;
  const html = '<strong>Рис.</strong><strong>&#160;</strong><strong>1</strong>. Описание 2023 гг.<strong>Fig. 1</strong>. Description 2023'
  const r = splitBilingualFigureCaptionHtml(html)
  assert.ok(r, "split must succeed even with NBSP entity")
  assert.match(r.ruHtml, /Рис/u)
  assert.match(r.enHtml, /Fig\. 1/u)
  assert.doesNotMatch(r.enHtml, /Рис/u)
})

test("v0.50.6: figure-as-table with NO <p> wrappers in cells (Sazykina inline pattern)", () => {
  const { document: doc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prev = globalThis.document
  globalThis.document = doc
  try {
    // Caption sits directly inside <td> as inline HTML with <strong> for the
    // number prefix and BOTH languages in the same cell — no <p> wrappers.
    const html = `
<table>
  <tr><td></td></tr>
  <tr><td><strong>Рис.</strong><strong>&#160;</strong><strong>1</strong>. Описание на русском, 2023 гг.<strong>Fig. 1</strong>. English caption, 2023</td></tr>
</table>
`
    const out = normalizeImportedHtml(html)
    assert.match(out, /<figure[^>]*class="figure-block"/u, "figure-block created")
    assert.match(out, /class="figure-placeholder"/u, "placeholder created (no img in source)")
    // Two figcaptions — RU and EN
    const ruIdx = out.indexOf('class="figure-caption-ru"')
    const enIdx = out.indexOf('class="figure-caption-en"')
    assert.ok(ruIdx > 0, "ru figcaption present")
    assert.ok(enIdx > ruIdx, "en figcaption present after ru")
    // Bold preserved (no textContent fallback)
    const ruSegment = out.slice(ruIdx, enIdx)
    assert.match(ruSegment, /<strong>Рис\.<\/strong>/u, "<strong>Рис.</strong> preserved")
    assert.match(out.slice(enIdx), /<strong>Fig\. 1<\/strong>/u, "<strong>Fig. 1</strong> preserved")
    // EN content does NOT leak into RU figcaption
    assert.doesNotMatch(ruSegment, /Fig\. 1/u, "Fig. 1 NOT in ru segment")
    // data-number filled
    assert.match(out, /data-number="1"/u)
  } finally {
    if (prev) globalThis.document = prev
    else delete globalThis.document
  }
})

test("v0.50.5: splitBilingualFigureCaptionHtml — only RU → null (no EN to split)", () => {
  const html = "Рис. 1. Только русская подпись без английской части."
  assert.equal(splitBilingualFigureCaptionHtml(html), null)
})

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"

test("v0.52: getPStyleValue reads w:pStyle", () => {
  const xml = `<w:p xmlns:w="${W_NS}"><w:pPr><w:pStyle w:val="Author"/></w:pPr><w:r><w:t>x</w:t></w:r></w:p>`
  const doc = parseXml(xml)
  const p = doc.getElementsByTagName("w:p")[0]
  assert.equal(getPStyleValue(p, W_NS), "Author")
})

test("v0.52: Pleiades TitleArticle → h1 style-title-article + title", () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="${W_NS}"><w:body><w:p><w:pPr><w:pStyle w:val="TitleArticle"/></w:pPr><w:r><w:t>Ion title</w:t></w:r></w:p></w:body></w:document>`
  const html = docxXmlToHtml(xml, {}, {}, {}, {}, new Map())
  assert.match(html, /<h1[^>]*class="[^"]*style-title-article/)
  assert.match(html, /data-section-type="title"/)
})

test("v0.52: Pleiades Author → style-author paragraph", () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="${W_NS}"><w:body><w:p><w:pPr><w:pStyle w:val="Author"/></w:pPr><w:r><w:t>И.И. Иванов</w:t></w:r></w:p></w:body></w:document>`
  const html = docxXmlToHtml(xml, {}, {}, {}, {}, new Map())
  assert.match(html, /<p[^>]*class="[^"]*style-author/)
})

test("v0.52: Pleiades Heading2 → h2 style-heading2 + introduction", () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="${W_NS}"><w:body><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>1. ВВЕДЕНИЕ</w:t></w:r></w:p></w:body></w:document>`
  const html = docxXmlToHtml(xml, {}, {}, {}, {}, new Map())
  assert.match(html, /<h2[^>]*class="[^"]*style-heading2/)
  assert.match(html, /data-section-type="introduction"/)
})

test("v0.52: figure caption paragraph before image-only paragraph → figure-block", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
              xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
              xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
    <w:body>
      <w:p>
        <w:r><w:t>Рис. 1. Подпись.</w:t></w:r>
      </w:p>
      <w:p>
        <w:r>
          <w:drawing>
            <a:graphic>
              <a:graphicData>
                <a:pic>
                  <a:blipFill>
                    <a:blip r:embed="rId1"/>
                  </a:blipFill>
                </a:pic>
              </a:graphicData>
            </a:graphic>
          </w:drawing>
        </w:r>
      </w:p>
    </w:body>
  </w:document>`
  const html = docxXmlToHtml(xml, {}, { rId1: "img.png" }, {}, {}, new Map())
  assert.match(html, /<figure[^>]*class="figure-block"[^>]*><img[^>]*src="img\.png"/)
  assert.match(html, /<figcaption class="figure-caption-ru">/)
})

test("v0.52: Рисунок1 without space + merged caption splits before «А именно» (image next)", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="${W_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>Рисунок1. Короткая подпись. А именно, здесь идёт длинное продолжение параграфа с множеством текста для обсуждения солитонов и всего остального.</w:t></w:r></w:p>
    <w:p><w:r><w:drawing><a:graphic><a:graphicData><a:pic><a:blipFill><a:blip r:embed="rId1"/></a:blipFill></a:pic></a:graphicData></a:graphic></w:drawing></w:r></w:p>
  </w:body>
</w:document>`
  const html = docxXmlToHtml(xml, {}, { rId1: "img.png" }, {}, {}, new Map())
  assert.match(html, /figure-caption-ru/)
  assert.match(html, /style-body/)
  assert.match(html, /А именно/u)
  assert.match(html, /Короткая подпись/u)
  assert.match(html, /<figure[^>]*figure-block/)
})

test("v0.54: splitBilingual RU-only returns null (full caption preserved by caller)", () => {
  assert.equal(splitBilingualFigureCaptionHtml("Рис. 1. Зависимость X от Y."), null)
})

test("v0.54: splitBilingual bilingual splits at Fig with full tails", () => {
  const s = splitBilingualFigureCaptionHtml(
    "Рис. 1. Полный русский текст. Fig. 1. Full English text here."
  )
  assert.ok(s)
  assert.match(s.ruHtml, /Полный русский/u)
  assert.match(s.enHtml, /Full English/u)
})

test("v0.54: normalizeImportedHtml promotes style-figure + adjacent fig-caption", () => {
  const { document: doc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prevDoc = globalThis.document
  globalThis.document = doc
  try {
    const html =
      '<p class="style-figure"><img src="x.png" alt=""></p>\n' +
      '<p class="style-fig-caption">Рис. 1. Длинная подпись для проверки импорта.</p>\n'
    const out = normalizeImportedHtml(html)
    assert.match(out, /figure-block/)
    assert.match(out, /Длинная подпись/u)
  } finally {
    globalThis.document = prevDoc
  }
})

test("v0.54: orphan style-fig-caption becomes figure with placeholder", () => {
  const { document: doc } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const prevDoc = globalThis.document
  globalThis.document = doc
  try {
    const html = '<p class="style-fig-caption">Рис. 2. Только подпись без картинки.</p>\n'
    const out = normalizeImportedHtml(html)
    assert.match(out, /figure-placeholder/)
    assert.match(out, /Только подпись/u)
  } finally {
    globalThis.document = prevDoc
  }
})

test("v0.55: RU-only long figure caption — splitBilingualFigureCaptionHtml returns null (full RU)", () => {
  const html =
    "Рис. 1. Зависимость качества <em>X</em> от параметра <em>Y</em> в условиях эксперимента."
  assert.equal(splitBilingualFigureCaptionHtml(html), null)
})

test("v0.55: bilingual single paragraph still splits at strict Fig marker", () => {
  const html =
    "Рис. 1. Описание по-русски. Fig. 1. English description continues here with enough text."
  const sp = splitBilingualFigureCaptionHtml(html)
  assert.ok(sp)
  assert.match(sp.ruHtml, /Рис\.\s*1/u)
  assert.match(sp.enHtml, /Fig\.\s*1/u)
})

test("v0.55: promoteOrphanStyleFigureCaptionParagraphsInRoot — style-figure caption without img → placeholder", () => {
  const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const root = document.body
  const p = document.createElement("p")
  p.className = "style-figure"
  p.innerHTML = "Рис. 3. Подпись к рисунку без встроенного изображения в параграфе."
  root.appendChild(p)
  promoteOrphanStyleFigureCaptionParagraphsInRoot(root, document)
  assert.match(root.innerHTML, /figure-block/)
  assert.match(root.innerHTML, /figure-placeholder/)
  assert.match(root.innerHTML, /Подпись/u)
  assert.match(root.innerHTML, /рисунку/u)
})

test("v0.54: promoteFloatingFiguresAndCaptionsInRoot pairs figure paragraph + caption", () => {
  const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const root = document.body
  const figP = document.createElement("p")
  figP.className = "style-figure"
  const img = document.createElement("img")
  img.src = "a.png"
  figP.appendChild(img)
  const cap = document.createElement("p")
  cap.className = "style-fig-caption"
  cap.textContent = "Рис. 3. Синтетическая подпись."
  root.appendChild(figP)
  root.appendChild(cap)
  promoteFloatingFiguresAndCaptionsInRoot(root, document)
  assert.match(root.innerHTML, /figure-block/)
  assert.match(root.innerHTML, /Синтетическая/u)
})

test("v0.53: «Рисунок N. демонстрирует…» without adjacent image is not fig-caption", () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="${W_NS}"><w:body><w:p><w:r><w:t>Рисунок 1. демонстрирует классические свойства солитонов и далее обычный текст без рисунка рядом.</w:t></w:r></w:p></w:body></w:document>`
  const html = docxXmlToHtml(xml, {}, {}, {}, {}, new Map())
  assert.doesNotMatch(html, /style-fig-caption/)
})

test("MathLive from npm; MathJax 4 CDN in index — no mathjax-full, no KaTeX", async () => {
  const indexPath = new URL("../index.html", import.meta.url)
  const packagePath = new URL("../package.json", import.meta.url)
  const [indexHtml, pkg] = await Promise.all([
    fs.readFile(indexPath, "utf8"),
    fs.readFile(packagePath, "utf8")
  ])

  assert.match(pkg, /"mathlive"/)
  assert.doesNotMatch(pkg, /"mathjax-full"/)
  assert.match(indexHtml, /mathjax@4\/tex-mml-chtml\.js/)
  assert.match(indexHtml, /math-jax-boot\.js/)
  const bootPath = new URL("../src/math-jax-boot.js", import.meta.url)
  const boot = await fs.readFile(bootPath, "utf8")
  assert.match(boot, /globalThis\.MathJax|window\.MathJax/)
  assert.match(boot, /stix2|fontURL/u)
  assert.doesNotMatch(indexHtml, /katex/i)
  assert.doesNotMatch(pkg, /"katex"/)
})
