# Syllabus packs

Board syllabi as versioned, installable seed data. Packs are **our** structured topic trees derived from official syllabi — we never redistribute board PDFs.

## Sample → official promotion

1. Open the named official PDF listed in `source_note`.
2. Replace every sample unit/topic label with verified content.
3. Set `status` to `official`. Keep the same `id` (do not bump).
4. Re-run the academics service tests.

## IB / Cambridge

IB and Cambridge programmes are **not distributable** here. Packs with `board: "ib"` or `"cambridge"` fail at boot. Those schools import their own units via Academics → course import.

## Annual process

Each academic year is a **new file** (new `id` / `academic_year`). Old pack files stay in the registry for schools still on prior sessions. Upgrade = install the newer pack onto a new academic session (no in-place mutation).
