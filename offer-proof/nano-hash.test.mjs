import test from 'node:test';
import assert from 'node:assert/strict';
import { nanoStateHash } from './nano-hash.mjs';

// Nano Foundation RPC protocol block_hash example:
// https://docs.nano.org/commands/rpc-protocol/#block_hash
test('state hash agrees with official Nano block_hash vector', () => {
  assert.equal(nanoStateHash({
    type: 'state',
    account: 'nano_3qgmh14nwztqw4wmcdzy4xpqeejey68chx6nciczwn9abji7ihhum9qtpmdr',
    previous: 'F47B23107E5F34B2CE06F562B5C435DF72A533251CB414C51B2B62A8F63A00E4',
    representative: 'nano_1hza3f7wiiqa7ig3jczyxj5yo86yegcmqk3criaz838j91sxcckpfhbhhra1',
    balance: '1000000000000000000000',
    link: '19D3D919475DEED4696B5D13018151D1AF88B2BD3BCFF048B45031C1F36D1858'
  }), 'FF0144381CFF0B2C079A115E7ADA7E96F43FD219446E7524C48D1CC9900C4F17');
});
