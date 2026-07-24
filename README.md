# Quiet Metrics qm.js: JavaScript tracker

![Quiet Metrics: qm.js tracker](art/banner.png)

> 🇫🇷 [Version française](README.fr.md)

Cookie-free audience measurement script for [Quiet Metrics](https://quietmetrics.dev), by La Boîte à Code. ES5, zero dependencies, no build step: a single file, targeting < 2 KB min+gzip.

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

- Every hit is a JSON `POST` with short keys (`k` site key, `t` type, `u` URL, `r` referrer, `w` screen width, `l` language, `n` event name, `p` properties). Full spec: `docs/05-api-et-sdk.md` at the monorepo root.
- Sent via `navigator.sendBeacon` (reliable on page unload), with `fetch keepalive` then `XMLHttpRequest` fallbacks.
- `text/plain` body: no CORS preflight, a single request per hit.
- Local deduplication: the same path never emits two consecutive page views (double `pushState`).
- Never emits for: automated browsers (`navigator.webdriver`), localhost and private IPs (unless `data-dev`), excluded paths, DNT/GPC when `data-dnt="respect"`.
- All network failures are silent: analytics never breaks the measured site.

## Privacy

Nothing is stored on the visitor's device: no cookie, no localStorage, no client-side fingerprinting. Visit identification happens server-side through a non-reversible daily hash (see `docs/02-faisabilite-rgpd.md`).

## Size

Source file: about 5.4 KB (2.3 KB gzipped with comments, 1.5 KB without). Production target: < 2 KB min+gzip (`terser` minification at deploy time).

## Tests

Dependency-free Node harness (minimal `window`/`document` simulation):

```bash
node --check tracker.js
node tests/run.js
```

## License

MIT. A [La Boîte à Code](https://laboiteacode.fr) product for [Quiet Metrics](https://quietmetrics.dev).
