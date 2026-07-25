/*
 * Synchronise les copies servies de qm.js depuis la source de vérité.
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
var source = fs.readFileSync(sourcePath);
var checkOnly = process.argv.indexOf('--check') !== -1;
var drifted = [];

targetPaths.forEach(function (targetPath) {
  var matches = fs.existsSync(targetPath) && fs.readFileSync(targetPath).equals(source);

  if (matches) return;

  if (checkOnly) {
    drifted.push(path.relative(repositoryRoot, targetPath));
    return;
  }

  fs.copyFileSync(sourcePath, targetPath);
  console.log('synchronisé : ' + path.relative(repositoryRoot, targetPath));
});

if (drifted.length > 0) {
  drifted.forEach(function (targetPath) {
    console.error('dérive : ' + targetPath);
  });
  console.error('Exécuter : node packages/tracker-js/sync.js');
  process.exitCode = 1;
}
