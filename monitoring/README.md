# SENVYR Monitoring — lot 1 (preversion)

Module local **facultatif** de supervision pour les futurs projets SENVYR. Il est distinct de la CI existante.

## Services preconfigures

| Service | Fonction | Acces depuis le poste |
| --- | --- | --- |
| Prometheus | Metriques des services de supervision | http://127.0.0.1:9090 |
| Grafana | Dashboards et exploration de logs | http://127.0.0.1:3001 |
| Loki | Reception et conservation locale des logs | Reseau Docker uniquement |
| Alloy | Collecte des fichiers `runtime-logs/*.log` vers Loki | Reseau Docker uniquement |

## Demarrage

Prerequis : Docker Engine/Desktop et Docker Compose, `bash`, `openssl`, `curl`.

Depuis la racine du depot :

```bash
bash monitoring/start.sh
```

Au premier lancement, un mot de passe aleatoire Grafana est genere dans `monitoring/.env` (non versionne). Pour le consulter sur **ton propre poste**, ouvrir ce fichier. Identifiant : `admin`.

Verification apres demarrage :

```bash
bash monitoring/check.sh
```

Resultats **attendus**, non encore testes sur Docker :

- Grafana et Prometheus accessibles uniquement sur `127.0.0.1`.
- Dashboard Grafana `SENVYR - Etat des services` importe automatiquement.
- Sources de donnees `Prometheus` et `Loki` disponibles sans configuration manuelle.
- Prometheus affiche quatre cibles (`prometheus`, `grafana`, `loki`, `alloy`) avec la valeur `UP`.
- Alloy transfere le journal `monitoring/runtime-logs/senvyr.log` vers Loki ; requete dans Grafana Explore : `{job="senvyr-file"}`.

Les applications ne sont **pas** encore instrumentees. Le dashboard ne montre que les composants de supervision.

## Arret non destructif

```bash
cd monitoring
docker compose down
```

Cette commande arrete et retire les conteneurs, **sans supprimer les volumes de donnees**. Ne pas ajouter `-v` sans avoir organise la sauvegarde.

## Limites et securite

- Environnement **local de developpement**, pas une installation de production ni un systeme HA.
- Ne pas exposer les ports a Internet : Loki et Alloy sont sans authentification HTTP externe, volontairement confines au reseau Docker.
- Le mot de passe de Grafana reste dans `monitoring/.env` hors Git ; ne jamais le committer.
- Les metriques et journaux applicatifs devront etre raccordes projet par projet (sans donnees de sante ou secrets dans les logs).
- L'authentification centralisee, la retention adaptee, les sauvegardes, les alertes vers une vraie destination et la validation des versions d'images restent a faire avant une exploitation serieuse.
- Aucun lancement Docker n'a ete valide par les tests de ce depot. Un essai reel sur le Mac est requis avant de fusionner ce lot.
