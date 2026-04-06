# DocumentJSON v1 — Спецификация модели данных

> Версия: 1.0-draft
> Дата: 2026-04-05
> Статус: проектирование (обсуждение CEO)
> Контекст: WYSIWYG Editorum — Project Hub

---

## 1. Назначение

DocumentJSON — единая модель данных для всех типов научных публикаций в экосистеме Editorum. Является единым источником для:

- Отображения и редактирования в WYSIWYG-редакторе
- Экспорта в JATS XML, HTML5+MathJax, PDF
- Хранения в MongoDB
- Обмена с внешними системами (Crossref, РИНЦ, DOAJ)

## 2. Принципы

1. **Структура важнее оформления.** Контент хранится семантически. Оформление определяется шаблоном журнала/издания.
2. **Абзац — атом системы.** Минимальная единица макета и объект авторского права.
3. **Наследование прав.** Document → Block → Paragraph. Каждый уровень может переопределить правовой пакет.
4. **Мультиязычность.** Произвольные BCP-47 ключи для метаданных и контента. Основная пара RU/EN.
5. **Опциональность полей.** Профиль журнала определяет, какие поля обязательны, опциональны или скрыты.
6. **Совместимость.** Lossless маппинг в JATS XML. Импорт из ArticleJSON v3.

---

## 3. Структура верхнего уровня

```json
{
  "schema_version": "1.0",

  "envelope": { ... },
  "metadata": { ... },
  "contributors": [ ... ],
  "affiliations": [ ... ],
  "funding": [ ... ],
  "rights": { ... },
  "content": { ... },
  "back_matter": { ... },
  "assets": { ... },
  "provenance": { ... }
}
```

---

## 4. Envelope — идентификация документа

Описывает сам документ как объект в системе. Не меняется при редактировании контента.

```json
"envelope": {
  "doc_id": "doc_2026_001",
  "doc_kind": "article_journal",
  "doc_profile": "article_journal",
  "primary_language": "ru",
  "languages": ["ru", "en"],
  "created_at": "2026-04-05T10:00:00Z",
  "updated_at": "2026-04-05T12:30:00Z"
}
```

### Поля

| Поле | Тип | Описание |
|------|-----|----------|
| `doc_id` | string | Уникальный ID документа в системе |
| `doc_kind` | enum | Тип произведения (см. 4.1) |
| `doc_profile` | string | Профиль, определяющий обязательные поля и допустимую структуру |
| `primary_language` | string | BCP-47 код основного языка |
| `languages` | string[] | Все языки, на которых доступен контент |
| `created_at` | ISO 8601 | Дата создания документа в системе |
| `updated_at` | ISO 8601 | Дата последнего изменения |

### 4.1. doc_kind — типы произведений

Все публикации собираются из одних и тех же строительных блоков (абзацев). `doc_kind` определяет контекст использования:

**Журнальные:**
- `article_journal` — статья в журнале
- `article_editorial` — редакционная статья
- `article_review` — обзорная статья
- `article_brief` — краткое сообщение
- `article_book_review` — рецензия на книгу

**Конференции:**
- `article_conference` — статья конференции

**Книги:**
- `book_monograph` — монография
- `book_chapter` — глава книги
- `book_textbook` — учебник/учебное пособие
- `book_collected` — сборник

**Другие:**
- `dissertation_abstract` — автореферат диссертации
- `report` — отчёт
- `preprint` — препринт

---

## 5. Metadata — сведения о публикации

Всё, что описывает публикацию, кроме текста и авторов.

