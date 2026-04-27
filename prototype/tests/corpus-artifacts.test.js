import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { buildCorpusArtifactRecords, writeCorpusArtifact } from "../scripts/corpus-baseline.mjs"

const xmlString = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:o="urn:schemas-microsoft-com:office:office">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="TitleArticle"/></w:pPr><w:r><w:t>Test title</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="References"/></w:pPr><w:r><w:t>[1] Ref</w:t></w:r></w:p>
    <w:p><w:r><w:t>Рис. 1. Caption</w:t></w:r></w:p>
  </w:body>
</w:document>`

test("v0.57: corpus artifact records include header and typed paragraph rows", () => {
  const records = buildCorpusArtifactRecords({
    abs: "C:/tmp/test.docx",
    rel: "Физика плазмы/1 25/Test/Test.docx",
    ctx: { xmlString, images: {}, imageRels: {}, oleEmbedRels: {} },
    html: '<h1 class="style-title-article">Test title</h1><p>[1] Ref</p>',
    references: [{ id: "ref-1", raw: "[1] Ref" }],
    importVersion: "test"
  })
  assert.equal(records[0].type, "header")
  assert.equal(records[0].totals.paragraphs, 3)
  assert.equal(records[1].pi, 0)
  assert.equal(records[1].pStyle, "TitleArticle")
  assert.equal(typeof records[1].raw_text, "string")
  assert.equal(typeof records[1].has_image, "boolean")
  assert.equal(records[1].imported_as, "metadata-title")
})

test("v0.57: writeCorpusArtifact creates jsonl file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wysiwyg-artifacts-"))
  try {
    const out = await writeCorpusArtifact({
      artifactDir: dir,
      abs: "C:/tmp/test.docx",
      rel: "Физика плазмы/1 25/Test/Test.docx",
      ctx: { xmlString, images: {}, imageRels: {}, oleEmbedRels: {} },
      html: "<p>Body</p>",
      references: []
    })
    const lines = (await readFile(out, "utf8")).trim().split("\n").map((line) => JSON.parse(line))
    assert.equal(lines[0].type, "header")
    assert.ok(lines.length >= 2)
    assert.equal(typeof lines[1].imported_as, "string")
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
