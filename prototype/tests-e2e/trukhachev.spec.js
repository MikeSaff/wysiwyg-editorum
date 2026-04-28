import path from "node:path"
import { fileURLToPath } from "node:url"
import { test, expect } from "@playwright/test"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "../..")
const trukhachevDocx = path.join(
  repoRoot,
  "Docx",
  "Nauka",
  "Сложные журналы",
  "Физика плазмы",
  "1 25",
  "Trukhachev",
  "Trukhachev.docx"
)

async function importTrukhachev(page) {
  await page.goto("/")
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.setInputFiles("#file-input", trukhachevDocx)
  await expect(page.locator("#import-status")).toContainText("✅", { timeout: 120000 })
  await expect(page.locator(".ProseMirror .math-block")).toHaveCount(23, { timeout: 120000 })
  await expect(page.locator(".ProseMirror mjx-container").first()).toBeVisible({ timeout: 120000 })
}

async function openMetadataPanel(page) {
  const toggle = page.getByTestId("metadata-panel-toggle")
  await toggle.click()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
}

test("Trukhachev UI acceptance", async ({ page }) => {
  await importTrukhachev(page)

  const headings = page.locator(".ProseMirror h2")
  const typedHeadings = page.locator('.ProseMirror h2[data-section-type]:not([data-section-type=""])')
  await expect(headings).toHaveCount(4)
  await expect(typedHeadings).toHaveCount(4)
  await expect(page.locator('.ProseMirror h2[data-section-type="other"]')).toHaveCount(0)

  const groups = page.getByTestId("nav-group")
  await expect(groups).toHaveCount(4)
  await expect(page.getByTestId("nav-group-header")).toHaveText(["Разделы", "Рисунки", "Таблицы", "Формулы"])

  const navItems = page.getByTestId("nav-item")
  await expect(navItems).toHaveCount(30)
  await expect(page.getByTestId("nav-item").filter({ hasText: "Рисунок1" })).toHaveCount(0)
  await expect(page.getByTestId("nav-item").filter({ hasText: "демонстрирует классические свойства солитонов" })).toHaveCount(0)

  const navCount = await navItems.count()
  for (let i = 0; i < navCount; i += 1) {
    const item = navItems.nth(i)
    const href = await item.getAttribute("href")
    expect(href).toMatch(/^#.+/)
    const targetId = href.slice(1)
    await item.click()
    await page.waitForTimeout(150)
    const box = await page.evaluate((id) => {
      const el = document.getElementById(id)
      if (!el) return null
      const rect = el.getBoundingClientRect()
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: window.innerHeight,
      }
    }, targetId)
    expect(box).not.toBeNull()
    expect(box.bottom).toBeGreaterThan(0)
    expect(box.top).toBeLessThan(box.height)
  }

  const activeCount = await page.locator('#nav-items [data-testid="nav-item"].active').count()
  expect(activeCount).toBeGreaterThanOrEqual(1)

  const figureBlocks = page.locator(".ProseMirror figure.figure-block")
  await expect(figureBlocks).toHaveCount(4)
  const looseImages = page.locator(".ProseMirror > p > img.inline-image")
  await expect(looseImages).toHaveCount(0)
  await expect(page.locator(".ProseMirror p").filter({ hasText: "ПОДПИСИ К РИСУНКАМ" })).toHaveCount(0)
  await expect(page.locator(".ProseMirror p").filter({ hasText: /^Рис\.\s*4\.$/u })).toHaveCount(0)
  await expect(page.locator(".ProseMirror figcaption.figure-caption-ru")).toHaveText([
    /Рис\.\s*1/u,
    /Рис\.\s*2/u,
    /Рис\.\s*3/u,
    /Рис\.\s*4\..{50,}/u,
  ])
  await expect(page.getByTestId("nav-item").filter({ hasText: /Рис\.\s*4/u })).toHaveCount(1)

  const numberedMathBlocks = page.locator(".ProseMirror .math-block[data-label]")
  await expect(numberedMathBlocks).toHaveCount(22)
  const mathCount = await numberedMathBlocks.count()
  for (let i = 0; i < mathCount; i += 1) {
    const block = numberedMathBlocks.nth(i)
    const label = await block.getAttribute("data-label")
    const latex = (await block.getAttribute("data-latex")) || ""
    await expect(block.locator(".math-label")).toBeVisible()
    const text = await block.locator(".math-label").textContent()
    expect(text?.trim()).toBe(label)
    expect(latex).not.toMatch(/\\upsilon i_\{\d+\}/)
    expect(latex).not.toMatch(/\\[A-Za-z]+\s+[A-Za-z]_\{\d+\}/)
    expect(latex).not.toMatch(/[A-Za-z]\s+[A-Za-z]_\{\d+\}/)
  }

  for (const label of ["(19)", "(20)"]) {
    const latex = (await page.locator(`.ProseMirror .math-block[data-label="${label}"]`).getAttribute("data-latex")) || ""
    expect(latex).toContain("\\upsilon_{i}")
    expect(latex).toContain("\\upsilon_{i}^{2}")
    expect(latex).not.toContain("\\upsilon i")
    expect(latex).not.toContain("\\upsilon i_{2}")
  }

  await openMetadataPanel(page)
  await expect(page.getByTestId("metadata-title-ru")).not.toHaveValue("")
  await expect(page.getByTestId("metadata-udk")).toHaveValue("533.9")
  await expect(page.locator('.md-author-row input[data-f="email"]').first()).toHaveValue(/@/)
})