```json
"metadata": {
  "titles": {
    "ru": "Исследование применения метода...",
    "en": "A Study of Method Application..."
  },

  "abstracts": {
    "ru": "В статье рассматривается...",
    "en": "This article examines..."
  },

  "keywords": {
    "ru": ["метод", "исследование", "модель"],
    "en": ["method", "study", "model"]
  },

  "identifiers": {
    "doi": "10.12345/example.2026.001",
    "edn": "ABCDEF",
    "issn_print": "1234-5678",
    "issn_online": "9876-5432",
    "local_id": "art_001"
  },

  "dates": {
    "received": "2026-01-15",
    "accepted": "2026-03-20",
    "published_online": "2026-04-01",
    "published_print": null
  },

  "article_type": "RAR",

  "subject_codes": {
    "udk": ["519.6"],
    "vak": ["1.2.2"]
  },

  "issue_context": {
    "journal_title": "Вестник науки",
    "journal_title_en": "Science Bulletin",
    "journal_id": "journal_042",
    "year": "2026",
    "volume": "15",
    "issue": "2",
    "page_range": { "from": 45, "to": 62 },
    "publisher": "Издательство Академус"
  }
}
```

### 5.1. Мультиязычность

`titles`, `abstracts`, `keywords` — объекты с BCP-47 ключами. Система поддерживает до 4 языков параллельно. Перевод на дополнительные языки — через AI-сервис на лету.

### 5.2. article_type — коды eLIB

| Код | Тип |
|-----|-----|
| `RAR` | Оригинальная статья |
| `REV` | Обзор |
| `SCO` | Краткое сообщение |
| `EDI` | Редакционная |
| `BRW` | Рецензия |
| `CNF` | Конференция |

### 5.3. issue_context

Контекст номера/издания, в котором опубликован документ. Заполняется из бэкенда Editorum при привязке статьи к номеру. Для книг — аналогичная структура с `book_title`, `isbn`, `chapter_number`.

---

## 6. Contributors — участники

Каждый участник описывается полностью. Поле `editorum_person_id` связывает с БД Editorum (может быть null для ручного ввода).

```json
"contributors": [
  {
    "id": "contrib_1",
    "editorum_person_id": "person_12345",

    "name": {
      "ru": { "full": "Иванов Иван Иванович", "given": "Иван", "middle": "Иванович", "family": "Иванов", "initials": "И. И." },
      "en": { "full": "Ivan I. Ivanov", "given": "Ivan", "middle": "I.", "family": "Ivanov", "initials": "I. I." }
    },

    "display_name": {
      "ru": "Иванов И. И.",
      "en": "Ivanov I. I."
    },
    "pseudonym": null,
    "anonymous": false,

    "orcid": "0000-0001-2345-6789",
    "spin": "1234-5678",
    "email": "ivanov@university.ru",

    "affiliation_ids": ["aff_1"],

    "contributor_type": "author",
    "is_author": true,
    "is_corresponding": true,
    "is_right_holder": false,
    "rights_ref": "rp_main",

    "credit_roles": [
      { "role": "conceptualization", "degree": "lead" },
      { "role": "writing_original_draft", "degree": "lead" },
      { "role": "methodology", "degree": "supporting" }
    ],

    "order": 1
  }
]
```

### 6.1. Поля участника

| Поле | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `id` | string | Да | Уникальный ID в рамках документа |
| `editorum_person_id` | string? | Нет | Связь с записью в БД Editorum (null = ручной ввод) |
| `name` | MultiLangName | Да | Структурированное имя по языкам |
| `display_name` | MultiLangString | Да | Имя для отображения (генерируется автоматически) |
| `pseudonym` | string? | Нет | Псевдоним (ст. 1265 ГК РФ) |
| `anonymous` | boolean | Нет | Анонимная публикация |
| `orcid` | string? | Опц. | ORCID автора |
| `spin` | string? | Опц. | SPIN (eLIBRARY) |
| `email` | string? | Опц. | Email (обязательно для JATS GATE) |
| `affiliation_ids` | string[] | Да | Ссылки на записи в `affiliations[]` |
| `contributor_type` | enum | Да | author, editor, translator, reviewer, compiler, funder |
| `is_author` | boolean | Да | Юридический автор (творческий вклад по ГК РФ) |
| `is_corresponding` | boolean | Нет | Автор-корреспондент |
| `is_right_holder` | boolean | Да | Является ли правообладателем |
| `rights_ref` | string? | Нет | Ссылка на правовой пакет (если отличается от default) |
| `credit_roles` | CreditRole[] | Опц. | Роли CRediT (если журнал требует) |
| `order` | integer | Да | Порядок в списке авторов |

