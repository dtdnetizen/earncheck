// Compute the Nano state block hash locally for receipt recovery. The vendored
// BLAKE2b implementation is @noble/hashes 1.3.2 (MIT; see vendor/LICENSE).
import { blake2b } from './vendor/noble-hashes/blake2b.js';

const alphabet = '13456789abcdefghijkmnopqrstuwxyz';
const hex = bytes => [...bytes].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
function fromHex(value, length) {
  if (typeof value !== 'string' || !new RegExp(`^[0-9a-fA-F]{${length * 2}}$`).test(value)) throw new Error('invalid_hex');
  return Uint8Array.from(value.match(/../g), x => parseInt(x, 16));
}
function publicKey(address) {
  if (typeof address !== 'string' || !/^(nano_|xrb_)[13456789abcdefghijkmnopqrstuwxyz]{60}$/.test(address)) throw new Error('invalid_nano_address');
  const key = address.slice(address.indexOf('_') + 1, -8);
  let n = 0n;
  for (const c of key) n = n * 32n + BigInt(alphabet.indexOf(c));
  if (n >> 256n) throw new Error('invalid_nano_address');
  return fromHex(n.toString(16).padStart(64, '0'), 32);
}
function balanceBytes(decimal) {
  if (typeof decimal !== 'string' || !/^\d{1,39}$/.test(decimal)) throw new Error('invalid_balance');
  const n = BigInt(decimal);
  if (n >= (1n << 128n)) throw new Error('invalid_balance');
  return fromHex(n.toString(16).padStart(32, '0'), 16);
}

export function nanoStateHash(block) {
  if (!block || block.type !== 'state') throw new Error('invalid_block');
  const input = new Uint8Array(32 + 32 + 32 + 32 + 16 + 32);
  input[31] = 6; // state block preamble
  let at = 32;
  for (const bytes of [publicKey(block.account), fromHex(block.previous, 32),
    publicKey(block.representative), balanceBytes(block.balance), fromHex(block.link, 32)]) {
    input.set(bytes, at); at += bytes.length;
  }
  return hex(blake2b(input, { dkLen: 32 }));
}
