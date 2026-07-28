# GitHub Actions audit and permanent verification

Purpose: record the repository's CI history, the causes of misleading historical failures and the permanent verification contract. Audience: future development and maintenance sessions. Last updated: 2026-07-28. Related: `TESTING.md`, `SECURITY.md`, `CLAUDE.md`.

## Outcome

The stage-named workflows visible in GitHub Actions are historical, temporary verification workflows. Their YAML files were deliberately removed from the final branches after each stage was verified, so they are not active repository checks and old failed runs cannot be repaired by changing current application code.

A single permanent workflow now replaces that pattern: `.github/workflows/repository-verification.yml`. It runs on every pull request to `main`, every push to `main` and manual dispatch.

## Historical workflow audit

| Workflow shown in Actions | Repository finding | Current action |
|---|---|---|
| Stage 3.4 temporary verification | Built and tested the Provider Health branch, then compared a second build. It used the default `unversioned` identity, so it proved repeatability but not exact commit provenance. The workflow was removed after verification. | Superseded by the permanent workflow, which uses the exact checked-out commit. |
| Verify Stage 3.6 | Ran the full suite and compared two builds with a fixed synthetic identity. It proved deterministic output but not exact source identity. The stage later recorded 202 passing tests and a successful deterministic run. | Superseded by exact commit-identity verification. |
| Temporary Stage 3 security verification | Ran the full suite, compared two builds using `GITHUB_SHA` and uploaded the verified build. No structural workflow defect was found in the final version. | No historical repair required; equivalent checks are permanent. |
| Stage 4 verification | Ran the full suite and deterministic comparison using `GITHUB_SHA`. The final Stage 4 baseline was 220 passing tests. | No historical repair required; equivalent checks are permanent. |
| Stage 5 verification | Ran the full suite, deterministic builds and independent CSP verification, but used the synthetic identity `stage5-verify`. The final Stage 5 baseline was 241 passing tests. | Superseded by exact commit identity plus independent CSP verification. |
| Stage 6 verification | An intermediate version used `continue-on-error`, which made test failure reporting confusing and allowed later steps to run. Repository history corrected this to `set -o pipefail` with `tee`, so the test step itself fails accurately while retaining a log. The final baseline was 254 passing tests. | The corrected control flow is now the permanent standard. |
| Stage 7 verification | Ran the full suite, two exact-identity builds, byte comparisons and explicit identity checks. The final baseline was 274 passing tests. | No historical repair required; checks consolidated permanently. |
| Stage 8 verification | The workflow was amended to show a concise tail of the test log when a run failed. This was diagnostic improvement during implementation, not evidence of a remaining product defect. The final baseline was 284 passing tests. | Permanent workflow uploads the complete test log and fails at the original test step. |
| Stage 9.1 verification | Ran the full suite, exact-identity deterministic builds and a manifest identity check. The final baseline was 284 passing tests. | No historical repair required; checks consolidated permanently. |
| Stage 9.2 inspect | A branch-only inspection workflow used while developing checkpoint 9.2. Temporary inspection and closeout files were removed before review. PR #18 records 288 passing tests and deterministic build verification. | No change to the Stage 9.2 feature branch; permanent CI is introduced independently from `main`. |
| pages-build-deployment | GitHub-managed Pages deployment, not a repository-authored workflow file. | Do not edit or duplicate it. Diagnose any future Pages failure from that run's deployment log after repository verification is green. |

## Permanent verification contract

The permanent workflow:

1. Checks out the exact pull-request head SHA rather than relying on a synthetic merge identity.
2. Runs `./run-tests.sh` with Bash `pipefail`, preserving the real exit status while recording a downloadable log.
3. Builds twice with the exact checked-out commit in `BUILD_COMMIT`.
4. Compares `dist/index.html`, `dist/app.bundle.js` and `dist/manifest.json` byte-for-byte.
5. Verifies commit identity in the manifest, bundle and single-file HTML.
6. Independently recomputes the inline script and style CSP hashes from the emitted HTML.
7. Uploads the verified `dist/` output for seven days when the job succeeds.
8. Uses read-only repository permissions and cancels superseded runs for the same ref.

## Boundaries

The workflow deliberately does not require committed `dist/` files to match on every intermediate pull-request commit. Generated artefacts are committed only after the stage's final verified source commit. Final closeout must still compare the committed deployables with a rebuild from that recorded source identity.

This audit changes CI and documentation only. It does not change application code, model formulas, providers, UI behaviour, generated deployment files or GitHub Pages configuration.
