# Quiet Metrics qm.js : tracker JavaScript

Script de mesure d'audience sans cookies pour [Quiet Metrics](https://quietmetrics.dev), édité par La Boîte à Code. ES5, zéro dépendance, aucun build : un seul fichier, cible < 2 Ko min+gzip.

## Installation

### Balise script (cas général)

```html
<script>window.qm=window.qm||function(){(window.qm.q=window.qm.q||[]).push(arguments)}</script>
<script defer src="https://app.quietmetrics.dev/qm.js" data-site="qm_pub_XXXX"></script>
```

La première ligne installe une file d'attente : tout appel `wa(...)` fait avant le chargement du script est rejoué automatiquement.

### Copie first-party (anti-adblock)

Copiez `tracker.js` sur votre propre domaine (ou servez-le via le proxy `wa-proxy.php` du package PHP) :

```html
<script defer src="https://monsite.fr/qm.js" data-site="qm_pub_XXXX"></script>
```

L'endpoint de collecte est déduit de l'origine du `src` (`…/collect`) : servir le script depuis votre domaine suffit à ce que la collecte passe aussi par votre domaine. Les listes de blocage par nom de domaine deviennent inopérantes.

## Configuration (attributs `data-*` de la balise)

| Attribut | Défaut | Effet |
|---|---|---|
| `data-site` | (requis) | Clé publique du site (`qm_pub_…`) |
| `data-endpoint` | déduit du `src` (`…/collect`) | URL de collecte explicite (proxy first-party, sous-domaine dédié) |
| `data-spa` | `true` | Pages vues automatiques sur `pushState`/`replaceState`/`popstate` |
| `data-hash` | `false` | `true` : routage par `#fragment` (le hash entre dans l'URL mesurée, `hashchange` écouté) |
| `data-outbound` | `true` | Événement automatique « Lien sortant » au clic sur un lien externe |
| `data-downloads` | `false` | `true` : événement « Téléchargement » au clic sur un lien de fichier (pdf, zip, docx…). Opt-in volontaire : ces événements comptent dans le quota, une mise à jour ne doit pas gonfler une facture. |
| `data-404` | `false` | `true` : événement « 404 » avec le chemin demandé. À poser sur le seul gabarit d'erreur ; la page vue reste comptée normalement. |
| `data-exclude` | (vide) | Préfixes de chemins ignorés, séparés par des virgules : `/admin,/preview` |
| `data-dnt` | (off) | `respect` : n'émet rien si Do Not Track ou Global Privacy Control est actif |
| `data-dev` | `false` | `true` : autorise localhost et les IP privées (développement) |

## Usage

```js
// Événement personnalisé (nom <= 120 caractères, propriétés scalaires)
qm('inscription', { plan: 'pro' });

// Page vue manuelle (utile avec data-spa="false")
wa.pageview();

// Kill switch, par exemple pour exclure les utilisateurs connectés
window.__qmDisable = true;
```

Ces appels fonctionnent aussi avant le chargement du script grâce au snippet de file d'attente. Un appel `wa()` sans nom est ignoré.

## Comment ça marche

- Chaque hit est un `POST` JSON avec des clés courtes (`k` clé du site, `t` type, `u` URL, `r` referrer, `w` largeur d'écran, `l` langue, `n` nom d'événement, `p` propriétés). Spec complète : `docs/05-api-et-sdk.md` à la racine du monorepo.
- Envoi par `navigator.sendBeacon` (fiable au déchargement de page), repli `fetch keepalive`, puis `XMLHttpRequest`.
- Corps en `text/plain` : pas de préflight CORS, une seule requête par hit.
- Déduplication locale : un même chemin n'émet pas deux pageviews consécutives (double `pushState`).
- N'émet jamais : navigateurs pilotés (`navigator.webdriver`), localhost et IP privées (sauf `data-dev`), chemins exclus, DNT/GPC si `data-dnt="respect"`.
- Tous les échecs réseau sont silencieux : l'analytics ne casse jamais le site mesuré.

## Vie privée

Aucune donnée n'est stockée chez le visiteur : ni cookie, ni localStorage, ni fingerprinting côté client. L'identification de visite est faite côté serveur par hash journalier non réversible (voir `docs/02-faisabilite-rgpd.md`).

## Taille

Fichier source : environ 5,4 Ko (2,3 Ko gzip avec les commentaires, 1,5 Ko gzip sans). Cible servie en production : < 2 Ko min+gzip (minification `terser` au déploiement).

## Tests

Harnais Node sans dépendance (simulation minimale de `window`/`document`) :

```bash
node --check tracker.js
node tests/run.js
```

## Licence

MIT.
