import { json, readState } from './_shared.js';

export async function onRequestGet({ env }) {
  return json(await readState(env));
}
