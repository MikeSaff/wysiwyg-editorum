import test from "node:test"
import assert from "node:assert/strict"
import { findMatchesInPlainText, collectFindMatches } from "../src/find-replace.js"
import { schema } from "../src/schema.js"

test("findMatchesInPlainText: plain case-insensitive", () => {
  const m = findMatchesInPlainText("Hello hello", "hello", {
    caseSensitive: false,
    wholeWord: true,
    useRegex: false,
  })
  assert.equal(m.length, 2)
})

test("findMatchesInPlainText: whole word excludes partial", () => {
  const m = findMatchesInPlainText("there", "he", {
    caseSensitive: false,
    wholeWord: true,
    useRegex: false,
  })
  assert.equal(m.length, 0)
})

test("findMatchesInPlainText: regex", () => {
  const m = findMatchesInPlainText("a1 a2", "a\\d", {
    caseSensitive: true,
    wholeWord: false,
    useRegex: true,
  })
  assert.equal(m.length, 2)
})

test("collectFindMatches walks text nodes", () => {
  const doc = schema.node("doc", null, [
    schema.node("paragraph", null, [schema.text("foo bar foo")]),
  ])
  const matches = collectFindMatches(doc, "foo", {
    caseSensitive: true,
    wholeWord: true,
    useRegex: false,
  })
  assert.equal(matches.length, 2)
})
