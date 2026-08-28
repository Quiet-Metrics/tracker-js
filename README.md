# Quiet Metrics qm.js: JavaScript tracker

![Quiet Metrics: qm.js tracker](art/banner.png)

> 🇫🇷 [Version française](README.fr.md)

Audience measurement script with no identification or tracking cookies, for [Quiet Metrics](https://quietmetrics.dev), by La Boîte à Code. ES5, zero dependencies, no build step: a single file, served as is under a 4 KB announced ceiling.

## Installation

### Script tag (general case)

```html
<script>window.qm=window.qm||function(){(window.qm.q=window.qm.q||[]).push(arguments)}</script>
<script defer src="https://quietmetrics.dev/qm.js" data-site="qm_pub_XXXX"></script>
```

The first line installs a queue: any `qm(...)` call made before the script loads is replayed automatically.

> **Why no `integrity` (SRI) attribute on this tag?** The platform-served
> script is updated server-side; an SRI hash would pin one version and
> silently break measurement at the first update. If you want immutability,
> use the first-party copy below: served from your own domain, under your
> control (and you are free to add SRI to it, since you decide when it
> updates). In every case, a restrictive `script-src` CSP is documented in
> the installation guide.

### First-party copy (anti-adblock)

Copy `tracker.js` onto your own domain (or serve it through the PHP package's `qm-proxy.php`):

```html
<script defer src="https://mysite.com/qm.js" data-site="qm_pub_XXXX"></script>
```

The collection endpoint is inferred from the `src` origin (`…/collect`): serving the script from your domain is enough for collection to go through your domain too. Domain-based blocklists become powerless.

## Configuration (`data-*` attributes on the tag)

| Attribute | Default | Effect |
|---|---|---|
| `data-site` | (required) | Site public key (`qm_pub_…`) |
| `data-endpoint` | inferred from `src` (`…/collect`) | Explicit collection URL (first-party proxy, dedicated subdomain) |
| `data-spa` | `true` | Automatic page views on `pushState`/`replaceState`/`popstate` |
| `data-hash` | `false` | `true`: `#fragment` routing (the hash joins the measured URL, `hashchange` listened to) |
| `data-outbound` | `true` | Automatic "Outbound link" event on external link clicks |
| `data-downloads` | `false` | `true`: "Download" event on file link clicks (pdf, zip, docx…). Deliberately opt-in: these events count against the quota; an update must not inflate a bill. |
| `data-404` | `false` | `true`: "404" event with the requested path. Add it to the error template only; the page view is still counted normally. |
| `data-exclude` | (empty) | Ignored path prefixes, comma-separated: `/admin,/preview` |
| `data-dnt` | (off) | `respect`: emits nothing when Do Not Track or Global Privacy Control is active |
| `data-dev` | `false` | `true`: allows localhost and private IPs (development) |

## Usage

```js
// Custom event (name <= 120 characters, scalar properties)
qm('signup', { plan: 'pro' });

// Manual page view (useful with data-spa="false")
qm.pageview();

// Kill switch, e.g. to exclude logged-in users
window.__qmDisable = true;
```

These calls also work before the script loads, thanks to the queue snippet. A `qm()` call without a name is ignored.

## How it works

- Every hit is a JSON `POST` with short keys (`k` site key, `t` type, `u` URL, `r` referrer, `w` screen width, `l` language, `n` event name, `p` properties, `c` visit already under way). Full spec: `docs/05-api-et-sdk.md` at the monorepo root.
- Sent via `navigator.sendBeacon` (reliable on page unload), with `fetch keepalive` then `XMLHttpRequest` fallbacks.
- `text/plain` body: no CORS preflight, a single request per hit.
- Local deduplication: the same path never emits two consecutive page views (double `pushState`).
- Never emits for: visitors carrying the opt-out marker (see below), automated browsers (`navigator.webdriver`), localhost and private IPs (unless `data-dev`), excluded paths, DNT/GPC when `data-dnt="respect"`.
- All network failures are silent: analytics never breaks the measured site.

## Opting out of measurement

Anyone can ask to stop being counted on a tracked site, with no account and without writing to anyone: they just visit a page of that site with `?qm_ignore=1`.

```
https://mysite.com/?qm_ignore=1     stop being counted
https://mysite.com/?qm_ignore=0     be counted again
```

The marker that visit stores is called `qm_ignore` and its value is `1`. It is written on **both sides**: a first-party cookie of the tracked site (`path=/`, `samesite=lax`, `secure` over https, five years) **and** `localStorage`. This is not belt and braces: `localStorage` takes over wherever the cookie is refused or cleared, and the cookie is the only one of the two a server-side SDK can read. A single visit therefore covers script tracking and server-side tracking alike.

The marker holds no identifier (its value is the same for everyone), it is never transmitted to Quiet Metrics, and it exists only to stop measurement. The visit that stores it is not counted; the visit that removes it is counted right away.

## Visit continuity

When the visitor fingerprint changes mid-visit (4G, then wifi), the same person would otherwise be counted as two unique visitors on the same day. A first-party cookie of the tracked site closes that gap: `qm_visit`, value `1` (`path=/`, `samesite=lax`, `secure` over https), on a sliding ten-minute window pushed back by every hit.

The value is a constant, the same for everyone, so it identifies nobody: it only says that a visit is already under way in this browser. Each hit reports that state as `c: 1`, read *before* the window is pushed back, and the key is simply absent otherwise.

It is never written to someone who has set the opt-out marker, and never written when no hit is sent (excluded path, localhost, honoured DNT).

## Privacy

Nothing that identifies the visitor is stored on their device: no identification cookie, no identifier in localStorage, no client-side fingerprinting. Two things are written, and neither distinguishes anyone, since both hold the same value for everybody: the opt-out marker (cookie plus `localStorage`) and the visit continuity cookie. They do not fall under the same regime, so they never belong under the same heading. The marker records the person's own refusal: CNIL guidelines exempt that kind of marker from consent, it is stored at the person's own request so that we stop counting them, and its contents are never transmitted, so we do not even learn that someone has opted out. The continuity cookie serves measurement, so it falls under the audience measurement regime, which the publisher of the tracked site determines. Visit identification happens server-side through a non-reversible daily hash (see `docs/02-faisabilite-rgpd.md`).

## Size

Source file: on the order of 9.8 KB, close to half of it comments. It is served AS IS, with no minification step anywhere in the pipeline: roughly 3.96 KB gzipped, against an announced ceiling of 4 KB. Comments therefore travel to every visitor of every customer site, so keep them short. Measure before adding to this file, not after: `gzip -9 -c apps/platform/public/qm.js | wc -c`.

Roughly 38 bytes of headroom are left under the 4 KB ceiling, after the visit continuity cookie of 2026-08-28 spent most of it. Measure before writing, not after:

```bash
gzip -9 -c apps/platform/public/qm.js | wc -c
```

Minifying at deploy time would take the served file to about 2 KB and give the comments back for free. It was considered on 2026-08-28 and set aside: it would add a build step and a `terser` dependency to a package that has neither, and `TrackerSyncTest` guards the served copies as byte-identical to the source.

## Tests

Dependency-free Node harness (minimal `window`/`document` simulation):

```bash
node --check tracker.js
node tests/run.js
```

## License

MIT. A [La Boîte à Code](https://laboiteacode.fr) product for [Quiet Metrics](https://quietmetrics.dev).
