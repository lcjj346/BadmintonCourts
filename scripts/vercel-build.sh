#!/usr/bin/env bash
# Vercel build entrypoint (package.json "vercel-build"). Runs on Vercel's Linux
# builders only — local builds use the plain `build` script, which never touches
# a database.
set -euo pipefail

npx prisma generate

if [ "${VERCEL_ENV:-}" = "production" ]; then
  # Production deploy: migrate the real database atomically with the build, so
  # new code never goes live against an old schema.
  npx prisma migrate deploy
elif [ "${PREVIEW_DATABASE:-}" = "1" ]; then
  # Preview deploy that has explicitly opted in to a dedicated preview database
  # (PREVIEW_DATABASE=1 set alongside preview-scoped DATABASE_URL/DIRECT_URL in
  # the Vercel dashboard). Migrate it to match this branch's schema and (re)seed
  # venues — the seed is an idempotent upsert, safe to run on every build.
  #
  # The flag is deliberate defence in depth: a bare DATABASE_URL accidentally
  # scoped into Preview is NOT enough to make preview builds run migrations —
  # that exact mis-scoping is how preview builds used to migrate production.
  npx prisma migrate deploy
  npx prisma db seed
fi
# Preview builds without PREVIEW_DATABASE build with no database at all; pages
# that need data show the global error screen, which is the intended fallback.

npx next build
