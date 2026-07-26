# Build & test
- `node build.mjs` — deterministic bundle: src/ modules → dist/app.bundle.js, dist/index.html, dist/manifest.json. Set `BUILD_COMMIT=<sha>` to stamp a commit id.
- `./run-tests.sh` — builds, then runs all suites (node:test, zero dependencies).
- Deploy: upload dist/index.html to GitHub Pages as `index.html`.
- dist/ is a build artefact; src/ + tests/ are the canonical code.
- Golden regeneration (deliberate only): `UPDATE_GOLDEN=1 node --test tests/characterisation.test.mjs`.
