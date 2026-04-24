import test from "node:test"
import assert from "node:assert/strict"
import { Fragment } from "prosemirror-model"
import { EditorState } from "prosemirror-state"
import { schema, newNodeId } from "../src/schema.js"
import { isValidFormulaImageSrc, insertFormulaImageTransaction, isDropPosInParagraph } from "../src/formula-image-insert.js"

test("isValidFormulaImageSrc accepts https and data URLs", () => {
  assert.equal(isValidFormulaImageSrc(""), false)
  assert.equal(isValidFormulaImageSrc("   "), false)
  assert.equal(isValidFormulaImageSrc("https://x.test/a.png"), true)
  assert.equal(isValidFormulaImageSrc("data:image/png;base64,xx"), true)
  assert.equal(isValidFormulaImageSrc("ftp://x"), false)
})

test("formula_image nodes round-trip JSON", () => {
  const b = schema.nodes.formula_image_block.create({
    id: newNodeId(),
    src: "data:image/png;base64,abc",
    alt: "f",
    latex_hint: "\\alpha",
    number: "2.1"
  })
  const i = schema.nodes.formula_image_inline.create({
    src: "https://ex/x.png",
    alt: "i",
    latex_hint: ""
  })
  const doc = schema.nodes.doc.create({}, Fragment.from([b, schema.nodes.paragraph.create({}, Fragment.from(i))]))
  const doc2 = schema.nodeFromJSON(doc.toJSON())
  assert.equal(doc2.child(0).type.name, "formula_image_block")
  assert.equal(doc2.child(1).child(0).type.name, "formula_image_inline")
})

test("isDropPosInParagraph detects paragraph depth", () => {
  const p = schema.nodes.paragraph.create({}, schema.text("x"))
  const doc = schema.nodes.doc.create({}, Fragment.from([p]))
  const posInside = 2
  assert.equal(isDropPosInParagraph(doc, posInside), true)
  const posDoc = 0
  assert.equal(isDropPosInParagraph(doc, posDoc), false)
})

test("insertFormulaImageTransaction applies (toolbar block)", () => {
  const p = schema.nodes.paragraph.create({}, schema.text("hi"))
  const doc = schema.nodes.doc.create({}, Fragment.from([p]))
  const state = EditorState.create({ doc })
  const tr = insertFormulaImageTransaction(state, 1, {
    src: "https://example.com/a.png",
    alt: "a",
    number: "1",
    latex_hint: "x",
    block: true,
    fromToolbar: true
  })
  assert.ok(tr)
  assert.ok(tr.steps.length > 0)
})
