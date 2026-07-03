# @webanalytics/tracker — script navigateur

Prototype du script de tracking sans cookies. **Cible : < 2 Ko min+gzip, zéro dépendance, ES5** (pas de build nécessaire, minification `terser` au déploiement).

## Installation (sur le site mesuré)

```html
<script>window.wa=window.wa||function(){(window.wa.q=window.wa.q||[]).push(arguments)}</script>
<script defer src="https://collect.example.fr/wa.js" data-site="wa_pub_XXXX"></script>
```

La première ligne (file d'attente) permet d'appeler `wa(...)` avant le chargement du script.

## Options (attributs du tag)

| Attribut | Défaut | Effet |
|---|---|---|
| `data-site` | — (requis) | Clé publique du site |
| `data-endpoint` | déduit du `src` (`…/collect`) | Endpoint de collecte (proxy first-party, etc.) |
| `data-spa` | `true` | Pages vues automatiques sur `pushState`/`popstate` |
| `data-hash` | `false` | Routage par `#fragment` (vieilles SPA) |
| `data-outbound` | `true` | Événement auto « Lien sortant » |
| `data-exclude` | — | Préfixes de chemins ignorés : `/admin,/preview` |
| `data-dnt` | off | `respect` → honore Do Not Track / Global Privacy Control |
| `data-dev` | `false` | Autorise localhost / IP privées (dev) |

## API

```js
wa('inscription', { plan: 'pro' });   // événement personnalisé (+ props scalaires)
wa.pageview();                        // page vue manuelle (si data-spa="false")
window.__waDisable = true;            // kill switch (ex. utilisateurs connectés)
```

## Garanties

- Aucun stockage côté visiteur (ni cookie, ni localStorage) — voir `docs/02-faisabilite-rgpd.md`.
- N'émet rien : navigateurs pilotés (`webdriver`), localhost (sauf `data-dev`), chemins exclus, DNT/GPC si activé.
- Jamais d'erreur visible : tous les échecs réseau sont silencieux.
- `sendBeacon` en priorité (fiable au déchargement de page), repli `fetch keepalive` puis XHR.
- Corps en `text/plain` → pas de préflight CORS (une seule requête par hit).

## Reste à faire avant v1

- [ ] Pipeline de minification + version (`wa.js` → `wa.min.js`, en-tête de version, sourcemap).
- [ ] Tests navigateurs (Playwright) : SPA, beacon au unload, file d'attente, exclusions.
- [ ] Événement auto « Téléchargement » (extensions configurables) — v1.
- [ ] Ping de durée d'engagement (`visibilitychange`) pour la durée de la dernière page — v1.x.
