#!/bin/sh
# Stage-1 test entrypoint (no npm needed)
node build.mjs && exec node --test tests/*.test.mjs
