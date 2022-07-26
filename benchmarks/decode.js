import { decode, encode } from '../dist/src/index.js'
import { pipe } from 'it-pipe'
import { concat } from 'uint8arrays/concat'
import { expect } from 'aegir/chai'

const REPEAT = 1
let start = Date.now()

for (let i = 0; i < REPEAT; i++) {
  for (let j = 0; j < REPEAT; j++) {
    const out = await pipe(
      [Uint8Array.from([ 5, 1, 2, 3, 4, 5 ])],
      decode(),
      async source => {
        let buf = new Uint8Array()

        for await (const b of source) {
          buf = concat(buf, b)
        }

        return buf
      }
    )

    expect(out).to.equalBytes([1, 2, 3, 4, 5])
  }
}

console.info('decode', Date.now() - start, 'ms') // eslint-disable-line no-console
