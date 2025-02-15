/**
 * @packageDocumentation
 *
 * Encode/decode streams of bytes with length-prefixes.
 *
 * @example
 *
 * ```js
 * import { pipe } from 'it-pipe'
 * import * as lp from 'it-length-prefixed'
 *
 * const encoded = []
 *
 * // encode
 * await pipe(
 *   [uint8ArrayFromString('hello world')],
 *   (source) => lp.encode(source),
 *   async source => {
 *     for await (const chunk of source) {
 *       encoded.push(chunk.slice()) // (.slice converts Uint8ArrayList to Uint8Array)
 *     }
 *   }
 * )
 *
 * console.log(encoded)
 * // => [Buffer <0b 68 65 6c 6c 6f 20 77 6f 72 6c 64>]
 *
 * const decoded = []
 *
 * // decode
 * await pipe(
 *   encoded, // e.g. from above
 *   (source) => lp.decode(source),
 *   async source => {
 *     for await (const chunk of source) {
 *       decoded.push(chunk.slice()) // (.slice converts Uint8ArrayList to Uint8Array)
 *     }
 *   }
 * )
 *
 * console.log(decoded)
 * // => [Buffer <68 65 6c 6c 6f 20 77 6f 72 6c 64>]
 * ```
 */

import type { Uint8ArrayList } from 'uint8arraylist'

export { encode } from './encode.js'
export { decode } from './decode.js'

export interface DecoderOptions {
  lengthDecoder?: LengthDecoderFunction
  onData?(data: Uint8ArrayList): void
  onLength?(length: number): void
  maxLengthLength?: number
  maxDataLength?: number
}

export interface LengthDecoderFunction {
  (data: Uint8ArrayList): number
  bytes: number
}

export interface EncoderOptions {
  lengthEncoder?: LengthEncoderFunction
  maxDataLength?: number
}

export interface LengthEncoderFunction {
  (value: number): Uint8ArrayList | Uint8Array
  bytes: number
}
