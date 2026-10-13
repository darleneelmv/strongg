#!/bin/sh
# Strong Gym en Mac o Linux
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env
exec node --disable-warning=ExperimentalWarning server/index.js
