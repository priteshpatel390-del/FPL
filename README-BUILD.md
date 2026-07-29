# Build & test
- `node build.mjs` — deterministic bundle: src/ modules → dist/app.bundle.js, dist/index.html, dist/manifest.json, plus the byte-identical root index.html deployment copy. Set `BUILD_COMMIT=<sha>` to stamp a commit id.
- `./run-tests.sh` — builds, then runs all suites (node:test, zero dependencies).
- Deploy: GitHub Pages serves the generated root `index.html`, which the build keeps byte-identical to `dist/index.html`.
- dist/ is a build artefact; src/ + tests/ are the canonical code.
- Golden regeneration (deliberate only): `UPDATE_GOLDEN=1 node --test tests/characterisation.test.mjs`.
