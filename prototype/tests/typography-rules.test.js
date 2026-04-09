import test from "node:test"
import assert from "node:assert/strict"
import { nextRussianDoubleQuote } from "../src/typography-rules.js"

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
