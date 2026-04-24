import test from "node:test"
import assert from "node:assert/strict"
import { deserializeEnvelope, serializeEnvelope, createEmptyEnvelope } from "../src/document-model.js"

test("v0.49: deserializeEnvelope wraps legacy PM-only JSON", () => {
  const legacy = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] }
  const env = deserializeEnvelope(JSON.stringify(legacy))
  assert.equal(env.version, "0.1")
  assert.equal(env.pm.type, "doc")
  assert.equal(env.meta.title.ru, "")
  assert.equal(Array.isArray(env.references), true)
})

test("v0.49: serializeEnvelope round-trip", () => {
  const e = createEmptyEnvelope()
  e.pm = { type: "doc", content: [] }
  e.meta.title.ru = "T"
  e.references = [{ id: "ref-1", raw: "a", parsed: null }]
  const e2 = deserializeEnvelope(serializeEnvelope(e))
  assert.equal(e2.meta.title.ru, "T")
  assert.equal(e2.references.length, 1)
})
