import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import JSZip from "jszip"
import { DOMParser } from "xmldom"
import { docxXmlToHtml, ommlToLatex } from "../src/word-import.js"
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
  return [...html.matchAll(/<div class="math-block" data-latex="([^"]*)"(?: data-label="([^"]*)")?/g)].map((match) => ({
    latex: match[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&"),
    label: match[2] || null
  }))
}

function collectInlineMathParagraphs(html) {
  return [...html.matchAll(/<p>(.*?)<\/p>/g)].map((match) => {
    const formulas = [...match[1].matchAll(/data-latex="([^"]+)"/g)].map((inner) =>
      inner[1].replace(/&quot;/g, "\"").replace(/&amp;/g, "&")
    )
    return formulas
  }).filter((formulas) => formulas.length > 0)
}

test("ommlToLatex keeps the full integrand for n-ary expressions", () => {
  const doc = parseXml(integralOmml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement
  const latex = ommlToLatex(omml)

  assert.equal(latex, "\\int_{t_{0}}^{t_{f}} [x + u]dt")
})

test("ommlToLatex does not duplicate lim", () => {
  const doc = parseXml(limOmml)
  const omml = doc.getElementsByTagName("m:oMath")[0] || doc.documentElement
  const latex = ommlToLatex(omml)

  assert.match(latex, /^\\lim_\{x\\to ?\\infty\} f\(x\)$/)
  assert.equal((latex.match(/\\lim/g) || []).length, 1)
})

test("docxXmlToHtml splits multiple formula paragraphs in one table cell into separate lines", () => {
  const html = docxXmlToHtml(multilineTableDocumentXml, {}, {}, {})
  const blocks = collectMathBlocks(html)

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].label, "(25)")
  assert.equal(blocks[0].latex, "a = b, \\\\ c = d,")
})

test("docxXmlToHtml keeps auxiliary membership conditions outside the main formula block", () => {
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
  assert.equal(blocks[0].latex, "a = b, \\\\ x = 0")
  assert.deepEqual(inlineParagraphs, [["u\\in U,", "w\\in W"]])
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
})

test("real Semion DOCX yields 32 labeled display formulas with preserved multiline math", async () => {
  const docxPath = new URL("../../docs/test_semion_full.docx", import.meta.url)
  const xml = await loadDocumentXmlFromDocx(docxPath)
  const html = docxXmlToHtml(xml, {}, {}, {})
  const blocks = collectMathBlocks(html)

  assert.equal(blocks.length, 32)

  const byLabel = new Map(blocks.map((block) => [block.label, block.latex]))
  assert.ok(byLabel.has("(8)"))
  assert.ok(byLabel.has("(24)"))
  assert.ok(byLabel.has("(25)"))
  assert.ok(byLabel.has("(26)"))
  assert.ok(byLabel.has("(31)"))
  assert.ok(byLabel.has("(32)"))

  assert.match(byLabel.get("(2)"), /^\\begin\{cases\}/)
  assert.doesNotMatch(byLabel.get("(2)"), /u\(t\)\\in U/)
  assert.doesNotMatch(byLabel.get("(2)"), /w\(t\)\\in W/)
  assert.doesNotMatch(byLabel.get("(2)"), /t\\in \[t_\{0\},t_\{f\}\]/)

  assert.match(byLabel.get("(4)"), /^\\begin\{cases\}/)
  assert.match(byLabel.get("(7)"), /^\\begin\{cases\}/)
  assert.doesNotMatch(byLabel.get("(7)"), /\\begin\{pmatrix\}/)
  assert.match(byLabel.get("(9)"), /^\\begin\{cases\}/)
  assert.doesNotMatch(byLabel.get("(9)"), /\\begin\{pmatrix\}/)

  assert.match(byLabel.get("(8)"), /\\int_\{t_\{0\}\}\^\{t_\{f\}\}/)
  assert.match(byLabel.get("(8)"), /ε\^\{T\}\(t\)Qε\(t\)/)
  assert.match(byLabel.get("(8)"), /dt/)

  assert.match(byLabel.get("(24)"), /\\otimes/)
  assert.match(byLabel.get("(24)"), /u_\{p\}\^\{T\}\(t\)Ru_\{p\}\(t\)/)
  assert.match(byLabel.get("(24)"), /1_\{n\}\\otimes u_\{e\}\(t\)/)

  assert.match(byLabel.get("(15)"), /\\\\/)
  assert.match(byLabel.get("(16)"), /\\\\/)

  assert.match(byLabel.get("(25)"), /\\\\/)
  assert.match(byLabel.get("(25)"), /,$/)

  assert.match(byLabel.get("(26)"), /\\\\/)
  assert.match(byLabel.get("(31)"), /k_\{p\}/)
  assert.match(byLabel.get("(32)"), /k_\{e\}/)
})

test("styles keep KaTeX relation symbols on the surrounding text color", async () => {
  const cssPath = new URL("../src/styles.css", import.meta.url)
  const css = await fs.readFile(cssPath, "utf8")

  const hasSpecificRule = /\.ProseMirror\s+\.katex\s+\.mrel\s*\{[\s\S]*?color:\s*inherit;/.test(css)
  const hasGlobalRule = /\.ProseMirror\s+\.katex,\s*[\s\S]*?\.ProseMirror\s+\.katex\s*\*\s*\{[\s\S]*?color:\s*#000\s*!important;/.test(css)

  assert.ok(hasSpecificRule || hasGlobalRule)
})
