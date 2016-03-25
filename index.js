#!/usr/bin/env node
var fs = require('fs')
var path = require('path')

var _shinkwrapData
function getShrinkwrapData (cache) {
  if (cache === false || !_shinkwrapData) {
    try {
      _shinkwrapData = JSON.parse(fs.readFileSync('npm-shrinkwrap.json', 'utf8'))
    } catch (er) {
      throw new Error('exactly: failed to read npm-shrinkwrap.json. ' + er)
    }
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

function afterAdd (er, data, next) {
  if (er) {
    return next(er, data)
  }

  var log = require('npm/node_modules/npmlog')

  try {
    var pd = getShrinkwrapData()
  } catch (pdErr) {
    return next(pdErr)
  }

  if (!pd.exactlyHashes) {
    return next(new Error('exactly: missing exactlyHashes in npm-shrinkwrap.json. aborting.'))
  }

  var expectedHash = pd.exactlyHashes[data.name]
  if (expectedHash !== data._shasum) {
    return next(new Error('exactly: mismatched package hash: ' + data.name + '\n    expected: ' + expectedHash + '\n    got: ' + data._shasum))
  }

  log.info('exactly', 'shasum matched: ' + expectedHash)

  next(er, data)
}

function walkTreeForHashes (topNode) {
  var hashes = {}
  function visit (node) {
    if (node !== topNode) {
      hashes[node.package.name] = node.package._shasum
    }
    node.children.forEach(visit)
  }
  visit(topNode)
  return hashes
}

function afterShrinkWrap (er, data, next) {
  next(er, data)

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
patchModule('npm/lib/cache/add-remote-tarball', afterAdd)
patchModule('npm/lib/cache/add-named', afterAdd)
patchModule('npm/lib/cache/add-local', afterAdd)

// monkeypatch npm shrinkwrap command
var npm = require('npm')
patchCb(npm, 'load', function (er, data, next) {
  patchModule('npm/lib/shrinkwrap', afterShrinkWrap)
  next(er, data)
})

// run npm cli
require('npm/bin/npm-cli.js')
