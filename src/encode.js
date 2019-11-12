'use strict'

const Varint = require('varint')
const { Buffer } = require('buffer')
const BufferList = require('bl/BufferList')

const MIN_POOL_SIZE = 147 // Varint.encode(Number.MAX_VALUE).length
const DEFAULT_POOL_SIZE = 10 * 1024

// Encode the passed length `value` to the `target` buffer at the given `offset`
const lengthEncoder = (value, target, offset) => {
  const ret = Varint.encode(value, target, offset)
  lengthEncoder.bytes = Varint.encode.bytes
  // If no target, create Buffer from returned array
  return target || Buffer.from(ret)
}

function encode (options) {
  options = options || {}
  options.lengthEncoder = options.lengthEncoder || lengthEncoder
  options.poolSize = Math.max(options.poolSize || DEFAULT_POOL_SIZE, MIN_POOL_SIZE)

  return source => (async function * () {
    let pool = Buffer.alloc(options.poolSize)
    let poolOffset = 0

    for await (const chunk of source) {
      options.lengthEncoder(chunk.length, pool, poolOffset)
      const encodedLength = pool.slice(poolOffset, poolOffset + options.lengthEncoder.bytes)
      poolOffset += options.lengthEncoder.bytes

      if (pool.length - poolOffset < MIN_POOL_SIZE) {
        pool = Buffer.alloc(options.poolSize)
        poolOffset = 0
      }

      yield new BufferList().append(encodedLength).append(chunk)
      // yield Buffer.concat([encodedLength, chunk])
    }
  })()
}

encode.single = (chunk, options) => {
  options = options || {}
  options.lengthEncoder = options.lengthEncoder || lengthEncoder
  return new BufferList([options.lengthEncoder(chunk.length), chunk])
}

module.exports = encode
module.exports.MIN_POOL_SIZE = MIN_POOL_SIZE
module.exports.DEFAULT_POOL_SIZE = DEFAULT_POOL_SIZE
