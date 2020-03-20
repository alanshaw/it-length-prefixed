'use strict'

const randomInt = require('random-int')
const randomBytes = require('random-bytes')

module.exports.times = (n, fn) => Array.from(Array(n), fn)
module.exports.someBytes = n => randomBytes(randomInt(1, n || 32))
