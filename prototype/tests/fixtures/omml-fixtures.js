const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
const M_NS = "http://schemas.openxmlformats.org/officeDocument/2006/math"

function wrapDocument(bodyInner) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="${W_NS}" xmlns:m="${M_NS}">
  <w:body>
    ${bodyInner}
  </w:body>
</w:document>`
}

function simpleEquationOmml(left, right) {
  return `<m:oMath>
    <m:r><m:t>${left}</m:t></m:r>
    <m:r><m:t>=</m:t></m:r>
    <m:r><m:t>${right}</m:t></m:r>
  </m:oMath>`
}

export const multilineTableDocumentXml = wrapDocument(`
  <w:tbl>
    <w:tr>
      <w:tc>
        <w:p>
          ${simpleEquationOmml("a", "b")}
          <w:r><w:t>,</w:t></w:r>
        </w:p>
        <w:p>
          ${simpleEquationOmml("c", "d")}
          <w:r><w:t>,</w:t></w:r>
        </w:p>
      </w:tc>
      <w:tc>
        <w:p><w:r><w:t>(25)</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  </w:tbl>
`)

export const multiRowTableDocumentXml = wrapDocument(`
  <w:tbl>
    <w:tr>
      <w:tc>
        <w:p>${simpleEquationOmml("k_p", "0")}</w:p>
      </w:tc>
      <w:tc>
        <w:p><w:r><w:t>(31)</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
    <w:tr>
      <w:tc>
        <w:p>${simpleEquationOmml("k_e", "0")}</w:p>
      </w:tc>
      <w:tc>
        <w:p><w:r><w:t>(32)</w:t></w:r></w:p>
      </w:tc>
    </w:tr>
  </w:tbl>
`)

export const integralOmml = `<?xml version="1.0" encoding="UTF-8"?>
<m:oMath xmlns:m="${M_NS}">
  <m:nary>
    <m:naryPr>
      <m:chr m:val="∫"/>
    </m:naryPr>
    <m:sub>
      <m:sSub>
        <m:e><m:r><m:t>t</m:t></m:r></m:e>
        <m:sub><m:r><m:t>0</m:t></m:r></m:sub>
      </m:sSub>
    </m:sub>
    <m:sup>
      <m:sSub>
        <m:e><m:r><m:t>t</m:t></m:r></m:e>
        <m:sub><m:r><m:t>f</m:t></m:r></m:sub>
      </m:sSub>
    </m:sup>
    <m:e>
      <m:d>
        <m:dPr>
          <m:begChr m:val="["/>
          <m:endChr m:val="]"/>
        </m:dPr>
        <m:e>
          <m:r><m:t>x</m:t></m:r>
          <m:r><m:t>+</m:t></m:r>
          <m:r><m:t>u</m:t></m:r>
        </m:e>
      </m:d>
      <m:r><m:t>d</m:t></m:r>
      <m:r><m:t>t</m:t></m:r>
    </m:e>
  </m:nary>
</m:oMath>`

export const limOmml = `<?xml version="1.0" encoding="UTF-8"?>
<m:oMath xmlns:m="${M_NS}">
  <m:func>
    <m:fName>
      <m:limLow>
        <m:e><m:r><m:t>lim</m:t></m:r></m:e>
        <m:lim>
          <m:r><m:t>x</m:t></m:r>
          <m:r><m:t>→</m:t></m:r>
          <m:r><m:t>∞</m:t></m:r>
        </m:lim>
      </m:limLow>
    </m:fName>
    <m:e>
      <m:r><m:t>f</m:t></m:r>
      <m:d><m:e><m:r><m:t>x</m:t></m:r></m:e></m:d>
    </m:e>
  </m:func>
</m:oMath>`
