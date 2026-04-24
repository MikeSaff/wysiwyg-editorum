import test from "node:test"
import assert from "node:assert/strict"
import { Fragment } from "prosemirror-model"
import { schema, newNodeId } from "../src/schema.js"

test("legacy minimal doc JSON parses (no v2 attrs)", () => {
  const json = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "hi" }] },
      { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "T" }] },
      { type: "math_block", attrs: { latex: "x", mathml: "", label: null } }
    ]
  }
  const node = schema.nodeFromJSON(json)
  assert.equal(node.childCount, 3)
  assert.equal(node.child(2).type.name, "math_block")
  assert.equal(node.child(2).attrs.id, null)
  assert.equal(node.child(1).attrs.sectionType, null)
})

test("v0.46: figure_block + table_block + atoms round-trip JSON", () => {
  const img = schema.nodes.figure_image.create({ src: "https://example.com/i.png", alt: "a" })
  const fb = schema.nodes.figure_block.create({ id: newNodeId() }, img)
  const rowCells = [
    schema.nodes.table_cell.createAndFill(),
    schema.nodes.table_cell.createAndFill()
  ]
  const row = schema.nodes.table_row.create(null, rowCells)
  const table = schema.nodes.table.create(null, [row])
  const tb = schema.nodes.table_block.create({ id: newNodeId() }, table)
  const cite = schema.nodes.citation_ref.create({ ref_ids: ["doi:1", "doi:2"] })
  const fn = schema.nodes.footnote_ref.create({ footnote_id: "n1" })
  const p = schema.nodes.paragraph.create({}, Fragment.from([cite, schema.text(" "), fn]))
  const doc = schema.nodes.doc.create({}, Fragment.from([fb, tb, p]))
  const json = doc.toJSON()
  const doc2 = schema.nodeFromJSON(json)
  assert.equal(doc2.childCount, 3)
  assert.equal(doc2.child(0).type.name, "figure_block")
  assert.equal(doc2.child(1).type.name, "table_block")
  assert.ok(newNodeId().length > 4)
})

test("v0.46: heading with sectionType and paragraph lang in JSON", () => {
  const h = schema.nodes.heading.create(
    { level: 1, id: "sec-1", sectionType: "introduction" },
    schema.text("Intro")
  )
  const p = schema.nodes.paragraph.create({ lang: "en" }, schema.text("Abstract text"))
  const doc = schema.nodes.doc.create({}, Fragment.from([h, p]))
  const doc2 = schema.nodeFromJSON(doc.toJSON())
  assert.equal(doc2.child(0).attrs.sectionType, "introduction")
  assert.equal(doc2.child(1).attrs.lang, "en")
})