### 6.2. contributor_type

| Тип | Описание |
|-----|----------|
| `author` | Автор (творческий вклад) |
| `editor` | Редактор (научный, ответственный) |
| `translator` | Переводчик |
| `reviewer` | Рецензент |
| `compiler` | Составитель (для сборников) |
| `funder` | Финансирующая организация |

### 6.3. CRediT-роли (опционально, NISO Z39.104-2022)

14 ролей: `conceptualization`, `data_curation`, `formal_analysis`, `funding_acquisition`, `investigation`, `methodology`, `project_administration`, `resources`, `software`, `supervision`, `validation`, `visualization`, `writing_original_draft`, `writing_review_editing`.

Степень вклада (`degree`): `lead` | `equal` | `supporting`.

Включение CRediT определяется профилем журнала: `journal_settings.credit_required`.

---

## 7. Affiliations — аффилиации

Нормализованный список организаций, на которые ссылаются участники.

```json
"affiliations": [
  {
    "id": "aff_1",
    "org_name": {
      "ru": "Московский государственный университет",
      "en": "Moscow State University"
    },
    "department": {
      "ru": "Факультет вычислительной математики и кибернетики",
      "en": "Faculty of Computational Mathematics and Cybernetics"
    },
    "city": "Moscow",
    "country": "Russia",
    "country_code": "RU",
    "ror_id": "https://ror.org/010pmpe69",
    "isni": null
  }
]
```

---

## 8. Funding — финансирование

```json
"funding": [
  {
    "funder_name": "Российский научный фонд",
    "funder_name_en": "Russian Science Foundation",
    "funder_id": "https://doi.org/10.13039/501100006769",
    "funder_id_type": "crossref_funder",
    "award_ids": ["22-11-00042"],
    "country": "RU"
  }
]
```

Источник данных: Crossref Funder Registry API. Маппинг в JATS: `<funding-group>/<award-group>`.

---

## 9. Rights — модель прав

### 9.1. Структура

```json
"rights": {
  "default_rights_ref": "rp_main",

  "rights_packages": {
    "rp_main": {
      "moral_rights": {
        "authors": ["contrib_1", "contrib_2"],
        "coauthorship_type": "joint",
        "attribution_format": {
          "ru": "Иванов И. И., Петров П. П.",
          "en": "Ivanov I. I., Petrov P. P."
        },
        "integrity_consents": []
      },

      "economic_rights": {
        "disposition": "open_license",

        "right_holder": {
          "type": "person",
          "ref": "contrib_1"
        },

        "license": {
          "spdx_id": "CC-BY-4.0",
          "uri": "https://creativecommons.org/licenses/by/4.0/",
          "version": "4.0"
        },

        "granted_rights": [
          "reproduction", "distribution",
          "making_available", "adaptation"
        ],
        "territory": "worldwide",
        "term": { "from": "2026-04-01", "to": null },
        "sublicensable": false,

        "embargo": null,

        "contract_ref": "editorum://agreements/2026-001"
      },

      "permissions_metadata": {
        "copyright_statement": "© 2026 Иванов И. И., Петров П. П.",
        "copyright_year": 2026,
        "copyright_holder": "Иванов И. И., Петров П. П.",
        "ali_free_to_read": {
          "value": true,
          "start_date": "2026-04-01",
          "end_date": null
        },
        "ali_license_ref": [
          {
            "uri": "https://creativecommons.org/licenses/by/4.0/",
            "start_date": "2026-04-01",
            "content_version": "vor"
          }
        ]
      },

      "jurisdiction": {
        "governing_law": "RU",
        "treaties": ["berne", "wct"],
        "exclusive_right_term": "life_plus_70"
      }
    }
  }
}
```

