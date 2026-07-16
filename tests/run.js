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
    docListeners: docListeners, winListeners: winListeners
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

test('data-site manquant : le script ne fait rien et ne plante pas', function () {
  var env = makeEnv({ attrs: { 'data-site': null } });
  assert.strictEqual(env.sent.length, 0);
});

console.log('\n' + passed + ' tests OK');
