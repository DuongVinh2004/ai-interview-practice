#!/bin/sh
set -eu

pnpm --filter api db:migrate:deploy
pnpm --filter api db:seed
exec pnpm --filter web exec playwright test "$@"
