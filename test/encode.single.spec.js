/* eslint-env mocha */
'use strict'

const { expect } = require('chai')
const randomInt = require('random-int')
const randomBytes = require('random-bytes')
const Varint = require('varint')

const lp = require('../')
const someBytes = n => randomBytes(randomInt(1, n || 32))

describe('encode.single', () => {
  it('should encode length as prefix', async () => {
    const input = await someBytes()
    const output = lp.encode.single(input)

    const length = Varint.decode(output.slice())
    expect(length).to.equal(input.length)
    expect(output.slice(Varint.decode.bytes)).to.deep.equal(input)
  })

  it('should encode zero length as prefix', () => {
    const input = Buffer.alloc(0)
    const output = lp.encode.single(input)

    const length = Varint.decode(output.slice())
    expect(length).to.equal(input.length)
    expect(output.slice(Varint.decode.bytes)).to.deep.equal(input)
  })

  it('should encode with custom length encoder (int32BE)', async () => {
    const input = await someBytes()

    const lengthEncoder = (value, target, offset) => {
      target = target || Buffer.allocUnsafe(4)
      target.writeInt32BE(value, offset)
      return target
    }
    lengthEncoder.bytes = 4 // Always because fixed length

    const output = lp.encode.single(input, { lengthEncoder })

    const length = output.readInt32BE(0)
    expect(length).to.equal(input.length)
  })
})
