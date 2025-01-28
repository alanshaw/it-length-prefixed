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

  /*
  it('should not encode message data that is too long PROMISE', async () => {
    const customMaxDataLength = MAX_DATA_LENGTH
    const input = new Uint8Array(customMaxDataLength + 1) // Create a buffer larger than the max allowed

    // Wrap in a Promise to ensure compatibility with async assertions
    await expect(
      Promise.resolve().then(() => lp.encode.single(input))
    ).to.eventually.be.rejected.with.property('code', 'ERR_MSG_DATA_TOO_LONG')
    // ).to.eventually.be.rejectedWith(InvalidDataLengthError).and.have.property('code', 'ERR_MSG_DATA_TOO_LONG')
  })
  */

  it('should not encode message data that is too long', () => {
    const customMaxDataLength = MAX_DATA_LENGTH
    const input = new Uint8Array(customMaxDataLength + 1) // Create a buffer larger than the max allowed

    try {
      lp.encode.single(input)
      throw new Error('Expected error not thrown')
    } catch (err: any) {
      expect(err).to.be.an.instanceof(InvalidDataLengthError)
      expect(err.code).to.equal('ERR_MSG_DATA_TOO_LONG')
    }
  })

  it('should throw an error if message data exceeds custom maxDataLength', () => {
    const customMaxDataLength = 512 // Set a custom max data length for the test
    const input = new Uint8Array(customMaxDataLength + 1) // Create a buffer larger than the custom max allowed

    const options = { maxDataLength: customMaxDataLength } // Set maxDataLength in encoder options

    try {
      lp.encode.single(input, options) // Call encode.single with custom maxDataLength and expect it to throw
      throw new Error('Expected error not thrown')
    } catch (err: any) {
      expect(err).to.be.an.instanceof(InvalidDataLengthError)
      expect(err.code).to.equal('ERR_MSG_DATA_TOO_LONG') // Check the error code
    }
  })

  it('should encode data within custom maxDataLength', () => {
    const customMaxDataLength = 512 // Set a custom max data length for the test
    const input = new Uint8Array(customMaxDataLength) // Create a buffer within the allowed size

    const options = { maxDataLength: customMaxDataLength } // Set maxDataLength in encoder options
    const output = lp.encode.single(input, options) // Call encode.single with options

    const length = varint.decode(output)
    // expect(length).to.equal(input.length)
    expect(input).to.have.lengthOf(length)
    // expect(output.slice(varint.encodingLength(output.byteLength))).to.deep.equal(input)
    expect(input).to.equalBytes(output.slice(varint.encodingLength(output.byteLength)))
  })
})
