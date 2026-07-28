# Stage 3.6 — AI/Markdown sanitisation implementation record

Status: **DRAFT — implementation present; full repository verification still required.**
Date: 2026-07-28.

## Approved scope

Replace the Ask surface's string-to-HTML Markdown path with a default-deny renderer for untrusted AI output. Permit only paragraphs, `##`/`###` headings rendered as `h4`, unordered lists, bold, italic and absolute HTTP(S) links. Raw HTML, images, code blocks, tables and all other Markdown remain plain text or unsupported.

## Implementation

- Added `src/ui/markdown.mjs` with a bounded, deterministic parser that produces a small explicit AST.
- Rendering uses the shared `el()` and `setChildren()` DOM primitives; AI/provider strings are never assigned to `innerHTML` by the active Ask renderer.
- Links require absolute `http:` or `https:` URLs. Protocol-relative, relative, `javascript:`, `data:`, `vbscript:`, `file:`, `mailto:`, entity-obscured, percent-encoded and control-character variants are rejected. Rejected links retain their visible label as inert text.
- Approved links open in a new tab with `rel="noopener noreferrer"`.
- Input is capped at 50,000 characters to keep parsing bounded.
- The module is loaded immediately after `src/ui/views.mjs` and replaces the legacy `renderThread` binding without changing the Ask transport, prompt or surrounding UI.

## Tests added

`tests/markdown-sanitisation.test.mjs` adds eight adversarial tests covering:

1. HTTP(S)-only link allow-list.
2. Encoded/entity/control-character scheme attacks.
3. Raw script/image/SVG and event-handler-shaped text.
4. Hostile Markdown links.
5. The exact permitted block subset.
6. Nested/unbalanced HTML.
7. Deterministic input bounding.
8. DOM-only renderer/source invariants.

Expected suite size after integration: **202 tests** (194 existing + 8 new).

## Deliberately unchanged

No projection, expected-minutes, scoring, calibration, fixture, captaincy, squad, transfer, provider, retry, key-handling, CSP or visual-design behaviour changed. No dependency was added.

## Verification status

The branch is based on `main` commit `1b0f025c0d23c02bf6605152ae66f3b4119c3f41`. GitHub Actions is not configured for this repository, and the execution environment used for this change could not clone GitHub, so `./run-tests.sh`, deterministic two-build comparison and generated `dist/` updates are **not yet evidenced**. The draft PR must remain unmerged until those checks are run and recorded.
