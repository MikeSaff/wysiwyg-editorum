/**
 * Collapsible publication metadata editor (vanilla DOM).
 */
function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
}

function titlePreview(meta) {
  const t = (meta.title?.ru || meta.title?.en || "").trim()
  return t.slice(0, 72) + (t.length > 72 ? "…" : "") || "Метаданные публикации"
}

export function mountMetadataPanel(hostEl, api) {
  const root = document.createElement("div")
  root.className = "metadata-panel"
  root.innerHTML = `
    <div class="metadata-panel-bar">
      <button type="button" class="metadata-panel-toggle" aria-expanded="false" data-testid="metadata-panel-toggle"></button>
      <span class="metadata-panel-preview"></span>
    </div>
    <div class="metadata-panel-body" hidden>
      <div class="metadata-panel-inner">
        <div class="metadata-panel-header-row">
          <strong>Метаданные публикации</strong>
          <button type="button" class="metadata-panel-collapse">Свернуть</button>
        </div>
        <label>Заголовок (RU)<input type="text" class="md-inp" data-k="title.ru" data-testid="metadata-title-ru" /></label>
        <label>Заголовок (EN)<input type="text" class="md-inp" data-k="title.en" data-testid="metadata-title-en" /></label>
        <div class="md-authors-block">
          <div class="md-row"><span>Авторы</span><button type="button" class="md-add-author">+ Добавить автора</button></div>
          <div class="md-authors-list"></div>
        </div>
        <div class="md-affil-block">
          <div class="md-row"><span>Аффилиации</span><button type="button" class="md-add-affil">+ Добавить</button></div>
          <div class="md-affil-list"></div>
        </div>
        <label>Аннотация (RU)<textarea class="md-ta" data-k="abstract.ru" rows="4"></textarea></label>
        <label>Аннотация (EN)<textarea class="md-ta" data-k="abstract.en" rows="3"></textarea></label>
        <label>Ключевые слова (RU, через запятую)<input type="text" class="md-inp" data-kw="ru" /></label>
        <label>Ключевые слова (EN, через запятую)<input type="text" class="md-inp" data-kw="en" /></label>
        <div class="md-inline-row">
          <label>DOI<input type="text" class="md-inp-sm" data-k="doi" data-testid="metadata-doi" /></label>
          <label>УДК<input type="text" class="md-inp-sm" data-k="udk" data-testid="metadata-udk" /></label>
          <label>Дата публикации<input type="date" class="md-inp-sm" data-k="publicationDate" data-testid="metadata-publication-date" /></label>
        </div>
        <label>Финансирование<textarea class="md-ta" data-k="fundingInfo" rows="2" data-testid="metadata-funding"></textarea></label>
        <label>Информация об авторах<textarea class="md-ta" data-k="authorInfo" rows="2"></textarea></label>
        <label>Вклад авторов<textarea class="md-ta" data-k="authorContributions" rows="2"></textarea></label>
        <label>Благодарности<textarea class="md-ta" data-k="acknowledgments" rows="2"></textarea></label>
        <label>Конфликт интересов<textarea class="md-ta" data-k="conflictsOfInterest" rows="2"></textarea></label>
        <div class="md-refs-section">
          <button type="button" class="md-refs-toggle">Список литературы: <span class="md-refs-count">0</span> записей — показать</button>
          <div class="md-refs-list" hidden></div>
        </div>
      </div>
    </div>`
  hostEl.appendChild(root)

  const bar = root.querySelector(".metadata-panel-bar")
  const toggle = root.querySelector(".metadata-panel-toggle")
  const preview = root.querySelector(".metadata-panel-preview")
  const body = root.querySelector(".metadata-panel-body")
  const collapse = root.querySelector(".metadata-panel-collapse")
  const authorsList = root.querySelector(".md-authors-list")
  const affilList = root.querySelector(".md-affil-list")
  const refsToggle = root.querySelector(".md-refs-toggle")
  const refsCount = root.querySelector(".md-refs-count")
  const refsList = root.querySelector(".md-refs-list")

  function getM() {
    return api.getEnvelope().meta
  }

  function setM(patch) {
    Object.assign(api.getEnvelope().meta, patch)
    api.scheduleAutosave()
    preview.textContent = titlePreview(api.getEnvelope().meta)
  }

  function renderAuthors() {
    authorsList.innerHTML = ""
    const authors = getM().authors || []
    authors.forEach((a, idx) => {
      const row = document.createElement("div")
      row.className = "md-author-row"
      row.innerHTML = `
        <span class="md-author-idx">${idx + 1}.</span>
        <input type="text" data-a="${idx}" data-f="fullName" value="${esc(a.fullName)}" placeholder="ФИО" />
        <input type="text" data-a="${idx}" data-f="email" value="${esc(a.email)}" placeholder="email" />
        <input type="text" data-a="${idx}" data-f="orcid" value="${esc(a.orcid)}" placeholder="ORCID" />
        <button type="button" data-del-a="${idx}">×</button>`
      authorsList.appendChild(row)
    })
  }

  function renderAffils() {
    affilList.innerHTML = ""
    ;(getM().affiliations || []).forEach((af, idx) => {
      const row = document.createElement("div")
      row.className = "md-affil-row"
      row.innerHTML = `
        <span class="md-affil-idx">[${idx + 1}]</span>
        <input type="text" data-af="${idx}" value="${esc(af.text)}" />
        <button type="button" data-del-af="${idx}">×</button>`
      affilList.appendChild(row)
    })
  }

  function renderRefs() {
    const refs = api.getEnvelope().references || []
    refsCount.textContent = String(refs.length)
    refsList.innerHTML = ""
    refs.forEach((r, idx) => {
      const wrap = document.createElement("div")
      wrap.className = "md-ref-item"
      wrap.innerHTML = `
        <div class="md-ref-h">#${idx + 1} DOI <input type="text" class="md-ref-doi" data-r="${idx}" value="${esc(r.doi || "")}" /></div>
        <textarea class="md-ref-raw" data-r="${idx}" rows="2"></textarea>`
      refsList.appendChild(wrap)
      wrap.querySelector(".md-ref-raw").value = r.raw || ""
    })
  }

  function pullForm() {
    const m = getM()
    root.querySelectorAll(".md-inp[data-k], .md-inp-sm[data-k]").forEach((inp) => {
      const k = inp.getAttribute("data-k")
      if (k === "title.ru") inp.value = m.title?.ru || ""
      else if (k === "title.en") inp.value = m.title?.en || ""
      else if (k === "doi") inp.value = m.doi || ""
      else if (k === "udk") inp.value = m.udk || ""
      else if (k === "publicationDate") inp.value = m.publicationDate || ""
      else if (k === "fundingInfo") inp.value = m.fundingInfo || ""
      else if (k === "authorInfo") inp.value = m.authorInfo || ""
      else if (k === "authorContributions") inp.value = m.authorContributions || ""
      else if (k === "acknowledgments") inp.value = m.acknowledgments || ""
      else if (k === "conflictsOfInterest") inp.value = m.conflictsOfInterest || ""
    })
    root.querySelectorAll(".md-ta[data-k]").forEach((ta) => {
      const k = ta.getAttribute("data-k")
      if (k === "abstract.ru") ta.value = m.abstract?.ru || ""
      if (k === "abstract.en") ta.value = m.abstract?.en || ""
    })
    root.querySelector('.md-inp[data-kw="ru"]').value = (m.keywords?.ru || []).join(", ")
    root.querySelector('.md-inp[data-kw="en"]').value = (m.keywords?.en || []).join(", ")
    renderAuthors()
    renderAffils()
    renderRefs()
    preview.textContent = titlePreview(m)
    toggle.textContent = body.hidden ? "▸" : "▾"
  }

  function pushSimpleFields() {
    const m = getM()
    root.querySelectorAll(".md-inp[data-k], .md-inp-sm[data-k]").forEach((inp) => {
      const k = inp.getAttribute("data-k")
      if (k === "title.ru") m.title.ru = inp.value
      else if (k === "title.en") m.title.en = inp.value
      else if (k === "doi") m.doi = inp.value
      else if (k === "udk") m.udk = inp.value
      else if (k === "publicationDate") m.publicationDate = inp.value
      else if (k === "fundingInfo") m.fundingInfo = inp.value
      else if (k === "authorInfo") m.authorInfo = inp.value
      else if (k === "authorContributions") m.authorContributions = inp.value
      else if (k === "acknowledgments") m.acknowledgments = inp.value
      else if (k === "conflictsOfInterest") m.conflictsOfInterest = inp.value
    })
    root.querySelectorAll(".md-ta[data-k]").forEach((ta) => {
      const k = ta.getAttribute("data-k")
      if (k === "abstract.ru") m.abstract.ru = ta.value
      if (k === "abstract.en") m.abstract.en = ta.value
    })
    m.keywords.ru = root
      .querySelector('.md-inp[data-kw="ru"]')
      .value.split(/[,;]/u)
      .map((s) => s.trim())
      .filter(Boolean)
    m.keywords.en = root
      .querySelector('.md-inp[data-kw="en"]')
      .value.split(/[,;]/u)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  root.addEventListener("input", (e) => {
    const t = e.target
    if (t.matches(".md-inp[data-k], .md-inp-sm[data-k], .md-ta[data-k], .md-inp[data-kw]")) {
      pushSimpleFields()
      api.scheduleAutosave()
      preview.textContent = titlePreview(getM())
    }
    if (t.matches(".md-author-row input")) {
      const idx = +t.getAttribute("data-a")
      const f = t.getAttribute("data-f")
      if (getM().authors[idx]) {
        getM().authors[idx][f] = t.value
        api.scheduleAutosave()
      }
    }
    if (t.matches(".md-affil-row input")) {
      const idx = +t.getAttribute("data-af")
      if (getM().affiliations[idx]) {
        getM().affiliations[idx].text = t.value
        api.scheduleAutosave()
      }
    }
    if (t.matches(".md-ref-doi, .md-ref-raw")) {
      const idx = +t.getAttribute("data-r")
      const refs = api.getEnvelope().references
      if (refs[idx]) {
        if (t.classList.contains("md-ref-doi")) refs[idx].doi = t.value || undefined
        else refs[idx].raw = t.value
        api.scheduleAutosave()
      }
    }
  })

  root.addEventListener("click", (e) => {
    const t = e.target
    if (t.matches(".metadata-panel-toggle") || t.matches(".metadata-panel-collapse")) {
      body.hidden = !body.hidden
      toggle.setAttribute("aria-expanded", body.hidden ? "false" : "true")
      toggle.textContent = body.hidden ? "▸" : "▾"
    }
    if (t.matches(".md-add-author")) {
      pushSimpleFields()
      getM().authors.push({
        id: crypto.randomUUID?.() || `a-${Date.now()}`,
        fullName: "",
        initials: "",
        surname: "",
        affRefs: [],
        email: "",
        orcid: ""
      })
      renderAuthors()
      api.scheduleAutosave()
    }
    if (t.matches("[data-del-a]")) {
      pushSimpleFields()
      getM().authors.splice(+t.getAttribute("data-del-a"), 1)
      renderAuthors()
      api.scheduleAutosave()
    }
    if (t.matches(".md-add-affil")) {
      pushSimpleFields()
      const n = (getM().affiliations || []).length + 1
      getM().affiliations.push({ id: `aff-${n}`, text: "", city: "", country: "", ror: "" })
      renderAffils()
      api.scheduleAutosave()
    }
    if (t.matches("[data-del-af]")) {
      pushSimpleFields()
      getM().affiliations.splice(+t.getAttribute("data-del-af"), 1)
      renderAffils()
      api.scheduleAutosave()
    }
    if (t.matches(".md-refs-toggle")) {
      refsList.hidden = !refsList.hidden
      t.textContent = refsList.hidden
        ? `Список литературы: ${refsCount.textContent} записей — показать`
        : `Список литературы: ${refsCount.textContent} записей — скрыть`
    }
  })

  bar.addEventListener("click", (e) => {
    if (e.target === preview) {
      body.hidden = false
      toggle.setAttribute("aria-expanded", "true")
      toggle.textContent = "▾"
    }
  })

  pullForm()
  toggle.textContent = "▸"

  return { refresh: pullForm }
}
