import { randomBytes } from 'iso-random-stream'
import randomInt from 'random-int'

export function times <T> (n: number, fn: (...args: any[]) => T): T[] {
  return Array.from(Array(n)).fill(fn())
}

export function someBytes (n?: number): Uint8Array<ArrayBuffer> {
  return randomBytes(randomInt(1, n ?? 32))
}
