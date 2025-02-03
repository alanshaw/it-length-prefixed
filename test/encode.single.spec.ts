import { expect } from 'aegir/chai'
import * as varint from 'uint8-varint'
import { MAX_DATA_LENGTH } from '../src/constants.js'
import { InvalidDataLengthError } from '../src/errors.js'
import * as lp from '../src/index.js'
import { someBytes } from './helpers/index.js'
import { int32BEEncode } from './helpers/int32BE-encode.js'

describe('encode.single', () => {
  it('should encode length as prefix', () => {
    const input = someBytes()
    const output = lp.encode.single(input)

    const length = varint.decode(output)
    expect(length).to.equal(input.length)
    expect(output.slice(varint.encodingLength(output.byteLength))).to.deep.equal(input)
  })

  it('should encode zero length as prefix', () => {
    const input = new Uint8Array(0)
    const output = lp.encode.single(input)

    const length = varint.decode(output)
    expect(length).to.equal(input.length)
    expect(output.slice(varint.encodingLength(output.byteLength))).to.deep.equal(input)
  })

  it('should encode with custom length encoder (int32BE)', () => {
    const input = someBytes()
    const output = lp.encode.single(input, { lengthEncoder: int32BEEncode }).subarray()

    const view = new DataView(output.buffer, output.byteOffset, output.byteLength)
    const length = view.getInt32(0, false)
    expect(length).to.equal(input.length)
  })

  it('should not encode message data that is too long', () => {
    const input = new Uint8Array(MAX_DATA_LENGTH + 1) // Create a buffer larger than the max allowed

    expect(() => lp.encode.single(input)).to.throw(InvalidDataLengthError).with.property('code', 'ERR_MSG_DATA_TOO_LONG')
  })

  it('should throw an error if message data exceeds custom maxDataLength', () => {
    const customMaxDataLength = 512 // Set a custom max data length for the test
    const input = new Uint8Array(customMaxDataLength + 1) // Create a buffer larger than the custom max allowed

    const options = { maxDataLength: customMaxDataLength } // Set maxDataLength in encoder options

    expect(() => lp.encode.single(input, options)).to.throw(InvalidDataLengthError).with.property('code', 'ERR_MSG_DATA_TOO_LONG')
  })

  it('should encode data within custom maxDataLength', () => {
    const customMaxDataLength = 512 // Set a custom max data length for the test
    const input = crypto.getRandomValues(new Uint8Array(customMaxDataLength)) // Random bytes

    const options = { maxDataLength: customMaxDataLength } // Set maxDataLength in encoder options
    const output = lp.encode.single(input, options) // Call encode.single with options

    const length = varint.decode(output)
    expect(input).to.have.lengthOf(length)
    expect(input).to.equalBytes(output.slice(varint.encodingLength(output.byteLength)))
  })
})
