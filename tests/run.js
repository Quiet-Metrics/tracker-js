/*
 * Harnais de test Node pour tracker.js (aucune dépendance).
 * Le fichier cible est du code navigateur ES5 : on simule window/document
 * a minima dans un contexte vm, puis on vérifie les payloads émis.
 *
 * Usage : node tests/run.js
 */
'use strict';

var fs = require('fs');
var path = require('path');
var vm = require('vm');
var assert = require('assert');

var SOURCE = fs.readFileSync(path.join(__dirname, '..', 'tracker.js'), 'utf8');

/* -- Environnement navigateur simulé ---------------------------------- */

function makeEnv(options) {
  options = options || {};
  var attrs = options.attrs || {};
  if (!('data-site' in attrs)) attrs['data-site'] = 'qm_pub_test';

  var sent = [];       // hits sendBeacon
  var xhrSent = [];    // hits repli XHR
  var docListeners = {};
  var winListeners = {};

  var script = {
    src: options.src !== undefined ? options.src : 'https://collect.example.fr/qm.js',
    getAttribute: function (name) {
      return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
    }
  };

  var location = options.location || {
    protocol: 'https:', host: 'monsite.fr', hostname: 'monsite.fr',
    pathname: '/', search: '', hash: ''
  };

  var navigator = {
    language: 'fr-FR',
    languages: ['fr-FR', 'fr'],
    webdriver: false,
    sendBeacon: options.noBeacon ? undefined : function (url, body) {
      sent.push({ url: url, body: JSON.parse(body) });
      return true;
    }
  };
  if (options.gpc) navigator.globalPrivacyControl = true;
  if (options.dnt) navigator.doNotTrack = '1';

  var win = {
    location: location,
    navigator: navigator,
    innerWidth: 1440,
    history: {
      pushState: function (state, title, url) { if (url) location.pathname = url; },
      replaceState: function (state, title, url) { if (url) location.pathname = url; }
    },
    addEventListener: function (type, fn) {
      (winListeners[type] = winListeners[type] || []).push(fn);
    },
    console: console
  };
  if (options.queue) {
    win.qm = function () {};
    win.qm.q = options.queue;
  }

  var doc = {
    currentScript: script,
    referrer: 'https://google.fr/',
    visibilityState: 'visible',
    addEventListener: function (type, fn) {
      (docListeners[type] = docListeners[type] || []).push(fn);
    }
  };

  // document.cookie n'est pas une chaine ordinaire : la lecture rend tout le
  // bocal, l'ecriture n'en modifie qu'une entree. Simuler l'un sans l'autre
  // ferait passer un tracker qui ecrase tous les cookies du site hote.
  var cookieJar = Object.assign({}, options.cookies || {});
  // Les ecritures brutes sont conservees en plus du bocal : le bocal dit
  // quelle valeur reste, les ecritures disent avec quels attributs, et
  // l'expiration glissante du cookie de visite ne se lit que la.
  var cookieWrites = [];
  Object.defineProperty(doc, 'cookie', {
    get: function () {
      return Object.keys(cookieJar).map(function (k) { return k + '=' + cookieJar[k]; }).join('; ');
    },
    set: function (raw) {
      cookieWrites.push(String(raw));
      var first = String(raw).split(';')[0];
      var name = first.split('=')[0].trim();
      var value = first.split('=').slice(1).join('=').trim();
      if (value === '' || /max-age=0\b/i.test(raw)) { delete cookieJar[name]; }
      else { cookieJar[name] = value; }
    }
  });

  var storage = Object.assign({}, options.storage || {});
  win.localStorage = options.noStorage ? undefined : {
    getItem: function (k) {
      return Object.prototype.hasOwnProperty.call(storage, k) ? storage[k] : null;
    },
    setItem: function (k, v) { storage[k] = String(v); },
    removeItem: function (k) { delete storage[k]; }
  };

  function FakeXHR() {}
  FakeXHR.prototype.open = function (method, url) { this.method = method; this.url = url; };
  FakeXHR.prototype.send = function (body) {
    xhrSent.push({ method: this.method, url: this.url, body: JSON.parse(body) });
  };

  var context = {
    window: win,
    document: doc,
    console: console,
    setTimeout: function (fn) { fn(); },   // synchrone : onNav() devient testable
    XMLHttpRequest: FakeXHR
  };
  vm.createContext(context);
  vm.runInContext(SOURCE, context, { filename: 'tracker.js' });

  return {
    win: win, doc: doc, location: location, sent: sent, xhrSent: xhrSent,
    docListeners: docListeners, winListeners: winListeners,
    cookies: cookieJar, cookieWrites: cookieWrites, storage: storage
  };
}

