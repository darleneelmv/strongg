#!/bin/sh
# Actualiza el sistema en el VPS con la última versión del repositorio (los datos no se tocan)
set -e
cd "$(dirname "$0")"
git pull
docker compose up -d --build
docker image prune -f >/dev/null
echo "Listo. Revisa: docker compose logs -f app"
