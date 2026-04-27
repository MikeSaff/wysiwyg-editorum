import test from "node:test"
import assert from "node:assert/strict"
import { parseHTML } from "linkedom"
import { mountMetadataPanel } from "../src/metadata-panel.js"
import { createEmptyEnvelope } from "../src/document-model.js"

function withDom(fn) {
  const { window, document } = parseHTML("<!doctype html><html><body><div id=\"host\"></div></body></html>")
  const prevWindow = globalThis.window
  const prevDocument = globalThis.document
  globalThis.window = window
  globalThis.document = document
  try {
    return fn({ window, document, host: document.getElementById("host") })
  } finally {
    if (prevWindow) globalThis.window = prevWindow
    else delete globalThis.window
    if (prevDocument) globalThis.document = prevDocument
    else delete globalThis.document
  }
}

test("v0.59: metadata panel renders meta.udk into UDK input", () => withDom(({ document, host }) => {
  const envelope = createEmptyEnvelope()
  envelope.meta.udk = "533.9"
  envelope.meta.title.ru = "Тест"
  const api = {
    getEnvelope: () => envelope,
    scheduleAutosave: () => {},
  }
  mountMetadataPanel(host, api)
  const input = document.querySelector('[data-testid="metadata-udk"]')
  assert.ok(input)
  assert.equal(input.value, "533.9")
}))

test("v0.59: metadata panel updates meta.udk on input", () => withDom(({ window, document, host }) => {
  const envelope = createEmptyEnvelope()
  const api = {
    getEnvelope: () => envelope,
    scheduleAutosave: () => {},
  }
  mountMetadataPanel(host, api)
  const input = document.querySelector('[data-testid="metadata-udk"]')
  assert.ok(input)
  input.value = "511.4"
  input.dispatchEvent(new window.Event("input", { bubbles: true }))
  assert.equal(envelope.meta.udk, "511.4")
}))