var passed = 0;
function test(label, fn) {
  fn();
  passed++;
  console.log('  ok - ' + label);
}

/* -- Tests -------------------------------------------------------------- */

test('pageview initiale : payload k/t/u/r/l/w conforme a docs/05', function () {
  var env = makeEnv();
  assert.strictEqual(env.sent.length, 1);
  var hit = env.sent[0];
  assert.strictEqual(hit.url, 'https://collect.example.fr/collect'); // endpoint deduit du src
  assert.strictEqual(hit.body.k, 'qm_pub_test');
  assert.strictEqual(hit.body.t, 'pageview');
  assert.strictEqual(hit.body.u, 'https://monsite.fr/');
  assert.strictEqual(hit.body.r, 'https://google.fr/');
  assert.strictEqual(hit.body.l, 'fr-FR');
  assert.strictEqual(hit.body.w, 1440);
  assert.strictEqual(hit.body.n, undefined);
  assert.strictEqual(hit.body.p, undefined);
});

test('data-endpoint prime sur la deduction depuis le src', function () {
  var env = makeEnv({ attrs: { 'data-endpoint': 'https://monsite.fr/wa-proxy.php' } });
  assert.strictEqual(env.sent[0].url, 'https://monsite.fr/wa-proxy.php');
});

test('evenement custom : wa(nom, props) => t=event, n, p', function () {
  var env = makeEnv();
  env.win.qm('inscription', { plan: 'pro' });
  assert.strictEqual(env.sent.length, 2);
  var hit = env.sent[1];
  assert.strictEqual(hit.body.t, 'event');
  assert.strictEqual(hit.body.n, 'inscription');
  assert.deepStrictEqual(hit.body.p, { plan: 'pro' });
});

test('wa() sans nom n\'emet rien (aurait ete un 400 serveur)', function () {
  var env = makeEnv();
  env.win.qm();
  assert.strictEqual(env.sent.length, 1); // seulement la pageview initiale
});

test('nom d\'evenement tronque a 120 caracteres', function () {
  var env = makeEnv();
  env.win.qm(new Array(200 + 1).join('x'));
  assert.strictEqual(env.sent[1].body.n.length, 120);
});

test('file d\'attente du snippet rejouee au chargement (avant la pageview)', function () {
  var env = makeEnv({ queue: [['signup', { plan: 'free' }]] });
  assert.strictEqual(env.sent.length, 2);
  assert.strictEqual(env.sent[0].body.t, 'event');
  assert.strictEqual(env.sent[0].body.n, 'signup');
  assert.deepStrictEqual(env.sent[0].body.p, { plan: 'free' });
  assert.strictEqual(env.sent[1].body.t, 'pageview');
});

test('SPA : pushState declenche une pageview, chemin identique deduplique', function () {
  var env = makeEnv();
  env.win.history.pushState({}, '', '/page-2');
  assert.strictEqual(env.sent.length, 2);
  assert.strictEqual(env.sent[1].body.u, 'https://monsite.fr/page-2');
  env.win.history.pushState({}, '', '/page-2'); // double pushState
  assert.strictEqual(env.sent.length, 2);
  env.win.history.replaceState({}, '', '/page-3');
  assert.strictEqual(env.sent.length, 3);
});

test('data-spa="false" : pushState non instrumente', function () {
  var env = makeEnv({ attrs: { 'data-spa': 'false' } });
  env.win.history.pushState({}, '', '/page-2');
  assert.strictEqual(env.sent.length, 1);
});

test('data-hash="true" : fragment dans u + ecouteur hashchange', function () {
  var env = makeEnv({
    attrs: { 'data-hash': 'true' },
    location: { protocol: 'https:', host: 'monsite.fr', hostname: 'monsite.fr',
                pathname: '/', search: '', hash: '#/accueil' }
  });
  assert.strictEqual(env.sent[0].body.u, 'https://monsite.fr/#/accueil');
  assert.ok(env.winListeners.hashchange && env.winListeners.hashchange.length === 1);
  env.location.hash = '#/contact';
  env.winListeners.hashchange[0]();
  assert.strictEqual(env.sent[1].body.u, 'https://monsite.fr/#/contact');
});

test('data-dnt="respect" : GPC (navigator.globalPrivacyControl) coupe l\'envoi', function () {
  var env = makeEnv({ attrs: { 'data-dnt': 'respect' }, gpc: true });
  assert.strictEqual(env.sent.length, 0);
});

test('data-dnt="respect" : DNT=1 coupe l\'envoi', function () {
  var env = makeEnv({ attrs: { 'data-dnt': 'respect' }, dnt: true });
  assert.strictEqual(env.sent.length, 0);
});

