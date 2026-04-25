import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import JSZip from "jszip"
import { DOMParser } from "xmldom"
import { parseHTML } from "linkedom"
import {
  applyWeakPathUppercaseHeadingHeuristicToRoot,
  docxXmlToHtml,
  normalizeImportedHtml,
  ommlToLatex,
  ommlToMathML
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

  assert.match(html, /<h1 id="[^"]+" data-section-type="introduction">Введение<\/h1>/u)
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
