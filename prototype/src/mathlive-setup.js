/**
 * Модальное редактирование формул (`<math-field>`). Шрифты MathLive подключаются в `main.js`.
 */
import "mathlive"

/**
 * @param {string} initialLatex
 * @param {boolean} displayMode
 * @returns {Promise<string | null>} new LaTeX or null if cancelled
 */
export function openMathEditModal(initialLatex, displayMode) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("math-edit-modal")
    const field = document.getElementById("math-edit-field")
    const latexOut = document.getElementById("math-edit-latex")
    const saveBtn = document.getElementById("math-edit-save")
    const cancelBtn = document.getElementById("math-edit-cancel")
    if (!overlay || !field || !latexOut || !saveBtn || !cancelBtn) {
      resolve(null)
      return
    }

    field.setAttribute("math-virtual-keyboard-policy", "manual")
    field.value = initialLatex || ""
    field.style.minHeight = displayMode ? "140px" : "52px"

    const syncLatex = () => {
      latexOut.textContent = field.value || ""
    }
    syncLatex()

    const onInput = () => syncLatex()
    field.addEventListener("input", onInput)

    const done = (value) => {
      field.removeEventListener("input", onInput)
      saveBtn.onclick = null
      cancelBtn.onclick = null
      overlay.onclick = null
      overlay.classList.remove("active")
      overlay.setAttribute("aria-hidden", "true")
      resolve(value)
    }

    saveBtn.onclick = () => done(field.value ?? "")
    cancelBtn.onclick = () => done(null)
    overlay.onclick = (e) => {
      if (e.target === overlay) done(null)
    }

    overlay.classList.add("active")
    overlay.setAttribute("aria-hidden", "false")
    queueMicrotask(() => field.focus())
  })
}
