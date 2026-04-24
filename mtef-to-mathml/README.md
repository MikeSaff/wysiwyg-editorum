# mtef-to-mathml

Internal Editorum prototype library for parsing MathType Equation Native MTEF streams from Word OLE objects into MathML 3.0 and best-effort LaTeX.

The package lives inside the WYSIWYG repository for now, but it is structured as a standalone package so it can be extracted or published later.

## Install

From `C:\Projects\WYSIWYG\mtef-to-mathml`:

```bash
npm install
npm run build
```

Runtime dependency policy: only `cfb` is used at runtime for OLE Compound File extraction.

## API

```ts
import { parseMathType, parseMathTypeSync } from 'mtef-to-mathml';

const result = parseMathTypeSync(buffer);
// or
const asyncResult = await parseMathType(buffer);
```

Input can be:

- `oleObject*.bin` from `word/embeddings/` in a DOCX archive.
- Raw `Equation Native` stream.
- Raw MTEF stream, useful for tests.

Return shape:

```ts
interface ParseResult {
  mathml: string;
  latex: string;
  warnings: ParseWarning[];
}
```

## CLI

```bash
npx mtef-to-mathml input.bin -o output.xml
npx mtef-to-mathml input.bin --warnings
```

The v0.1 CLI accepts a single MathType OLE `.bin` input. DOCX batch processing is handled by the corpus runner, not by the public CLI.

## Warning taxonomy

- `unknown-char`: an MTEF character code was not mapped. MathML fallback is `<mtext>?</mtext>`. Warning includes `hex` and `position`.
- `unknown-record`: an unknown future record was skipped when length-delimited, or an unknown unsafe record was reported. Warning includes `hex` and `position`.
- `unknown-template`: a template selector is not implemented; known children are grouped.
- `latex-best-effort`: MathML could still be emitted, but LaTeX output used a fallback.
- `malformed-input`: invalid or truncated OLE/MTEF input.

LaTeX is contractually exact for the 10 Claude golden fixtures once they are added under `docs/mtef-test-fixtures/`. For the remaining corpus files, LaTeX is best-effort and warnings are expected.

## Corpus

```bash
npm run corpus -- --docx "C:\Projects\WYSIWYG\Docx\Nauka\Сложные журналы\Физика плазмы\1 25\Trukhachev\Trukhachev.docx" --update-context
```

The corpus runner parses all `word/embeddings/oleObject*.bin` entries in the DOCX using a small read-only ZIP reader implemented with Node built-ins. The v0.1 target is at least 88 out of 96 objects producing non-empty MathML without fatal errors.

## Development

```bash
npm test
npm run build
```

CI is scoped to `mtef-to-mathml/**` and runs tests plus build.
