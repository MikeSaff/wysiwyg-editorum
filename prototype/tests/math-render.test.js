import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolveTexSource, ensureMathJax } from "../src/math-render.js"

test("v0.45: non-empty data-latex wins (MathML not used in resolveTexSource)", () => {
  const ml = "<math><mi>M</mi></math>"
  assert.equal(resolveTexSource("x^2", ml), "x^2")
})

test("v0.45: whitespace-only latex yields empty TeX fallback", () => {
  const ml = "<math><mi>y</mi></math>"
  assert.equal(resolveTexSource("   \n\t  ", ml), "")
})

test("v0.45: empty latex yields empty TeX fallback (no MathML→TeX here)", () => {
  const ml = "<math><mi>z</mi></math>"
  assert.equal(resolveTexSource("", ml), "")
})

test("v0.45c: index.html loads MathJax 4 from jsDelivr with linebreak + window.MathJax", async () => {
  const indexPath = fileURLToPath(new URL("../index.html", import.meta.url))
  const html = await fs.readFile(indexPath, "utf8")
  assert.match(html, /mathjax@4\/tex-mml-chtml\.js/)
  assert.match(html, /displayOverflow:\s*['"]linebreak['"]/)
  assert.match(html, /mtextInheritFont:\s*true/)
  assert.match(html, /merrorInheritFont:\s*true/)
  assert.match(html, /window\.MathJax/)
})

test("v0.45c: ensureMathJax resolves mock window.MathJax v4", async () => {
  globalThis.window = {
    MathJax: {
      version: "4.0.0",
      typesetPromise: async () => {},
      typesetClear: async () => {},
      startup: { promise: Promise.resolve() },
    },
  }
  try {
    const mj = await ensureMathJax()
    assert.ok(mj && mj.version.startsWith("4"))
  } finally {
    delete globalThis.window
  }
})
