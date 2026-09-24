/*
 * Synchronise les copies servies de qm.js depuis la source de vérité.
 *
 * Les copies servies ne sont PAS identiques à la source : elles perdent les
 * commentaires de bloc qui occupent des lignes entières, sauf l'en-tête de
 * licence qui s'ouvre par une barre, une étoile et un point d'exclamation.
 * Ces commentaires pesaient près de 740 octets gzip sur les 4 Ko promis,
 * pour des lecteurs du dépôt et non du navigateur. La source les garde tous.
 * Les commentaires de ligne (//) restent : les retirer sans analyseur
 * risquerait d'entamer une chaîne ou une expression régulière.
 *
 * La même règle est écrite en PHP dans TrackerSyncTest : si les deux
 * divergent, l'une des deux gardes rougit.
 *
 * Usage :
 *   node packages/tracker-js/sync.js
 *   node packages/tracker-js/sync.js --check
 */
'use strict';

var fs = require('fs');
var path = require('path');

var repositoryRoot = path.resolve(__dirname, '..', '..');
var sourcePath = path.join(__dirname, 'tracker.js');
var targetPaths = [
  path.join(repositoryRoot, 'apps', 'platform', 'public', 'qm.js'),
  path.join(repositoryRoot, 'packages', 'wordpress-plugin', 'assets', 'qm.js')
];

function servedCopy(source) {
  return source.replace(/^[ \t]*\/\*(?!!)[\s\S]*?\*\/[ \t]*\n/gm, '');
}

function main() {
  var served = servedCopy(fs.readFileSync(sourcePath, 'utf8'));
  var checkOnly = process.argv.indexOf('--check') !== -1;
  var drifted = [];

  targetPaths.forEach(function (targetPath) {
    var matches = fs.existsSync(targetPath) && fs.readFileSync(targetPath, 'utf8') === served;

    if (matches) return;

    if (checkOnly) {
      drifted.push(path.relative(repositoryRoot, targetPath));
      return;
    }

    fs.writeFileSync(targetPath, served);
    console.log('synchronisé : ' + path.relative(repositoryRoot, targetPath));
  });

  if (drifted.length > 0) {
    drifted.forEach(function (targetPath) {
      console.error('dérive : ' + targetPath);
    });
    console.error('Exécuter : node packages/tracker-js/sync.js');
    process.exitCode = 1;
  }
}

module.exports = { servedCopy: servedCopy };

if (require.main === module) main();
