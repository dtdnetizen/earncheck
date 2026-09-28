import fs from 'node:fs/promises';
import { checkOffer } from './core.mjs';

const input = JSON.parse(await fs.readFile(new URL('./sample-input.json', import.meta.url), 'utf8'));
const output = await checkOffer(input, () => new Date('2026-09-27T16:00:00.000Z'));
await fs.writeFile(new URL('./sample-output.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
