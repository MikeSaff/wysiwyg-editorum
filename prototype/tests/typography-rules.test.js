import test from "node:test"
import assert from "node:assert/strict"
import { EditorState } from "prosemirror-state"
import { schema } from "../src/schema.js"
import {
  nextRussianDoubleQuote,
  normalizeSpaceBeforePunctuation,
  normalizeEnDashToEmDash,
  normalizeHangingPrepositions,
  collapseDoubleSpaces,
  normalizeTypographyPlainText,
  createTypographyNormalizationTransaction,
} from "../src/typography-rules.js"

test("empty paragraph: first quote opens guillemet", () => {
  assert.equal(nextRussianDoubleQuote(""), "\u00AB")
})

test("inside outer quotes after text: close guillemet", () => {
  assert.equal(nextRussianDoubleQuote("\u00AB\u0442\u0435\u043a\u0441\u0442"), "\u00BB")
})

test("immediately after opening guillemet: nested open", () => {
  assert.equal(nextRussianDoubleQuote("\u00AB"), "\u201E")
})

test("after nested open: close with ASCII quote", () => {
  assert.equal(nextRussianDoubleQuote("\u00AB\u201E\u0432\u043d\u0443\u0442\u0440\u0438"), '"')
})

test("v0.44d: removes spaces before punctuation", () => {
  assert.equal(normalizeSpaceBeforePunctuation("hello , world"), "hello, world")
  assert.equal(normalizeSpaceBeforePunctuation("x  )"), "x)")
})

test("v0.44e: en dash to em except digit ranges", () => {
  assert.equal(normalizeEnDashToEmDash("5\u201310"), "5\u201310")
  assert.equal(normalizeEnDashToEmDash("5 \u2013 10"), "5 \u2013 10")
  assert.equal(normalizeEnDashToEmDash("слово\u2013слово"), "слово\u2014слово")
})

test("v0.44f: nbsp after Russian prepositions", () => {
  const s = normalizeHangingPrepositions("\u0432 \u043c\u043e\u0441\u043a\u0432\u0435")
  assert.ok(s.includes("\u0432\u00a0"))
})

test("v0.44: collapse double spaces", () => {
  assert.equal(collapseDoubleSpaces("a  b   c"), "a b c")
})

test("normalizeTypographyPlainText chains rules", () => {
  const out = normalizeTypographyPlainText("x  , \u0432 y")
  assert.ok(!out.includes("  "))
  assert.ok(out.includes("\u0432\u00a0") || out.includes("\u0432 "))
})

test("createTypographyNormalizationTransaction removes empty paragraph when sibling exists", () => {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("a")]),
    schema.node("paragraph", null, []),
    schema.node("paragraph", null, [schema.text("b")]),
  ])
  const state = EditorState.create({ doc })
  const tr = createTypographyNormalizationTransaction(state)
  const next = state.apply(tr)
  let paras = 0
  next.doc.forEach(n => {
    if (n.type.name === "paragraph") paras++
  })
  assert.equal(paras, 2)
  assert.equal(next.doc.textContent, "ab")
})
