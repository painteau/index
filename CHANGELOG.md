# Changelog

Toutes les évolutions notables de `index` sont documentées ici.

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versionnage
[SemVer](https://semver.org/lang/fr/). La section `[Unreleased]` accumule au fil de l'eau et
est renommée en numéro de version au moment de poser le tag.

Ce fichier est créé le 2026-09-05, après la mise en service : les évolutions antérieures ne sont
pas reconstituées, ce qui serait de la réécriture d'historique plutôt que de la documentation.
L'historique git reste la source de vérité pour ce qui précède.

## [Unreleased]

### Sécurité

Audit du 2026-10-25. L'empreinte du mot de passe était lisible sans connexion : **le mot
de passe d'avant cette version est à tenir pour compromis**, l'ancienne empreinte n'ouvre
plus de session et un nouveau mot de passe se pose avec `npm run hash-password`.

- `GET /api/settings` exige une session et ne rend que les réglages de recherche et de
  météo, jamais `admin_password`. Une version antérieure du code enregistrait même le mot
  de passe en clair dans cette table.
- Mot de passe haché en PBKDF2-SHA256 salé (100 000 itérations, plafond de Workers) au lieu
  d'un SHA-256 sans sel, comparaison à temps constant. Plus de « premier accès » qui laissait
  le premier venu choisir le mot de passe d'une base vide.
- Changement de mot de passe depuis les paramètres, qui révoque toutes les sessions. Jetons
  de session stockés sous forme d'empreinte, sessions expirées purgées à la connexion.
- Anti-force-brute : un verrou expiré repart de zéro au lieu de se reposer pour toujours, le
  compteur monte avant la vérification (plus de contournement par requêtes parallèles), une
  adresse IPv6 compte par /64, une requête mal formée ou non JSON n'est plus comptée.
- `public/apps.json` supprimé : ce reste d'import publiait 44 adresses d'administration à
  l'adresse `/apps.json`, en contournant le drapeau `public` des tuiles.
- Plus aucun `innerHTML` ni gestionnaire en ligne : un nom de tuile ne peut plus devenir du
  code (douze points d'injection, dont un échappement d'`onclick` contournable). URL de tuile,
  d'icône et de moteur personnalisé en `http(s)` seulement, côté API comme côté page.
- Entrées validées : types, longueurs, catégorie existante, caractères invisibles et bidi
  retirés ; une erreur interne ne renvoie plus son message.
- CORS retiré (l'API ne sert que sa propre page). En-têtes de sécurité sur l'API et, via
  `public/_headers`, sur le site : CSP sans script en ligne, pas d'encadrement.
- Vie privée : coordonnées arrondies à 2 décimales (environ 1 km) avant Open-Meteo et
  Nominatim, plus de favicons demandés à Google pour chaque tuile sans icône.
- Un anonyme ne voit plus que les catégories qui contiennent une tuile publique.

### Ajouté

- Tests (`npm test`, `node --test` avec D1 simulé par `node:sqlite`), lancés en CI à chaque
  push ; chaque correctif ci-dessus a été retiré un par un pour vérifier qu'un test échoue.
- `scripts/hash-password.mjs` et migration complète et rejouable (`sessions`,
  `login_attempts`, colonne `public`), qui manquaient au dépôt.

### Modifié

- Serveur de développement limité à `127.0.0.1`. README : licence BZ-1.1 (il annonçait MIT),
  routes réelles, pose du mot de passe et publication.
- **Adresse de l'association : 34 rue Decomberousse, 69100 Villeurbanne** (le siège quitte le 4 rue Isabelle Sadoyan), dans `LICENSE.md`.

## [0.2.0] - 2026-10-25

### Retiré

- **Moteur de recherche Whoogle** (`google.onode.fr`), service supprimé le 2026-10-25. Un
  navigateur qui l'avait choisi retombe sur Google, `applyEngine` le faisant déjà pour une clé
  inconnue. Entrée morte retirée aussi de `public/apps.json`.

### Modifié

- **`actions/checkout` et `actions/setup-node` passent en v7** dans les workflows : les versions
  posées déclaraient `using: node20`, déprécié et déjà forcé sur Node 24 par GitHub. Les quatre
  changements de rupture de ces majeures ont été lus et confrontés au parc, aucun ne s'y applique,
  et les 11 runners de l'org sont en 2.336.0 ou mieux, au-dessus du minimum 2.327.1 qu'exigent
  `checkout` v5 et `setup-node` v5. Vérifié par un build iOS réel avant propagation.


### Corrigé

- **Convention de fins de ligne du parc posée dans `.gitattributes`.** Le bloc `run:` d'un
  workflow GitHub Actions est un script shell exécuté sur un runner Linux : un antislash de
  continuation suivi d'un retour chariot **ne continue pas** la ligne, la commande est coupée en
  deux, et le message d'erreur ne parle jamais de fins de ligne.
- Cas réel du 2026-09-07 sur `bzhzion/cabanon` : un `.yml` recommité en CRLF depuis une machine
  Windows (où `core.autocrlf` est actif) a fait échouer le déploiement de l'API sur un
  `usage: ssh`, la destination de la commande ayant disparu avec la continuation.
- LF forcé sur ce qu'exécute Linux (`*.sh`, `*.yml`, `*.yaml`, `Dockerfile`), CRLF sur ce
  qu'exécute Windows (`*.ps1`, `*.bat`, `*.cmd`), et `* text=auto` comme filet général.
  Référence : `admin/.claude/gitattributes-parc`.


## [0.1.0] - 2026-09-05

### Ajouté

- **Convention changelog du parc posée sur ce dépôt** : ce fichier, les hooks `pre-commit` et
  `pre-push` dans `.githooks/`, et le workflow `changelog-guard.yml` qui rejoue les mêmes
  contrôles en CI au moment du tag. Ce dépôt en était dépourvu alors qu'il est déployé, ce qui
  le laissait hors de la garantie que les autres ont.

