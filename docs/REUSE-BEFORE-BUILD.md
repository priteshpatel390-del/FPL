# Reuse Before Build — canonical engineering principle

Status: **Accepted engineering principle — approved by Pritesh on 26 August 2026.**

Purpose: prevent Teamsheet from spending engineering time rediscovering mature solutions that already exist, while preserving Teamsheet's licensing, provenance, security, evidence and approval standards.

This is a process rule. It does **not** approve any external dependency, provider, data source, runtime path, model change or calculation change.

## Default question

Before substantial new engineering, ask:

> **Has somebody already solved this well?**

Starting from scratch is the exception. The preferred path is to understand credible prior art first and then build only the Teamsheet-specific portion that remains necessary.

## Mandatory reuse/reference gate

Before detailed design or implementation of a substantial capability:

1. Define the exact Teamsheet requirement and its exclusions.
2. Search credible public repositories, packages, research and FPL-community work for existing implementations.
3. Identify the strongest candidates rather than collecting a long undifferentiated list.
4. Inspect how those candidates handle architecture, state, edge cases, tests and failures.
5. Re-verify, where applicable:
   - software licence and attribution requirements;
   - upstream data ownership, terms and retention/redistribution rights;
   - provenance and temporal semantics;
   - security and credential boundaries;
   - maintenance/activity and compatibility with current FPL rules;
   - dependencies and runtime/toolchain assumptions;
   - tests, correctness evidence and failure behaviour;
   - compatibility with Teamsheet's architecture and approval gates.
6. Classify each serious candidate explicitly:
   - **Adopt** — use substantially as-is;
   - **Adapt** — modify a permitted implementation for Teamsheet;
   - **Port** — independently implement a proven behaviour/pattern in Teamsheet's stack;
   - **Reference** — learn from architecture, contracts, tests or edge cases only;
   - **Reject** — unsuitable, unsafe, incompatible, stale or unjustified.
7. Record why Teamsheet still needs to build anything that remains.
8. Only then proceed to the normal design and approval gate.

## What reuse does not mean

Open source does not mean "safe to copy".

- A software licence does not grant rights to underlying football/FPL/provider data.
- A public repository without an explicit licence is **reference-only** unless permission is established.
- Popularity, stars, forks or sophisticated mathematics are not correctness or predictive-value evidence.
- External model results are not Teamsheet accuracy evidence unless their information timing, methodology and evaluation can be reproduced honestly.
- An external project's dependencies, write flows, authentication or infrastructure are not imported merely because one useful idea exists inside it.

When code cannot or should not be copied, mature behaviour can still be independently ported as a pattern where licensing and clean-room implementation permit it.

## Teamsheet constraints remain authoritative

Reuse must preserve the current project constraints unless a separate owner-approved change explicitly alters them, including:

- Vanilla JavaScript ES modules;
- zero-dependency production toolchain and no assumed npm-registry access;
- Node built-in tests and custom deterministic bundler;
- GitHub Pages single-file deployment;
- Cloudflare/D1 boundaries where approved;
- secrets never entering browser code;
- optional-provider graceful failure;
- provider/data/model approval gates;
- canonical Official FPL identity and fail-closed mapping;
- evidence/provenance requirements;
- mobile-first iPhone usability.

## Scope across Teamsheet

This gate applies before substantial future work on, at minimum:

- backend and data infrastructure;
- ingestion, history, snapshots, manifests and provenance;
- expected minutes and availability;
- fixture difficulty and workload;
- projections and calibration;
- transfer and squad optimisation;
- captaincy and chip strategy;
- rank and Mini-League simulation;
- historical backtesting and validation;
- visualisation and automation;
- AI/autonomous decision-making.

A previous reuse audit does not permanently approve a repository or dependency. Licence, activity, upstream rights, rules and APIs are time-sensitive and must be re-verified when an actual adoption is proposed.

## Research lineage

External-repository research remains governed by:

- [External Intelligence Foundation](EXTERNAL-INTELLIGENCE-FOUNDATION.md);
- [External Intelligence Research Programme](research/README.md);
- [Research — External Repositories](research/09-EXTERNAL-REPOSITORIES/RESEARCH-EXTERNAL-REPOSITORIES.md).

The first checkpoint-specific application of this principle is the [DATA-S2 Backend Reuse Audit](research/09-EXTERNAL-REPOSITORIES/DATA-S2-BACKEND-REUSE-AUDIT.md).
