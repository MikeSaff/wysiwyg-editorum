/**
 * Section heading normalization + IMRAD / back-matter detection (shared by word-import + metadata extract).
 */

export function normalizeSectionHeadingText(text) {
  return (text || "")
    .replace(/\u00A0/gu, " ")
    .replace(/^[\s\d.()]+/u, "")
    .replace(/[.:]+$/u, "")
    .replace(/\s+/gu, " ")
    .trim()
    .toLowerCase()
}

export function detectSectionType(text) {
  const normalized = normalizeSectionHeadingText(text)
  if (!normalized) return null
  if (/^результаты\s+и\s+обсуждени/iu.test(normalized)) return "results"
  if (/^(введение|introduction)$/iu.test(normalized)) return "introduction"
  if (/^(методы|материалы и методы|материалы и методика|methods|materials and methods)$/iu.test(normalized)) {
    return "methods"
  }
  if (/^(результаты|results)$/iu.test(normalized)) return "results"
  if (/^(обсуждение|discussion)$/iu.test(normalized)) return "discussion"
  if (/^(заключение|выводы|conclusion|conclusions)$/iu.test(normalized)) return "conclusion"
  if (/^(финансирование|funding)$/iu.test(normalized)) return "funding"
  if (/^(информация об авторах|author information)$/iu.test(normalized)) return "author_info"
  if (/^(вклад авторов|author contributions?)$/iu.test(normalized)) return "author_contributions"
  if (/^(благодарности|acknowledgements|acknowledgments)$/iu.test(normalized)) return "acknowledgments"
  if (/^(конфликт интересов|conflict of interest|conflicts of interest)$/iu.test(normalized)) return "conflicts"
  if (/^(список литературы|литература|references|bibliography)$/iu.test(normalized)) return "references"
  if (/^(приложение(?:\s+[a-zа-яё0-9]+)?|appendix(?:\s+[a-z0-9]+)?)$/iu.test(normalized)) return "appendix"
  if (/^(аннотация|abstract|реферат)$/iu.test(normalized)) return "abstract"
  if (/актуальност|relevance|significance/iu.test(normalized)) return "introduction"
  if (/краткое содержание|summary|overview|обзор/iu.test(normalized)) return "abstract"
  if (/основные результат|main results|key findings/iu.test(normalized)) return "results"
  if (/публикации|publications|список.*(работ|трудов)/iu.test(normalized)) return "references"
  if (/общая характеристика|general description|характеристика работы/iu.test(normalized)) return "introduction"
  if (/научная новизна|novelty|новизна/iu.test(normalized)) return "results"
  if (/практическая (ценность|значимость)|practical (value|significance)/iu.test(normalized)) return "results"
  if (/постановка задач|problem statement|задач[аи]\s/iu.test(normalized)) return "methods"
  if (/предмет исследования|subject|объект исследования/iu.test(normalized)) return "methods"
  if (/цел[ьи] исследования|objectives|aims/iu.test(normalized)) return "methods"
  return null
}
