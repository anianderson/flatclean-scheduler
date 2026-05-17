import { json, readStateWithAssignments } from './_shared.js';

export async function onRequestGet({ env }) {
  return json(await readStateWithAssignments(env));
}