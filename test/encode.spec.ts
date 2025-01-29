import { expect } from 'aegir/chai'
import all from 'it-all'
import { pipe } from 'it-pipe'
import randomInt from 'random-int'
import * as varint from 'uint8-varint'
import { Uint8ArrayList } from 'uint8arraylist'
import { MAX_DATA_LENGTH } from '../src/constants.js'
import * as lp from '../src/index.js'
import { times, someBytes } from './helpers/index.js'
import { int32BEEncode } from './helpers/int32BE-encode.js'

describe('encode', () => {
  it('should encode length as prefix', async () => {
    const input = await Promise.all(times(randomInt(1, 10), someBytes))
    const output = await pipe(
      input,
      (source) => lp.encode(source),
      async (source) => all(source)
    )

    let inputIndex = 0

    for (let i = 0; i < output.length; i += 2, inputIndex++) {
      const prefix = output[i]
      const data = output[i + 1]

      const length = varint.decode(prefix)
      expect(length).to.equal(data.length)
      expect(data).to.deep.equal(input[inputIndex])
    }
  })

  it('should encode zero length as prefix', async () => {
    const input = [new Uint8Array(0)]
    const output = await pipe(input, (source) => lp.encode(source), async (source) => all(source))

    let inputIndex = 0

    for (let i = 0; i < output.length; i += 2, inputIndex++) {
      const prefix = output[i]
      const data = output[i + 1]

      const length = varint.decode(prefix)
      expect(length).to.equal(data.length)
      expect(data).to.deep.equal(input[inputIndex])
    }
  })

  it('should encode with custom length encoder (int32BE)', async () => {
    const input = await Promise.all(times(randomInt(1, 100), someBytes))
    const output = await pipe(
      input,
      (source) => lp.encode(source, { lengthEncoder: int32BEEncode }),
      async (source) => all(source)
    )

    let inputIndex = 0

    for (let i = 0; i < output.length; i += 2, inputIndex++) {
      const prefix = output[i]
      const data = output[i + 1]

      const view = new DataView(prefix.buffer)
      const length = view.getUint32(0, false)
      expect(length).to.equal(data.length)
      expect(length).to.equal(input[inputIndex].length)
    }
  })

  it('should only yield uint8arrays', async () => {
    const output = await pipe(
      [new Uint8Array(10), new Uint8ArrayList(new Uint8Array(20))],
      (source) => lp.encode(source),
      async (source) => all(source)
    )

    // length, data, length, data
    expect(output).to.have.lengthOf(4)

    for (let i = 0; i < output.length; i++) {
      expect(output[i]).to.be.an.instanceOf(Uint8Array)
    }
  })

  it('should not encode message data that is too long', async () => {
    const input = [new Uint8Array(MAX_DATA_LENGTH + 1)] // Create a buffer that exceeds the max length

    await expect(pipe(
      input,
      (source) => lp.encode(source),
      async (source) => all(source)
    )).to.eventually.be.rejected.with.property('code', 'ERR_MSG_DATA_TOO_LONG')
  })

  it('should throw an error if message data exceeds custom maxDataLength', async () => {
    const customMaxDataLength = 512 // Set a custom max data length
    const input = [new Uint8Array(customMaxDataLength + 1)] // Create a buffer larger than the custom limit

    const options = { maxDataLength: customMaxDataLength } // Set maxDataLength in options

    await expect(pipe(
      input,
      (source) => lp.encode(source, options),
      async (source) => all(source)
    )).to.eventually.be.rejected.with.property('code', 'ERR_MSG_DATA_TOO_LONG')
  })

  it('should encode data within custom maxDataLength', async () => {
    const customMaxDataLength = 512 // Set a custom max data length

    // Generate a Uint8Array filled with random bytes
    const input = new Uint8Array(customMaxDataLength)
    crypto.getRandomValues(input)

    const options = { maxDataLength: customMaxDataLength } // Set maxDataLength in options
    const output = await pipe(
      [input], // Input should be wrapped in an array (iterable source)
      (source) => lp.encode(source, options),
      async (source) => all(source)
    )

    let inputIndex = 0

    let i = 0
    while (i < output.length) {
      const prefix = output[i]
      const data = output[i + 1]

      const length = varint.decode(prefix)
      expect(data).to.have.lengthOf(length)
      expect(data).to.equalBytes(input.slice(inputIndex, inputIndex + length))

      inputIndex += length
      i += 2 // Move to next pair (prefix, data)
    }
  })
})
