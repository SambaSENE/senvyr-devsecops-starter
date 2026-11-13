# SENVYR DevSecOps Starter

Kit autonome de contrôle qualité et sécurité pour projets **Node.js/npm**.
Version initiale : `0.1.0` (préversion publique en cours de validation).

Conçu à partir du workflow `NS54 - Quality Gate` validé le 13 novembre 2026.
Il ne contient **aucun code métier, secret ou exception Gitleaks de NS54**.

## Ce que le kit installe

- Un workflow GitHub Actions `.github/workflows/ci.yml`.
- Jobs Node adaptés aux packages présents : `frontend/`, `backend/` ou `package.json` à la racine.
- `npm ci`, ESLint sans avertissement, tests et compilation pour chaque package.
- Contrôle `format:check` et tests E2E s'ils existent dans `package.json`.
- Gitleaks : fichiers courants et historique complet (conteneur isolé en lecture seule).
- Trivy : dépendances npm, y compris dev, sévérités `HIGH` et `CRITICAL`.

La page **GitHub Actions** de chaque dépôt sert de tableau de bord CI.
SonarQube, Grafana et les autres stacks ne sont pas inclus dans cette version.

## Prérequis

- Node.js 20 ou plus sur le poste où l'installateur est exécuté.
- Dépôt GitHub avec GitHub Actions activé.
- Un ou deux dossiers Node (`frontend`, `backend`), ou un seul projet Node à la racine.
- `package.json` et `package-lock.json` dans chaque dossier détecté.
- Scripts npm `lint` (ESLint, sans `--fix`), `test` (non interactif), `build`.

L'installateur ne lance ni `npm install`, ni Docker, ni de modifications de dépendances.
Il génère seulement la configuration de CI. Sur GitHub, les runners installent et exécutent les outils.

## Tester sans modifier le projet

Depuis le dossier de ce kit :

```bash
node bin/senvyr-devsecops.mjs --target /chemin/vers/mon-projet
```

## Installation : une seule commande

```bash
node bin/senvyr-devsecops.mjs --target /chemin/vers/mon-projet --apply
```

Sur Windows, utiliser un chemin Windows :

```powershell
node .\bin\senvyr-devsecops.mjs --target C:\Projets\MonApplication --apply
```

Commande distante testée en simulation depuis la racine du projet :
`npm exec --yes --package="github:SambaSENE/senvyr-devsecops-starter#cddcfff" -- senvyr-devsecops --target .`

## Installer dans un nouveau projet

1. Créer un nouveau dépôt GitHub depuis ce modèle une fois publié comme « Template repository ».
2. Ajouter le code et les scripts `lint`, `test`, `build` de l'application.
3. Exécuter l'installateur avec `--apply`.
4. Relire le workflow généré, le committer sur une branche de fonctionnalité, puis ouvrir une PR.
5. Vérifier les contrôles GitHub Actions avant toute fusion.

## Mesures de sécurité

- **Aucun écrasement** de `.github/workflows/ci.yml` existant. La commande échoue et laisse le fichier intact.
- **Simulation par défaut** : l'écriture exige `--apply`.
- Permissions GitHub minimales : `contents: read`.
- `persist-credentials: false` pour `actions/checkout`.
- Pas de jeton ou secret demandé par l'installateur.
- Pas d'exception Gitleaks importée depuis un autre projet.
- Aucune garantie de protection automatique des branches : configurer des règles selon les possibilités de son offre GitHub.

## Limites importantes

- Ce kit ne remplace pas les tests d'intégration, le contrôle d'accès, une revue humaine ni un audit de sécurité.
- Les tests sont seulement exécutés si les scripts du projet existent. Un script vide ou des tests insuffisants ne prouvent pas la qualité métier.
- Les scans Trivy ciblent ici les vulnérabilités connues `HIGH`/`CRITICAL`. D'autres sévérités ou familles de problèmes peuvent exister.
- Les actions et versions d'outils doivent être réévaluées et mises à jour régulièrement.
- La première version prend en charge **npm uniquement** : pas de pnpm, Yarn, Maven, Gradle, Python ni Flutter.
- Pour un dépôt qui possède déjà `ci.yml`, examiner et intégrer manuellement : aucun remplacement automatique.

## Validation du kit

```bash
npm test
```

Les tests automatiques vérifient notamment le mode simulation, la génération fullstack, le projet racine et le refus d'écraser des fichiers existants. Avant publication, exécuter un essai GitHub Actions sur un dépôt de test.

Le dépôt du starter possède son propre workflow `.github/workflows/self-test.yml` pour relancer ces tests à chaque PR et push. Il s'agit d'une validation de l'installateur, **pas** d'une preuve que le workflow généré fonctionne sur toutes les applications possibles.