test('sans data-dnt, DNT/GPC n\'empechent pas la collecte (opt-in editeur)', function () {
  var env = makeEnv({ gpc: true, dnt: true });
  assert.strictEqual(env.sent.length, 1);
});

test('data-exclude : prefixe de chemin ignore', function () {
  var env = makeEnv({
    attrs: { 'data-exclude': '/admin, /preview' },
    location: { protocol: 'https:', host: 'monsite.fr', hostname: 'monsite.fr',
                pathname: '/admin/stats', search: '', hash: '' }
  });
  assert.strictEqual(env.sent.length, 0);
});

test('localhost ignore par defaut, autorise avec data-dev="true"', function () {
  var local = { protocol: 'http:', host: 'localhost:8000', hostname: 'localhost',
                pathname: '/', search: '', hash: '' };
  var env = makeEnv({ location: local });
  assert.strictEqual(env.sent.length, 0);
  var envDev = makeEnv({ attrs: { 'data-dev': 'true' },
    location: { protocol: 'http:', host: 'localhost:8000', hostname: 'localhost',
                pathname: '/', search: '', hash: '' } });
  assert.strictEqual(envDev.sent.length, 1);
});

test('navigateur pilote (webdriver) : aucun envoi', function () {
  var env = makeEnv();
  env.win.navigator.webdriver = true;
  env.win.qm('bot_event');
  assert.strictEqual(env.sent.length, 1); // rien apres la pageview initiale
});

test('kill switch __qmDisable', function () {
  var env = makeEnv();
  env.win.__qmDisable = true;
  env.win.qm('ignore');
  assert.strictEqual(env.sent.length, 1);
});

test('repli XHR quand sendBeacon et fetch sont absents', function () {
  var env = makeEnv({ noBeacon: true });
  assert.strictEqual(env.sent.length, 0);
  assert.strictEqual(env.xhrSent.length, 1);
  assert.strictEqual(env.xhrSent[0].method, 'POST');
  assert.strictEqual(env.xhrSent[0].url, 'https://collect.example.fr/collect');
  assert.strictEqual(env.xhrSent[0].body.t, 'pageview');
});

test('lien sortant : evenement auto sur clic externe, rien en interne', function () {
  var env = makeEnv();
  var handler = env.docListeners.click[0];
  handler({ target: { tagName: 'A', href: 'https://ailleurs.fr/page',
                      host: 'ailleurs.fr', parentElement: null } });
  assert.strictEqual(env.sent.length, 2);
  assert.strictEqual(env.sent[1].body.n, 'Lien sortant');
  assert.deepStrictEqual(env.sent[1].body.p, { url: 'https://ailleurs.fr/page' });
  handler({ target: { tagName: 'A', href: 'https://monsite.fr/interne',
                      host: 'monsite.fr', parentElement: null } });
  assert.strictEqual(env.sent.length, 2);
});

test('data-outbound="false" : pas d\'ecouteur de clic', function () {
  var env = makeEnv({ attrs: { 'data-outbound': 'false' } });
  assert.ok(!env.docListeners.click);
});

// Telechargements et 404 sont opt-in : les activer par defaut ajouterait des
// evenements au quota de comptes dont le trafic n'a pas bouge.
test('telechargements : rien sans data-downloads', function () {
  var env = makeEnv();
  var handler = env.docListeners.click[0];
  handler({ target: { tagName: 'A', href: 'https://monsite.fr/guide.pdf',
                      pathname: '/guide.pdf', host: 'monsite.fr', parentElement: null } });
  assert.strictEqual(env.sent.length, 1, 'seule la page vue initiale');
});

test('telechargements : evenement auto quand data-downloads="true"', function () {
  var env = makeEnv({ attrs: { 'data-downloads': 'true' } });
  var handler = env.docListeners.click[0];
  handler({ target: { tagName: 'A', href: 'https://monsite.fr/guide.pdf',
                      pathname: '/guide.pdf', host: 'monsite.fr', parentElement: null } });
  assert.strictEqual(env.sent.length, 2);
  assert.strictEqual(env.sent[1].body.n, 'Téléchargement');
  assert.deepStrictEqual(env.sent[1].body.p, { url: 'https://monsite.fr/guide.pdf' });
});

test('telechargement externe : un seul evenement, jamais deux', function () {
  var env = makeEnv({ attrs: { 'data-downloads': 'true' } });
  var handler = env.docListeners.click[0];
  handler({ target: { tagName: 'A', href: 'https://ailleurs.fr/doc.zip',
                      pathname: '/doc.zip', host: 'ailleurs.fr', parentElement: null } });
  assert.strictEqual(env.sent.length, 2, 'un clic = un evenement, pas deux');
  assert.strictEqual(env.sent[1].body.n, 'Téléchargement');
});

