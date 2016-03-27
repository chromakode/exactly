var fs = require('fs')
var path = require('path')
var expect = require('expect')
var exec = require('child_process').exec
var Promise = require('any-promise')

var FIXTURES_DIR = path.join(__dirname, 'fixtures')
var WORK_DIR = path.join(__dirname, 'work')

function shell (cmd, options) {
  return new Promise(function (resolve, reject) {
    exec(cmd, options, function (er, stdout, stderr) {
      var result = {
        stdout: stdout,
        stderr: stderr
      }
      if (er) {
        result.error = er
        return reject(result)
      }
      resolve(result)
    })
  })
}

function shellWork (cmd) {
  return shell(cmd, { cwd: WORK_DIR })
}

function shellExactly (args) {
  var parts = []
  if (process.env.WITH_COVERAGE === 'y') {
    // TODO: this is slow because istanbul must re-instrument each time. is there a way to cache it?
    parts.push('../../node_modules/.bin/istanbul cover --report none --print none --include-pid --dir ../../coverage --root ../../')
  }
  parts.push('../../index.js')
  if (process.env.WITH_COVERAGE === 'y') {
    parts.push('--')
  }
  parts.push(args)
  return shellWork(parts.join(' '))
}

function readFile (path) {
  return new Promise(function (resolve, reject) {
    fs.readFile(path, 'utf8', function (er, data) {
      if (er) {
        return reject(er)
      }
      resolve(data)
    })
  })
}

describe('exactly', function () {
  this.timeout(60 * 1000)

  before(function () {
    return shell('npm cache clean')
  })

  function clearWorkDir () {
    return shell('rm -rf ' + WORK_DIR + ' && mkdir -p ' + WORK_DIR + '/node_modules')
  }
  beforeEach(clearWorkDir)
  afterEach(clearWorkDir)

  it('shrinkwraps multiple modules correctly', function () {
    return shellWork('../../node_modules/.bin/npm install min-document@2.18.0 dom-walk@0.1.1')
      .then(function () { return shellWork('../../node_modules/.bin/npm install dom-walk@0.0.1') })
      .then(function () { return shellExactly('shrinkwrap') })
      .then(function () {
        return Promise.all([
          readFile(path.join(WORK_DIR, 'npm-shrinkwrap.json')),
          readFile(path.join(FIXTURES_DIR, 'expected-npm-shrinkwrap.json'))
        ])
      })
      .then(function (results) {
        expect(results[0]).toEqual(results[1])
      })
  })

  it('aborts shrinkwrap upon error', function () {
    return shellWork('mkdir npm-shrinkwrap.json')
      .then(function () { return shellExactly('shrinkwrap') })
      .then(
        function success () {
          throw Error('shrinkwrap should not succeed')
        },
        function fail (result) {
          expect(result.stderr).toInclude('npm ERR! eisdir EISDIR: illegal operation on a directory')
          return Promise.resolve()
        }
      )
  })

  it('aborts installing if no shrinkwrap file exists', function () {
    return shellExactly('install dom-walk@0.1.1')
      .then(
        function success () {
          throw Error('install should not succeed')
        },
        function fail (result) {
          expect(result.stderr).toInclude('npm ERR! exactly: failed to read npm-shrinkwrap.json. Error: ENOENT: no such file or directory, open \'npm-shrinkwrap.json\'')
        }
      )
  })

  it('aborts installing if no shrinkwrap exactHashes data exists', function () {
    return shell('cp ' + path.join(FIXTURES_DIR, 'vanilla-npm-shrinkwrap.json') + ' ' + path.join(WORK_DIR, 'npm-shrinkwrap.json'))
      .then(function () { return shellExactly('install dom-walk@0.1.1') })
      .then(
        function success () {
          throw Error('install should not succeed')
        },
        function fail (result) {
          expect(result.stderr).toInclude('npm ERR! exactly: missing exactlyHashes in npm-shrinkwrap.json. aborting.')
        }
      )
  })

  describe('with an exactly shrinkwrap', function () {
    beforeEach(function () {
      return shell('cp ' + path.join(FIXTURES_DIR, 'expected-npm-shrinkwrap.json') + ' ' + path.join(WORK_DIR, 'npm-shrinkwrap.json'))
    })

    it('successfully installs known valid remote packages', function () {
      return shellExactly('install -d min-document@2.18.0 dom-walk@0.0.1')
        .then(function (result) {
          expect(result.stderr).toInclude('npm info exactly shasum matched: 094ece4bc59189df7d3da1dd785c763e14c5e664')
          expect(result.stderr).toInclude('npm info exactly shasum matched: 23051234b0ae8cc52af8ec6fbb8b4857e442842d')
          expect(result.stderr).toInclude('npm info exactly shasum matched: 672226dc74c8f799ad35307df936aba11acd6018')
        })
    })

    it('aborts before installing an unknown remote package', function () {
      return shellExactly('install dom-walk@0.1.0')
        .then(
          function success () {
            throw Error('install should not succeed')
          },
          function fail (result) {
            expect(result.stderr).toInclude([
              'npm ERR! exactly: mismatched package hash: dom-walk@0.1.0',
              'npm ERR!     expected: undefined',
              'npm ERR!     got: d4544e7d2e7eb36db3923a3d12e8b20d45749ff0'
            ].join('\n'))
            return Promise.resolve()
          }
        )
    })

    it('successfully installs a known valid local package', function () {
      return shellWork('wget `npm v dom-walk@0.1.1 dist.tarball`')
        .then(function () { return shellExactly('install -d ./dom-walk-0.1.1.tgz') })
        .then(function (result) {
          expect(result.stderr).toInclude('npm info exactly shasum matched: 672226dc74c8f799ad35307df936aba11acd6018')
        })
    })

    it('aborts before installing an invalid local package', function () {
      return shellWork('wget `npm v dom-walk@0.1.1 dist.tarball`')
        .then(function () { return shellWork('echo a >> ./dom-walk-0.1.1.tgz') })
        .then(function () { return shellExactly('install ./dom-walk-0.1.1.tgz') })
        .then(
          function success () {
            throw Error('install should not succeed')
          },
          function fail (result) {
            expect(result.stderr).toInclude([
              'npm ERR! exactly: mismatched package hash: dom-walk@0.1.1',
              'npm ERR!     expected: 672226dc74c8f799ad35307df936aba11acd6018',
              'npm ERR!     got: 8374d305f3ed9f0b633eb5fa3c1659b3ccdc461e'
            ].join('\n'))
            return Promise.resolve()
          }
        )
    })
  })
})
