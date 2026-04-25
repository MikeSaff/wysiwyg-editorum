import test from "node:test"
import assert from "node:assert/strict"
import { isAllowedImageUrl } from "../src/figure-placeholder.js"

test("v0.51: isAllowedImageUrl accepts http(s) and data:image", () => {
  assert.equal(isAllowedImageUrl("https://example.com/x.png"), true)
  assert.equal(isAllowedImageUrl("http://localhost/a.jpg"), true)
  assert.equal(isAllowedImageUrl("data:image/png;base64,abc"), true)
  assert.equal(isAllowedImageUrl("ftp://x"), false)
  assert.equal(isAllowedImageUrl(""), false)
  assert.equal(isAllowedImageUrl("  "), false)
})