test('telechargements : une page normale n\'est pas comptee comme telechargement', function () {
  var env = makeEnv({ attrs: { 'data-downloads': 'true' } });
  var handler = env.docListeners.click[0];
  handler({ target: { tagName: 'A', href: 'https://monsite.fr/tarifs',
                      pathname: '/tarifs', host: 'monsite.fr', parentElement: null } });
  assert.strictEqual(env.sent.length, 1);
});

test('404 : rien sans data-404', function () {
  var env = makeEnv();
  assert.strictEqual(env.sent.length, 1);
  assert.strictEqual(env.sent[0].body.t, 'pageview');
});

test('404 : la page vue est conservee, l\'evenement s\'y ajoute', function () {
  var env = makeEnv({ attrs: { 'data-404': 'true' } });
  assert.strictEqual(env.sent.length, 2);
  assert.strictEqual(env.sent[0].body.t, 'pageview');
  assert.strictEqual(env.sent[1].body.n, '404');
});

test('data-site manquant : le script ne fait rien et ne plante pas', function () {
  var env = makeEnv({ attrs: { 'data-site': null } });
  assert.strictEqual(env.sent.length, 0);
});

/* -- Marqueur d'exclusion ------------------------------------------------
 * Le SEUL stockage que ce traceur ecrive, et il sert a NE PAS compter. Pose
 * par la personne elle-meme via ?qm_ignore=1, il ne contient aucun
 * identifiant et n'est jamais transmis. C'est ce qui le distingue d'un
 * cookie d'identification ou de tracabilite, et ce qui le rend exempte.
 */

test('?qm_ignore=1 : aucun hit, et le marqueur est pose des deux cotes', function () {
  var env = makeEnv({
    location: { protocol: 'https:', host: 'monsite.fr', hostname: 'monsite.fr',
                pathname: '/', search: '?qm_ignore=1', hash: '' }
  });
  assert.strictEqual(env.sent.length, 0, 'la visite qui pose le marqueur ne se compte pas elle-meme');
  assert.strictEqual(env.storage.qm_ignore, '1');
  assert.strictEqual(env.cookies.qm_ignore, '1');
});

test('marqueur deja pose en cookie : aucun hit', function () {
  var env = makeEnv({ cookies: { qm_ignore: '1' } });
  assert.strictEqual(env.sent.length, 0);
});

test('marqueur deja pose en localStorage : aucun hit', function () {
  var env = makeEnv({ storage: { qm_ignore: '1' } });
  assert.strictEqual(env.sent.length, 0);
});

test('?qm_ignore=0 : le marqueur est retire et la visite recompte', function () {
  var env = makeEnv({
    cookies: { qm_ignore: '1' }, storage: { qm_ignore: '1' },
    location: { protocol: 'https:', host: 'monsite.fr', hostname: 'monsite.fr',
                pathname: '/', search: '?qm_ignore=0', hash: '' }
  });
  assert.strictEqual(env.storage.qm_ignore, undefined);
  assert.strictEqual(env.cookies.qm_ignore, undefined);
  assert.strictEqual(env.sent.length, 1, 'qui revient sur sa decision est compte des cette visite');
});

test('le marqueur ne se confond pas avec un cookie voisin du site hote', function () {
  var env = makeEnv({ cookies: { autre_qm_ignore: '1', qm_ignore_bis: '1' } });
  assert.strictEqual(env.sent.length, 1, 'seul le nom exact vaut exclusion');
});

test('le marqueur n ecrase aucun cookie du site hote', function () {
  var env = makeEnv({
    cookies: { session: 'abc' },
    location: { protocol: 'https:', host: 'monsite.fr', hostname: 'monsite.fr',
                pathname: '/', search: '?qm_ignore=1', hash: '' }
  });
  assert.strictEqual(env.cookies.session, 'abc');
});

test('localStorage indisponible (mode prive) : le cookie suffit', function () {
  var env = makeEnv({ noStorage: true, cookies: { qm_ignore: '1' } });
  assert.strictEqual(env.sent.length, 0);
});

/* -- Continuite de visite -------------------------------------------------
 * Cookie `qm_visit`, valeur constante `1` : la MEME chez tout le monde. Il
 * n'identifie personne, il dit seulement qu'une visite est deja en cours sur
 * ce navigateur. Sans lui, une empreinte qui change EN COURS DE VISITE (4G
 * puis wifi) fait compter la meme personne deux fois le meme jour.
 *
 * Ce que ces tests gardent : la valeur ne varie pas, l'expiration glisse a
 * chaque hit, `c` dit l'etat AU MOMENT du hit et non apres, et rien n'est
 * jamais ecrit chez une personne qui s'est exclue.
 */

