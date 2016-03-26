#!/usr/bin/env node
var fs = require('fs')
var path = require('path')
var log = require('npm/node_modules/npmlog')

var _shinkwrapData
function getShrinkwrapData (cache) {
  if (cache === false || !_shinkwrapData) {
    log.silly('exactly', 'loading shrinkwrap data')
    try {
      _shinkwrapData = JSON.parse(fs.readFileSync('npm-shrinkwrap.json', 'utf8'))
    } catch (er) {
      throw new Error('exactly: failed to read npm-shrinkwrap.json. ' + er)
    }
  } else {
    log.silly('exactly', 'using cached shrinkwrap data')
  }
  return _shinkwrapData
}

function patchCb (obj, prop, cb) {
  var originalFunc = obj[prop]
  obj[prop] = function () {
    var args = Array.prototype.slice.call(arguments, 0, -1)
    var origCb = arguments[arguments.length - 1]
    args.push(function (er, data) {
      cb(er, data, origCb)
    })
    originalFunc.apply(null, args)
  }
}

function patchModule (module, cb) {
  require(module)
  patchCb(require.cache[require.resolve(module)], 'exports', cb)
}

function afterAdd (kind, er, data, next) {
  if (er) {
    return next(er, data)
  }

  log.silly('exactly', 'running hook after ' + kind)

  try {
    var pd = getShrinkwrapData()
  } catch (pdErr) {
    return next(pdErr)
  }

  if (!pd.exactlyHashes) {
    return next(new Error('exactly: missing exactlyHashes in npm-shrinkwrap.json. aborting.'))
  }

  var pkgName = data.name + '@' + data.version
  var expectedHash = pd.exactlyHashes[pkgName]
  if (expectedHash !== data._shasum) {
    return next(new Error('exactly: mismatched package hash: ' + pkgName + '\n    expected: ' + expectedHash + '\n    got: ' + data._shasum))
  }

  log.info('exactly', 'shasum matched: ' + expectedHash)

  next(er, data)
}

// these dummy functions allow coverage testing to verify that each monkeypatch
// is actually used and tested
function afterAddRemoteTarball (er, data, next) { afterAdd('add-remote-tarball', er, data, next) }
function afterAddNamed (er, data, next) { afterAdd('add-named', er, data, next) }
function afterAddLocal (er, data, next) { afterAdd('add-local', er, data, next) }

function walkTreeForHashes (topNode) {
  var hashes = {}
  function visit (node) {
    if (node !== topNode) {
      hashes[node.package.name + '@' + node.package.version] = node.package._shasum
    }
    node.children.forEach(visit)
  }
  visit(topNode)
  return hashes
}

function afterShrinkWrap (er, data, next) {
  next(er, data)
  if (er) {
    return
  }

  log.silly('exactly', 'running hook after shrinkwrap')

  var readPackageTree = require('npm/node_modules/read-package-tree')
  var dir = path.resolve(npm.dir, '..')
  readPackageTree(dir, function (er2, tree) {
    if (er2) {
      console.error(er2)
      process.exit()
    }

    var hashes = walkTreeForHashes(tree)
    var newShrinkwrapData = getShrinkwrapData(false)
    newShrinkwrapData.exactlyHashes = hashes

    var data = JSON.stringify(newShrinkwrapData, null, 2) + '\n'
    fs.writeFileSync('npm-shrinkwrap.json', data, 'utf8')
    console.log('added exactlyHashes to npm-shrinkwrap.json')
    console.log(JSON.stringify(hashes, null, 2))
  })
}

// monkeypatch npm package fetches
patchModule('npm/lib/cache/add-remote-tarball', afterAddRemoteTarball)
patchModule('npm/lib/cache/add-named', afterAddNamed)
patchModule('npm/lib/cache/add-local', afterAddLocal)

// monkeypatch npm shrinkwrap command
var npm = require('npm')
patchCb(npm, 'load', function (er, data, next) {
  log.silly('exactly', 'running hook after load')
  patchModule('npm/lib/shrinkwrap', afterShrinkWrap)
  next(er, data)
})

// run npm cli
require('npm/bin/npm-cli.js')
