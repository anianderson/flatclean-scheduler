import { isValidEmail, json, normalizeName, readState } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const person = normalizeName(body.person);
  const email = String(body.email || '').trim();

  if (!person) {
    return json({ error: 'Missing person' }, 400);
  }

  if (!isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address' }, 400);
  }

  const existing = await env.DB.prepare(`
    SELECT name
    FROM flatmates
    WHERE name = ? OR name = ?
  `)
    .bind(person, person === 'Naveen' ? 'Neveen' : person)
    .first();

  if (!existing) {
    return json({ error: 'Unknown flatmate' }, 400);
  }

  await env.DB.prepare(`
    UPDATE flatmates
    SET email = ?
    WHERE name = ? OR name = ?
  `)
    .bind(email, person, person === 'Naveen' ? 'Neveen' : person)
    .run();

  return json(await readState(env));
}