function visitWrites(env) {
  return env.cookieWrites.filter(function (raw) { return raw.indexOf('qm_visit=') === 0; });
}

test('premier hit : pas de `c`, et le cookie de visite est pose', function () {
  var env = makeEnv();
  assert.strictEqual(env.sent[0].body.c, undefined, 'aucune visite en cours au moment du hit');
  assert.strictEqual(env.cookies.qm_visit, '1');
});

test('visite deja en cours : `c` vaut 1', function () {
  var env = makeEnv({ cookies: { qm_visit: '1' } });
  assert.strictEqual(env.sent[0].body.c, 1);
});

test('`c` dit l etat AU MOMENT du hit, pas apres le rafraichissement', function () {
  var env = makeEnv();
  env.win.history.pushState({}, '', '/page-2');
  assert.strictEqual(env.sent[0].body.c, undefined, 'premier hit : rien n etait pose');
  assert.strictEqual(env.sent[1].body.c, 1, 'le hit suivant voit le cookie pose par le premier');
});

test('expiration glissante : chaque hit repousse les 10 minutes', function () {
  var env = makeEnv();
  env.win.qm('inscription');
  var writes = visitWrites(env);
  assert.strictEqual(writes.length, 2, 'un rafraichissement par hit, evenements compris');
  writes.forEach(function (raw) {
    assert.ok(/(^|;)max-age=600(;|$)/.test(raw), 'dix minutes : ' + raw);
    assert.ok(/;path=\/(;|$)/.test(raw), 'tout le site : ' + raw);
    assert.ok(/;samesite=lax/.test(raw), raw);
    assert.ok(/;secure/.test(raw), 'page en https : ' + raw);
  });
});

test('en http, le cookie de visite n est pas secure (il serait rejete)', function () {
  var env = makeEnv({
    attrs: { 'data-dev': 'true' },
    location: { protocol: 'http:', host: 'localhost:8000', hostname: 'localhost',
                pathname: '/', search: '', hash: '' }
  });
  assert.strictEqual(visitWrites(env).length, 1);
  assert.strictEqual(visitWrites(env)[0].indexOf(';secure'), -1);
});

test('personne exclue : on n ecrit RIEN chez qui a refuse', function () {
  var env = makeEnv({ cookies: { qm_ignore: '1' } });
  assert.strictEqual(env.sent.length, 0);
  assert.strictEqual(env.cookies.qm_visit, undefined);
  assert.deepStrictEqual(env.cookieWrites, []);
});

test('?qm_ignore=1 : le refus se pose, la visite non', function () {
  var env = makeEnv({
    location: { protocol: 'https:', host: 'monsite.fr', hostname: 'monsite.fr',
                pathname: '/', search: '?qm_ignore=1', hash: '' }
  });
  assert.strictEqual(env.cookies.qm_ignore, '1');
  assert.strictEqual(env.cookies.qm_visit, undefined, 'la visite qui pose le refus n ouvre pas de visite');
});

test('aucun hit emis : aucun cookie de visite', function () {
  var local = makeEnv({ location: { protocol: 'http:', host: 'localhost:8000',
    hostname: 'localhost', pathname: '/', search: '', hash: '' } });
  assert.strictEqual(local.cookies.qm_visit, undefined, 'localhost n est pas mesure');

  var dnt = makeEnv({ attrs: { 'data-dnt': 'respect' }, dnt: true });
  assert.strictEqual(dnt.cookies.qm_visit, undefined, 'DNT respecte : rien envoye, rien ecrit');
});

test('valeur constante : rien qui distingue un navigateur d un autre', function () {
  assert.strictEqual(makeEnv().cookies.qm_visit, '1');
  assert.strictEqual(makeEnv().cookies.qm_visit, '1');
});

test('le cookie de visite n ecrase aucun cookie du site hote', function () {
  var env = makeEnv({ cookies: { session: 'abc' } });
  assert.strictEqual(env.cookies.session, 'abc');
  assert.strictEqual(env.cookies.qm_visit, '1');
});

test('le cookie de visite ne se confond pas avec un cookie voisin', function () {
  var env = makeEnv({ cookies: { autre_qm_visit: '1', qm_visit_bis: '1' } });
  assert.strictEqual(env.sent[0].body.c, undefined, 'seul le nom exact vaut visite en cours');
});

console.log('\n' + passed + ' tests OK');
