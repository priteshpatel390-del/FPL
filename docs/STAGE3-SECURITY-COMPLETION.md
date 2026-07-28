# Stage 3 security completion — odds-key hygiene and hash-based CSP

Date: 2026-07-28  
Branch: `agent/stage3-security-completion`  
Draft PR: #6

## Approved scope delivered

- Odds API key field is password-masked at runtime.
- Empty odds keys are omitted from persisted configuration.
- **Forget API key** removes the stored property, clears the field and active odds data, marks the
  provider Disabled and returns projections to the internal model without another odds request.
- `scrubOddsSecret()` redacts raw/encoded current-key material and `apiKey=` query values from any
  future diagnostic string.
- Existing direct-only transport and query-free retry metadata remain unchanged.
- `build.mjs` emits a deterministic meta CSP with SHA-256 hashes for the exact single inline script
  and exact single inline style block.
- The build independently re-extracts the final HTML, recomputes both hashes and fails on mismatch.
- A browser-safe frame-buster sits inside the single hashed script.
- `style-src-attr 'unsafe-inline'` remains the sole documented CSP concession until Stage 9.

## Deliberately unchanged

No framework, dependency, npm-registry requirement, serverless infrastructure, hosting change,
provider formula, odds matching rule, retry policy, projection/scoring logic, captaincy, squad,
transfer optimiser or Stage 9 UI work was introduced.

## Verification

- Full suite: **210/210 passing**.
- Focused security-completion tests: 8/8 passing.
- Build: successful.
- Determinism: two builds using the same explicit `BUILD_COMMIT` compared byte-for-byte for
  `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json`.
- CSP: independent test recomputed the emitted script/style hashes from final HTML.
- Build identity: manifest and embedded `BUILD_INFO` module order agree and include both
  `src/ui/markdown.mjs` and `src/ui/security-wiring.mjs`.
- Secret scans: planted sentinel absent from generated HTML, bundle and manifest.
- Verified artefact SHA-256 values from the successful run:
  - `dist/index.html`: `4b9f12e2a2aeaebbc4bdef8af0d87c68d4a81389d860fbb177e6cb7677eac861`
  - `dist/app.bundle.js`: `ba2f825adfd753292a49a49d012be837509e821008a70b6a6152aaf215422d31`
  - `dist/manifest.json`: `ce2f944bb5fd513d40c00447c164561379cf287cb63becaab84ac2d9d85d39c5`

## Judgement calls

1. No reveal toggle was added: masking reduces casual exposure without adding UI/state complexity.
2. The forget action clears current odds results as well as persistence, avoiding a misleading
   “forgotten” state while market-derived data remains active.
3. The scrubber is narrow defence in depth; fixed safe messages remain the primary output policy.
4. Google Fonts and the Claude-preview Anthropic origin remain explicitly allow-listed.
5. Inline style attributes were not migrated early; Stage 9 owns that broad UI conversion.

## Remaining limitations

- SEC-2: the odds key is still browser-held and inspectable by a determined local user, extension or
  compromised same-origin script.
- FRAME-1: meta CSP cannot enforce `frame-ancestors` on GitHub Pages; the frame-buster compensates.
- STYLE-1: style attributes retain `'unsafe-inline'` until Stage 9.
- Public relays remain for key-free FPL/Understat traffic.

## Next gate

Owner review of draft PR #6, followed by the owner architecture-review gate. No Stage 4 model work
may begin until both are explicitly approved.
