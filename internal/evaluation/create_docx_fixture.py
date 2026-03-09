from __future__ import annotations

import hashlib
import zipfile
from pathlib import Path


def build_docx(path: Path) -> None:
    content_types = """<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>
"""

    rels = """<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
"""

    document = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t>KORDA fixture DOCX datasheet for ingestion test.</w:t></w:r></w:p>
  </w:body>
</w:document>
"""

    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types)
        archive.writestr("_rels/.rels", rels)
        archive.writestr("word/document.xml", document)


def update_checksums(fixtures_dir: Path) -> None:
    rows: list[str] = []
    for file_path in sorted(fixtures_dir.iterdir()):
        if file_path.is_file() and file_path.name != "checksums.sha256":
            digest = hashlib.sha256(file_path.read_bytes()).hexdigest()
            rows.append(f"{digest}  {file_path.name}")
    (fixtures_dir / "checksums.sha256").write_text("\n".join(rows) + "\n", encoding="utf-8")


def main() -> None:
    fixtures_dir = Path(__file__).resolve().parent / "fixtures"
    fixtures_dir.mkdir(parents=True, exist_ok=True)
    build_docx(fixtures_dir / "fixture_datasheet.docx")
    update_checksums(fixtures_dir)


if __name__ == "__main__":
    main()
