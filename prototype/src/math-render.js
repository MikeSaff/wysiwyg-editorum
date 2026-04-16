/**
 * Статический рендер формул через MathJax v4 с CDN (`index.html`), без npm-бандла.
 * Редактирование — MathLive `<math-field>` в `mathlive-setup.js` (без изменений).
 */

/** @type {Promise<typeof window.MathJax> | null} */
let mathJaxReadyPromise = null

/**
 * Ждёт глобальный `window.MathJax` после загрузки `tex-mml-chtml.js` (async).
 * @returns {Promise<typeof window.MathJax>}
 */
function waitForGlobalMathJax() {
  return new Promise((resolve, reject) => {
    let n = 0
    const tick = () => {
      n++
      const MJ = window.MathJax
      if (MJ?.startup?.promise) {
        MJ.startup.promise.then(() => resolve(MJ)).catch(reject)
        return
      }
      if (n > 600) {
        reject(new Error("MathJax v4 CDN did not load"))
        return
      }
      setTimeout(tick, 25)
    }
    tick()
  })
}

/**
 * Готовность MathJax v4 с CDN: `window.MathJax.typesetPromise([host])`.
 */
export async function ensureMathJax() {
  if (typeof window === "undefined") return null
  const MJ = window.MathJax
  if (MJ?.typesetPromise && String(MJ.version || "").startsWith("4")) {
    if (MJ.startup?.promise) {
      try {
        await MJ.startup.promise
      } catch (e) {
        console.warn("[MathJax]", e)
      }
    }
    return MJ
  }
  if (!mathJaxReadyPromise) {
    mathJaxReadyPromise = waitForGlobalMathJax()
  }
  return mathJaxReadyPromise
}

/**
 * Fallback LaTeX для рендера, когда MathML отсутствует: только непустой `data-latex`.
 * @param {string} latexRaw
 * @param {string} _mathml зарезервировано (без MathML→TeX конверсии в этом модуле)
 * @returns {string}
 */
export function resolveTexSource(latexRaw, _mathml) {
  const hasNonEmptyLatex = latexRaw !== "" && /\S/.test(latexRaw)
  if (hasNonEmptyLatex) return latexRaw.trim()
  return ""
}

/** @param {HTMLElement} host */
function ensureMathHostResizeObserver(host) {
  if (host._mjResizeObserver) return
  const container = host.closest(".math-inline") || host.closest(".math-block")
  if (!container) return
  let timer = null
  host._mjResizeObserver = new ResizeObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      if (!host.isConnected || !window.MathJax?.typesetPromise) return
      window.MathJax.typesetPromise([host]).catch(() => {})
    }, 60)
  })
  host._mjResizeObserver.observe(container)
}

/**
 * @param {HTMLElement} host узел `.math-render-host`; `data-mathml` / `data-latex` на `.math-inline` | `.math-block`
 */
export function renderMathLive(host) {
  if (typeof window === "undefined" || !host?.closest) return

  const container = host.closest(".math-inline") || host.closest(".math-block")
  if (!container) return

  const mathmlRaw = container.getAttribute("data-mathml") || ""
  const mathml = mathmlRaw.trim()
  const latexRaw = container.getAttribute("data-latex") || ""
  const displayMode = container.classList.contains("math-block")

  const run = async () => {
    const MJ = await ensureMathJax()
    if (!MJ?.typesetPromise || !host.isConnected) return

    await MJ.typesetClear?.([host])

    if (mathml) {
      host.innerHTML = mathml
    } else {
      const tex = resolveTexSource(latexRaw, "")
      if (!tex) {
        host.innerHTML = ""
        return
      }
      host.textContent = ""
      host.appendChild(
        document.createTextNode(displayMode ? `\\[${tex}\\]` : `\\(${tex}\\)`)
      )
    }

    try {
      await MJ.typesetPromise([host])
    } catch (e) {
      console.warn("[MathJax] typeset", e)
    }
    ensureMathHostResizeObserver(host)
  }

  void run()
}
