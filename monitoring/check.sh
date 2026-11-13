#!/usr/bin/env bash
set -euo pipefail

MONITOR_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

if ! command -v curl >/dev/null 2>&1; then
  echo 'ERREUR : curl est requis.' >&2
  exit 1
fi

printf 'Verification Prometheus ... '
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:9090/-/ready >/dev/null
echo 'OK'

printf 'Verification Grafana ... '
curl --fail --silent --show-error --max-time 10 http://127.0.0.1:3001/api/health >/dev/null
echo 'OK'

printf 'Statut des conteneurs :\n'
docker compose --project-directory "$MONITOR_DIR" --env-file "$MONITOR_DIR/.env" -f "$MONITOR_DIR/compose.yaml" ps

echo 'Pour valider la collecte, verifier dans Prometheus : Status > Targets (4 cibles UP).'
echo 'Dans Grafana : Dashboards > SENVYR Monitoring ; Explore > Loki > {job="senvyr-file"}.'