### 9.2. disposition — типы распоряжения

| Тип | Описание | Статья ГК РФ |
|-----|----------|-------------|
| `open_license` | Открытая лицензия (CC и аналоги) | Ст. 1286.1 |
| `exclusive_license` | Исключительная лицензия издателю | Ст. 1286 |
| `non_exclusive_license` | Неисключительная лицензия | Ст. 1286 |
| `assignment` | Полное отчуждение исключительного права | Ст. 1285 |
| `work_for_hire` | Служебное произведение | Ст. 1295 |
| `publishing_license` | Издательский лицензионный договор | Ст. 1287 |
| `quotation_right` | Право цитирования (для заимствованных блоков) | Ст. 1274 |

### 9.3. Наследование прав

```
Документ → default_rights_ref: "rp_main"
  └── Блок (секция, рисунок) → rights_ref: "rp_main" (наследует) или свой
        └── Абзац → rights_ref: "rp_main" (наследует) или свой
```

Если блок или абзац не имеет собственного `rights_ref`, он наследует от родительского уровня. Переопределение возможно на любом уровне.

### 9.4. Эмбарго (отложенный доступ)

```json
"embargo": {
  "end_date": "2027-04-01",
  "pre_embargo_access": "subscription"
}
```

Моделируется через `embargo` + `ali_free_to_read.start_date`. До конца эмбарго контент доступен по подписке или другой модели.

### 9.5. Content-version licensing

Разные версии документа могут иметь разные лицензии:

```json
"ali_license_ref": [
  { "uri": "https://creativecommons.org/licenses/by/4.0/", "start_date": "2026-04-01", "content_version": "vor" },
  { "uri": "https://publisher.com/am-license", "start_date": "2027-04-01", "content_version": "am" }
]
```

### 9.6. CC-лицензии — поддерживаемые типы

| SPDX ID | Название | Attribution | Commercial | Derivatives | ShareAlike |
|---------|----------|-------------|------------|-------------|------------|
| CC-BY-4.0 | Attribution 4.0 | Да | Да | Да | Нет |
| CC-BY-SA-4.0 | Attribution-ShareAlike 4.0 | Да | Да | Да | Да |
| CC-BY-NC-4.0 | Attribution-NonCommercial 4.0 | Да | Нет | Да | Нет |
| CC-BY-NC-SA-4.0 | Attribution-NonCommercial-ShareAlike 4.0 | Да | Нет | Да | Да |
| CC-BY-ND-4.0 | Attribution-NoDerivatives 4.0 | Да | Да | Нет | Нет |
| CC-BY-NC-ND-4.0 | Attribution-NonCommercial-NoDerivatives 4.0 | Да | Нет | Нет | Нет |

---

## 10. Content — структурированный контент

### 10.1. Принципы

- Контент строится из **блоков**, группирующих **абзацы**
- Блок = минимальная смысловая единица редактора
- Абзац = минимальная техническая единица текста
- Каждый блок и абзац имеет уникальный `id`
- Каждый блок и абзац могут иметь `contributors` и `rights_ref`
- Автор видит цельный текст, блочная структура — внутренняя модель системы

### 10.2. Структура

