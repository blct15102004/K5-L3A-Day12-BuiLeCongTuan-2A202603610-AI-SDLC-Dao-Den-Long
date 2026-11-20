import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const contractPath = path.resolve(__dirname, '../../game.contract.json');

export const DEFAULT_CONTRACT = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
export const TUNING = DEFAULT_CONTRACT.tuning;

// Default lantern locations on Night 1: 5 lanterns at radius 25m
// Angles: 0, 72, 144, 216, 288 degrees
export const DEFAULT_LANTERNS = [
  { id: 'L1', pos: [0, 0, 25], deposited: 0, lit: false },
  { id: 'L2', pos: [23.776, 0, 7.725], deposited: 0, lit: false },
  { id: 'L3', pos: [14.695, 0, -20.225], deposited: 0, lit: false },
  { id: 'L4', pos: [-14.695, 0, -20.225], deposited: 0, lit: false },
  { id: 'L5', pos: [-23.776, 0, 7.725], deposited: 0, lit: false }
];
