#!/bin/sh
set -e
node build.mjs
node --test tests/*.test.mjs
node scripts/a3-state-ownership-build-probe.mjs