```json
"content": {
  "body": [
    {
      "type": "section",
      "id": "sec_1",
      "attrs": { "level": 1 },
      "content": [
        {
          "type": "heading",
          "id": "h_1",
          "attrs": { "level": 1 },
          "content": [
            { "type": "text", "text": "Введение" }
          ]
        },
        {
          "type": "paragraph",
          "id": "p_1",
          "content": [
            { "type": "text", "text": "В данной работе рассматривается " },
            { "type": "text", "marks": [{ "type": "italic" }], "text": "новый подход" },
            { "type": "text", "text": " к решению задачи..." }
          ]
        },
        {
          "type": "paragraph",
          "id": "p_2",
          "content": [
            { "type": "text", "text": "Предыдущие исследования " },
            { "type": "text", "marks": [{ "type": "citation_ref", "attrs": { "ref_ids": ["R1", "R3"] } }], "text": "[1, 3]" },
            { "type": "text", "text": " показали, что..." }
          ]
        }
      ]
    },
    {
      "type": "section",
      "id": "sec_2",
      "content": [
        {
          "type": "heading",
          "id": "h_2",
          "attrs": { "level": 1 },
          "content": [{ "type": "text", "text": "Методология" }]
        },
        {
          "type": "paragraph",
          "id": "p_3",
          "content": [
            { "type": "text", "text": "Основная формула метода:" }
          ]
        },
        {
          "type": "formula",
          "id": "f_1",
          "attrs": {
            "latex": "E = mc^2",
            "display": "block",
            "label": "(1)"
          }
        },
        {
          "type": "figure",
          "id": "fig_1",
          "attrs": {
            "asset_ref": "asset_img_001",
            "label": "Рис. 1"
          },
          "content": [
            {
              "type": "caption",
              "id": "cap_1",
              "content": [
                { "type": "text", "text": "Схема экспериментальной установки" }
              ]
            }
          ]
        },
        {
          "type": "table",
          "id": "tbl_1",
          "attrs": { "label": "Таблица 1" },
          "content": [
            {
              "type": "caption",
              "id": "tcap_1",
              "content": [
                { "type": "text", "text": "Результаты экспериментов" }
              ]
            },
            {
              "type": "table_body",
              "content": [
                {
                  "type": "table_row",
                  "content": [
                    { "type": "table_header", "content": [{ "type": "text", "text": "Параметр" }] },
                    { "type": "table_header", "content": [{ "type": "text", "text": "Значение" }] }
                  ]
                },
                {
                  "type": "table_row",
                  "content": [
                    { "type": "table_cell", "content": [{ "type": "text", "text": "Температура" }] },
                    { "type": "table_cell", "content": [{ "type": "text", "text": "25°C" }] }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### 10.3. Типы блоков

| Тип | Описание | JATS-маппинг |
|-----|----------|-------------|
| `section` | Секция документа (уровень 1-4) | `<sec>` |
| `heading` | Заголовок секции | `<title>` внутри `<sec>` |
| `paragraph` | Абзац текста | `<p>` |
| `figure` | Рисунок с подписью | `<fig>` |
| `table` | Таблица с подписью | `<table-wrap>` |
| `formula` | Формула (LaTeX → MathJax/MathML) | `<disp-formula>` |
| `blockquote` | Цитата | `<disp-quote>` |
| `code_block` | Блок кода | `<code>` |
| `list` | Нумерованный/маркированный список | `<list>` |

### 10.4. Inline marks (форматирование текста)

| Mark | Описание | JATS |
|------|----------|------|
| `bold` | Жирный | `<bold>` |
| `italic` | Курсив | `<italic>` |
| `superscript` | Надстрочный | `<sup>` |
| `subscript` | Подстрочный | `<sub>` |
| `code` | Инлайн-код | `<monospace>` |
| `link` | Гиперссылка (attrs: href, title) | `<ext-link>` |
| `citation_ref` | Ссылка на библиографию (attrs: ref_ids[]) | `<xref ref-type="bibr">` |
| `figure_ref` | Ссылка на рисунок (attrs: fig_id) | `<xref ref-type="fig">` |
| `table_ref` | Ссылка на таблицу (attrs: table_id) | `<xref ref-type="table">` |
| `formula_ref` | Ссылка на формулу (attrs: formula_id) | `<xref ref-type="disp-formula">` |
| `footnote_ref` | Ссылка на сноску (attrs: note_id) | `<xref ref-type="fn">` |
| `math_inline` | Инлайн-формула (attrs: latex) | `<inline-formula>` |

### 10.5. Права на уровне блока/абзаца

Любой блок или абзац может содержать опциональные поля:

```json
{
  "type": "paragraph",
  "id": "p_42",
  "rights_ref": "rp_external_quote",
  "contributors": ["contrib_external_1"],
  "content": [...]
}
```

Если `rights_ref` не указан — наследуется от родительского блока/секции, далее от документа.

---

## 11. Back Matter — задняя часть документа

### 11.1. Библиографические ссылки

```json
"back_matter": {
  "references": [
    {
      "id": "R1",
      "position": 1,
      "raw": "Иванов И. И. Название статьи // Журнал. 2020. Т. 10. № 2. С. 15-25. doi:10.1234/abc",
      "structured": {
        "authors": "Иванов И. И.",
        "title": "Название статьи",
        "journal": "Журнал",
        "year": "2020",
        "volume": "10",
        "issue": "2",
        "pages": "15-25"
      },
      "identifiers": {
        "doi": "10.1234/abc",
        "edn": null,
        "pmid": null,
        "url": "https://doi.org/10.1234/abc"
      }
    }
  ],

  "footnotes": [
    {
      "id": "fn_1",
      "content": [
        { "type": "text", "text": "Работа выполнена при поддержке гранта РНФ." }
      ]
    }
  ],

  "acknowledgments": {
    "content": [
      { "type": "text", "text": "Авторы благодарят коллег за помощь в проведении экспериментов." }
    ]
  },

  "appendices": []
}
```

---

## 12. Assets — медиа и ассеты

Изображения и файлы хранятся отдельно от контента. Блоки ссылаются на ассеты по `asset_ref`.

```json
"assets": {
  "items": [
    {
      "id": "asset_img_001",
      "type": "image",
      "filename": "fig1_experiment_setup.png",
      "mime_type": "image/png",
      "storage_ref": "editorum://files/2026/doc_001/fig1.png",
      "alt_text": "Схема экспериментальной установки",
      "width": 1200,
      "height": 800,
      "external_doi": null
    },
    {
      "id": "asset_data_001",
      "type": "supplementary",
      "filename": "dataset.csv",
      "mime_type": "text/csv",
      "storage_ref": "editorum://files/2026/doc_001/dataset.csv",
      "external_doi": "10.5281/zenodo.1234567",
      "description": "Набор экспериментальных данных"
    }
  ]
}
```

### 12.1. Правила для изображений

- Картинки аттачатся отдельно (не inline base64) — для сохранения качества
- Внешние ассеты с DOI (DataCite и др.) указываются с `external_doi`
- WYSIWYG показывает preview, оригинал хранится в файловом хранилище

---

## 13. Provenance — происхождение документа

Информация об источнике данных. Не редактируется в WYSIWYG — заполняется автоматически.

```json
"provenance": {
  "source": "wysiwyg",
  "source_version": null,
  "imported_from": null,
  "import_date": null,
  "conversion_artifacts": null
}
```

Для документов из PDF-XML конвертера:

```json
"provenance": {
  "source": "pdf_xml_converter",
  "source_version": "3.0",
  "imported_from": "articlejson_v3",
  "import_date": "2026-04-01T10:00:00Z",
  "conversion_artifacts": {
    "aj33": { ... },
    "aj34": { ... }
  }
}
```

---

## 14. PDF-макеты

Три базовых макета с фиксированными наборами стилей абзацев:

| ID | Формат | Колонки | Применение |
|----|--------|---------|-----------|
| `layout_a4_single` | A4 | 1 | Универсальный |
| `layout_a4_double` | A4 | 2 | Научные журналы |
| `layout_a5_single` | A5 | 1 | Книги |

Макет выбирается на уровне журнала/издания и применяется ко всем публикациям. DocumentJSON не содержит информации об оформлении — только о структуре. Стили абзацев (шрифт, кегль, отступы, интерлиньяж) определяются макетом.

---

## 15. Совместимость

### 15.1. Импорт из ArticleJSON v3

| ArticleJSON v3 | DocumentJSON v1 |
|----------------|-----------------|
| `doc_kind`, `primary_language` | `envelope.*` |
| `metadata.titles/annotations/keywords` | `metadata.titles/abstracts/keywords` |
| `identifiers` | `metadata.identifiers` |
| `authors[]` | `contributors[]` (с маппингом полей) |
| `affiliations[]` | `affiliations[]` |
| `body.sections[].blocks[]` | `content.body[]` |
| `references[]` | `back_matter.references[]` |
| `aj.*` | `provenance.conversion_artifacts` |

### 15.2. Экспорт в JATS XML

| DocumentJSON v1 | JATS 1.2 |
|-----------------|----------|
| `envelope.doc_kind` | `<article @article-type>` |
| `metadata.titles` | `<title-group>` |
| `metadata.abstracts` | `<abstract>` |
| `metadata.keywords` | `<kwd-group>` |
| `contributors[]` | `<contrib-group>/<contrib>` |
| `contributors[].credit_roles` | `<role @vocab="CRediT">` |
| `affiliations[]` | `<aff>` с `<institution-id @institution-id-type="ror">` |
| `funding[]` | `<funding-group>/<award-group>` |
| `rights.permissions_metadata` | `<permissions>` с `<ali:*>` |
| `content.body[]` | `<body>/<sec>` |
| `back_matter.references[]` | `<back>/<ref-list>` |

### 15.3. Экспорт в HTML5

DocumentJSON → HTML5 + MathJax. Оформление определяется CSS-темой журнала (дизайн-система Editorum: editorum-tokens.css + editorum-publication.css).

### 15.4. Экспорт в PDF

DocumentJSON → PDF через макет (layout). Набор стилей абзацев фиксированный, определяется макетом. Формулы рендерятся через MathJax → SVG.

---

## 16. Профиль журнала (Journal Settings)

Профиль журнала управляет поведением WYSIWYG:

```json
"journal_settings": {
  "default_license": "CC-BY-4.0",
  "copyright_holder_type": "author",
  "credit_required": false,
  "orcid_required": false,
  "spin_required": false,
  "structured_affiliations_required": true,
  "email_required": true,
  "funding_required": false,
  "pdf_layout": "layout_a4_single",
  "languages": ["ru", "en"],
  "max_languages": 2
}
```

Профиль определяет: какие поля видны, какие обязательны, какой макет PDF по умолчанию, какая лицензия по умолчанию.

---

## 17. Extensibility Points

Следующие аспекты будут детализированы в будущих версиях спецификации:

- **Inline-комментарии** — механика рецензирования и аннотаций (уточнить с Тепикиной)
- **Перекрёстные ссылки** — автонумерация рисунков, таблиц, формул (уточнить с Тепикиной)
- **Track changes** — версионирование правок в контенте (уточнить с Тепикиной)
- **Составные произведения** — модель книги как контейнера глав-документов
- **Производные произведения** — переводы, адаптации (связь original ↔ derivative)
- **Коммерческий доступ** — подписки, pay-per-view, лицензионные вознаграждения

---

## 18. JATS Quality Score

WYSIWYG — ключевой инструмент повышения JATS Quality Score:

| Уровень | Требования | Роль WYSIWYG |
|---------|-----------|-------------|
| BRONZE | Базовый JATS, минимальные метаданные | Автоматически при создании |
| SILVER | Все GATE-поля, ORCID >= 50%, email >= 50%, структурированные аффилиации | Подсказки, обогащение |
| GOLD | ORCID >= 80%, CRediT, funding, полные reference DOI | Валидация, автоподсказки |
| PLATINUM | 100% полнота, linked data, full-text JATS | Финальная доводка редакцией |

---

*Конец спецификации DocumentJSON v1 (draft)*
