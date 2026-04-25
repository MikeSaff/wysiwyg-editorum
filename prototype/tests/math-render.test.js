import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { parseHTML } from "linkedom"
import { MATH_FONT_PRESETS } from "../src/math-config.js"
import { resolveTexSource, ensureMathJax, renderMathLive } from "../src/math-render.js"

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

test("v0.45c: index.html loads MathJax 4 from jsDelivr + math-jax-boot", async () => {
  const indexPath = fileURLToPath(new URL("../index.html", import.meta.url))
  const html = await fs.readFile(indexPath, "utf8")
  assert.match(html, /mathjax@4\/tex-mml-chtml\.js/)
  assert.match(html, /math-jax-boot\.js/)
  assert.match(html, /tex-mml-chtml\.js/)
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

test("v0.49.1: CHTML fontURL presets point at @mathjax font packages (woff2)", () => {
  assert.match(
    MATH_FONT_PRESETS.stix2.fontURL,
    /@mathjax\/mathjax-stix2-font@4\/chtml\/woff2\/?$/u
  )
  assert.match(
    MATH_FONT_PRESETS.newcm.fontURL,
    /@mathjax\/mathjax-newcm-font@4\/chtml\/woff2\/?$/u
  )
})

test("v0.49.1: renderMathLive typesets each math-block host after startup (smoke)", async () => {
  if (!globalThis.ResizeObserver) {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  }

  const { document } = parseHTML("<!DOCTYPE html><html><body></body></html>")
  const win = document.defaultView
  const typesetCalls = []

  const mj = {
    version: "4.0.0",
    startup: { promise: Promise.resolve() },
    typesetClear: async () => {},
    typesetPromise: async (nodes) => {
      typesetCalls.push(nodes)
      for (const h of nodes || []) {
        if (h?.appendChild) {
          const mjx = document.createElement("mjx-container")
          mjx.setAttribute("jax", "CHTML")
          h.appendChild(mjx)
        }
      }
    }
  }
  win.MathJax = mj
  globalThis.window = win

  const hosts = []
  try {
    for (let i = 0; i < 2; i++) {
      const div = document.createElement("div")
      div.className = "math-block"
      div.setAttribute("data-mathml", "<math><mi>x</mi></math>")
      div.setAttribute("data-latex", "")
      const host = document.createElement("div")
      host.className = "math-render-host"
      div.appendChild(host)
      document.body.appendChild(div)
      hosts.push(host)
      renderMathLive(host)
    }

    await new Promise((r) => setTimeout(r, 80))
    assert.equal(typesetCalls.length, 2, "typesetPromise once per host")
    for (const h of hosts) {
      assert.ok(
        h.querySelector("mjx-container[jax=\"CHTML\"]"),
        "mjx-container present after typeset"
      )
    }
  } finally {
    delete globalThis.window
    delete win.MathJax
  }
})
