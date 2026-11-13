#!/usr/bin/env bash
set -euo pipefail

MONITOR_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo 'ERREUR : Docker et le plugin Docker Compose sont requis.' >&2
  exit 1
fi

if [[ ! -f "$MONITOR_DIR/.env" ]]; then
  if ! command -v openssl >/dev/null 2>&1; then
    echo 'ERREUR : openssl est requis pour creer le mot de passe Grafana.' >&2
    exit 1
  fi
  (
    umask 077
    printf 'GRAFANA_ADMIN_PASSWORD=%s\n' "$(openssl rand -hex 24)" > "$MONITOR_DIR/.env"
  )
  echo 'Mot de passe Grafana genere dans monitoring/.env (fichier exclu de Git).'
fi

mkdir -p "$MONITOR_DIR/runtime-logs"
printf '%s senvyr-monitoring bootstrap\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" >> "$MONITOR_DIR/runtime-logs/senvyr.log"

docker compose --project-directory "$MONITOR_DIR" --env-file "$MONITOR_DIR/.env" -f "$MONITOR_DIR/compose.yaml" config --quiet
docker compose --project-directory "$MONITOR_DIR" --env-file "$MONITOR_DIR/.env" -f "$MONITOR_DIR/compose.yaml" up -d

echo 'Services demarres (verifier avec : bash monitoring/check.sh).'
echo 'Grafana : http://127.0.0.1:3001'
echo 'Prometheus : http://127.0.0.1:9090'
