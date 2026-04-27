import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  assertUsefulBaseline,
  isAllZeroFormulaQualityBaseline,
  resolveCorpusRoot,
} from "../scripts/corpus-root.mjs"

test("v0.56: resolveCorpusRoot finds default corpus without env", async () => {
  const resolved = await resolveCorpusRoot({})
  assert.match(resolved.root.replace(/\\/g, "/"), /Docx\/Nauka\/Сложные журналы$/u)
  assert.ok(resolved.files.length >= 90)
})

test("v0.56: resolveCorpusRoot aborts sparse explicit corpus", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wysiwyg-empty-corpus-"))
  await assert.rejects(
    () => resolveCorpusRoot({ CORPUS_DOCX_ROOT: dir }),
    /only 0 docx found/u
  )
})

test("v0.56: resolveCorpusRoot accepts explicit corpus with five docx", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wysiwyg-corpus-"))
  await mkdir(join(dir, "nested"))
  for (let i = 0; i < 5; i++) {
    await writeFile(join(i % 2 ? join(dir, "nested") : dir, `f${i}.docx`), "not really docx")
  }
  const resolved = await resolveCorpusRoot({ CORPUS_DOCX_ROOT: dir })
  assert.equal(resolved.files.length, 5)
})

test("v0.56: all-zero formula-quality baseline is rejected", () => {
  const baseline = {
    file_count: 94,
    totals: { formulas_total: 0, figure_count: 0, single_char_formula_count: 0 },
    results: [{ parse_error: null }],
  }
  assert.equal(isAllZeroFormulaQualityBaseline(baseline), true)
  assert.throws(() => assertUsefulBaseline(baseline, "test baseline"), /all zero/u)
})
