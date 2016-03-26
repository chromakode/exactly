# Exactly

[![Build Status][travis-image]][travis-url]
[![Coverage Status][coverage-image]][coverage-url]
[![npm][version-image]][version-url]
[![npm][license-image]][license-url]

Exactly extends npm to shrinkwrap dependencies by their SHA1 hash. This ensures
that package data downloaded by npm exactly matches the packages at the time of
shrinkwrapping.

This project is intended as a proof of concept. It's hacky and the approach it
takes in monkeypatching npm internals is fragile. This is a quick and dirty way
to achieve this functionality to gain experience with it in practice.


## Usage

Run `exactly` with the same commands and arguments as the `npm` binary.

Use `npm` during development. Then use `exactly shrinkwrap` and `exactly
install` in production.


### `exactly shrinkwrap`

Exactly will run `npm shrinkwrap` and add an `exactlyHashes` property to your
`npm-shrinkwrap.json`.

```
# exactly shrinkwrap
npm info it worked if it ends with ok
npm info using npm@3.8.3
npm info using node@v4.4.0
wrote npm-shrinkwrap.json
added exactlyHashes to npm-shrinkwrap.json
{
  "qs@6.1.0": "ec1d1626b24278d99f0fdf4549e524e24eceeb26"
}
npm info ok
```


### `exactly install`

Exactly will run `npm install` and check the hash of each package installed
from npm or local directories. It will output an "npm info exactly" log line
for each package it verifies.

```
# exactly install qs
npm info it worked if it ends with ok
npm info using npm@3.8.3
npm info using node@v4.4.0
npm info addNameTag [ 'qs', 'latest' ]
npm info exactly shasum matched: ec1d1626b24278d99f0fdf4549e524e24eceeb26
npm info lifecycle qs@6.1.0~preinstall: qs@6.1.0
npm info linkStuff qs@6.1.0
npm info lifecycle qs@6.1.0~install: qs@6.1.0
npm info lifecycle qs@6.1.0~postinstall: qs@6.1.0
/tmp/exactly
`-- qs@6.1.0

npm info ok
```

[travis-image]: https://img.shields.io/travis/chromakode/exactly/master.svg?style=flat-square
[travis-url]: https://travis-ci.org/chromakode/exactly
[coverage-image]: https://img.shields.io/coveralls/chromakode/exactly/master.svg?style=flat-square
[coverage-url]: https://coveralls.io/github/chromakode/exactly?branch=master
[version-image]: https://img.shields.io/npm/v/exactly.svg?style=flat-square
[version-url]: https://www.npmjs.com/package/exactly
[license-image]: https://img.shields.io/npm/l/exactly.svg?style=flat-square
[license-url]: https://github.com/chromakode/exactly/blob/master/LICENSE
