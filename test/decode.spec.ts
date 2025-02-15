import { expect } from 'aegir/chai'
import randomBytes from 'iso-random-stream/src/random.js'
import all from 'it-all'
import { block } from 'it-block'
import { pipe } from 'it-pipe'
import defer from 'p-defer'
import randomInt from 'random-int'
import * as varint from 'uint8-varint'
import { Uint8ArrayList } from 'uint8arraylist'
import { concat as uint8ArrayConcat } from 'uint8arrays/concat'
import { MAX_LENGTH_LENGTH, MAX_DATA_LENGTH } from '../src/constants.js'
import * as lp from '../src/index.js'
import { times } from './helpers/index.js'
import { int32BEDecode } from './helpers/int32BE-decode.js'

describe('decode', () => {
  it('should decode single message', async () => {
    const byteLength = randomInt(1, 64)
    const bytes = randomBytes(byteLength)

    const input = uint8ArrayConcat([
      Uint8Array.from(varint.encode(byteLength)),
      bytes
    ])

    const [output] = await pipe([input], (source) => lp.decode(source), async (source) => all(source))
    expect(output.slice(-byteLength)).to.deep.equal(bytes)
  })

  it('should decode single message sent in small chunks', async () => {
    const byteLength = 512
    const bytes = randomBytes(byteLength)

    const input = new Uint8ArrayList(
      varint.encode(byteLength),
      bytes
    )

    const [output] = await pipe([input], block(1), (source) => lp.decode(source), async (source) => all(source))

    expect(output.slice(-byteLength)).to.deep.equal(bytes)
  })

  it('should decode empty single message', async () => {
    const input = uint8ArrayConcat([
      Uint8Array.from(varint.encode(0)),
      new Uint8Array()
    ])

    const [output] = await pipe([input], (source) => lp.decode(source), async (source) => all(source))
    expect(output.slice()).to.equalBytes(new Uint8Array(0))
  })

  it('should decode single message as Uint8ArrayList', async () => {
    const byteLength = randomInt(1, 64)
    const bytes = randomBytes(byteLength)

    const input = new Uint8ArrayList(
      Uint8Array.from(varint.encode(byteLength)),
      bytes
    )

    const [output] = await pipe([input], (source) => lp.decode(source), async (source) => all(source))
    expect(output.slice(-byteLength)).to.deep.equal(bytes)
  })

  it('should decode fragmented length single message', async () => {
    const byteLength = 128 // for 2 byte varint
    const bytes = randomBytes(byteLength)

    const input = [
      Uint8Array.from(varint.encode(byteLength).slice(0, 1)),
      uint8ArrayConcat([
        Uint8Array.from(varint.encode(byteLength).slice(1)),
        bytes
      ])
    ]

    const [output] = await pipe(input, (source) => lp.decode(source), async (source) => all(source))
    expect(output.slice(-byteLength)).to.deep.equal(bytes)
  })

  it('should decode fragmented data single message', async () => {
    const byteLength = randomInt(2, 64)
    const bytes = randomBytes(byteLength)

    const input = [
      uint8ArrayConcat([
        Uint8Array.from(varint.encode(byteLength)),
        bytes.slice(0, 1)
      ]),
      bytes.slice(1)
    ]

    const [output] = await pipe(input, (source) => lp.decode(source), async (source) => all(source))
    expect(output.slice(-byteLength)).to.deep.equal(bytes)
  })

  it('should not decode message length that is too long', async () => {
    // A value < 0x80 signifies end of varint so pass buffers of >= 0x80
    // so that it will keep throwing a RangeError until we reach the max length
    const lengths = times(5, () => new Uint8Array(MAX_LENGTH_LENGTH / 4).fill(0x80))
    const bytes = randomBytes(randomInt(2, 64))

    const input = [...lengths, bytes]

    await expect(
      pipe(input, (source) => lp.decode(source), async (source) => all(source))
    ).to.eventually.be.rejected.with.property('code', 'ERR_MSG_LENGTH_TOO_LONG')
  })

  it('should not decode message data that is too long', async () => {
    const byteLength = MAX_DATA_LENGTH + 1
    const bytes = randomBytes(byteLength)

    const input = [
      Uint8Array.from(varint.encode(byteLength)),
      bytes
    ]

    await expect(
      pipe(input, (source) => lp.decode(source), async (source) => all(source))
    ).to.eventually.be.rejected.with.property('code', 'ERR_MSG_DATA_TOO_LONG')
  })

  it('should decode two messages chunked across boundary', async () => {
    const byteLength0 = randomInt(2, 64)
    const bytes0 = randomBytes(byteLength0)

    const byteLength1 = randomInt(1, 64)
    const bytes1 = randomBytes(byteLength1)

    const input = [
      uint8ArrayConcat([
        Uint8Array.from(varint.encode(byteLength0)),
        bytes0.slice(0, 1)
      ]),
      uint8ArrayConcat([
        bytes0.slice(1),
        Uint8Array.from(varint.encode(byteLength1)),
        bytes1
      ])
    ]

    const output = await pipe(input, (source) => lp.decode(source), async (source) => all(source))
    expect(output[0].slice(-byteLength0)).to.deep.equal(bytes0)
    expect(output[1].slice(-byteLength1)).to.deep.equal(bytes1)
  })

  it('should callback on length and data boundaries', async () => {
    const byteLength0 = randomInt(2, 64)
    const bytes0 = randomBytes(byteLength0)

    const byteLength1 = randomInt(1, 64)
    const bytes1 = randomBytes(byteLength1)

    const input = [
      uint8ArrayConcat([
        Uint8Array.from(varint.encode(byteLength0)),
        bytes0,
        Uint8Array.from(varint.encode(byteLength1)),
        bytes1
      ])
    ]

    const lengthDeferred = defer()
    const dataDeferred = defer()

    const expectedLengths = [byteLength0, byteLength1]
    const expectedDatas = [bytes0, bytes1]

    const onLength = (len: number): void => {
      const expectedLength = expectedLengths.shift()

      expect(len).to.equal(expectedLength)

      if (expectedLengths.length === 0) {
        lengthDeferred.resolve()
      }
    }

    const onData = (data: Uint8ArrayList | Uint8Array): void => {
      const expectedData = expectedDatas.shift()

      expect(data.slice()).to.deep.equal(expectedData)

      if (expectedLengths.length === 0) {
        dataDeferred.resolve()
      }
    }

    void pipe(input, (source) => lp.decode(source, { onLength, onData }), async (source) => all(source))

    await Promise.all([lengthDeferred.promise, dataDeferred.promise])
  })

  it('should decode with custom length decoder (int32BE)', async () => {
    const byteLength0 = randomInt(2, 64)
    const encodedByteLength0 = new Uint8Array(4)
    const view0 = new DataView(encodedByteLength0.buffer, encodedByteLength0.byteOffset, encodedByteLength0.byteLength)
    view0.setInt32(0, byteLength0, false)
    const bytes0 = randomBytes(byteLength0)

    const byteLength1 = randomInt(1, 64)
    const encodedByteLength1 = new Uint8Array(4)
    const view1 = new DataView(encodedByteLength1.buffer, encodedByteLength1.byteOffset, encodedByteLength1.byteLength)
    view1.setInt32(0, byteLength1, false)
    const bytes1 = randomBytes(byteLength1)

    const input = [
      uint8ArrayConcat([
        encodedByteLength0,
        bytes0.slice(0, 1)
      ]),
      uint8ArrayConcat([
        bytes0.slice(1),
        encodedByteLength1,
        bytes1
      ])
    ]

    const output = await pipe(input, (source) => lp.decode(source, { lengthDecoder: int32BEDecode }), async (source) => all(source))
    expect(output[0].slice(-byteLength0)).to.deep.equal(bytes0)
    expect(output[1].slice(-byteLength1)).to.deep.equal(bytes1)
  })
})
