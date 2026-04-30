import { isValidDate, json, normalizeName, readState, todayIso } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const action = String(body.action || 'add').trim();
  const person = normalizeName(body.person);
  const absenceId = String(body.id || '').trim();
  const startDate = String(body.startDate || '').trim();
  const endDate = String(body.endDate || '').trim();
  const reason = String(body.reason || '').trim();

  if (!person) {
    return json({ error: 'Please choose your profile.' }, 400);
  }

  const flatmate = await env.DB.prepare(`
    SELECT name
    FROM flatmates
    WHERE lower(name) = lower(?)
  `)
    .bind(person)
    .first();

  if (!flatmate) {
    return json({ error: 'Unknown flatmate.' }, 400);
  }

  if (action === 'delete') {
    if (!absenceId) {
      return json({ error: 'Missing absence record.' }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT id, person
      FROM absences
      WHERE id = ?
    `)
      .bind(absenceId)
      .first();

    if (!existing) {
      return json({ error: 'This absence record does not exist.' }, 404);
    }

    if (normalizeName(existing.person) !== person) {
      return json({ error: 'You can only delete your own absence records.' }, 403);
    }

    await env.DB.prepare(`DELETE FROM absences WHERE id = ?`)
      .bind(absenceId)
      .run();

    return json(await readState(env));
  }

  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return json({ error: 'Please enter a valid start and end date.' }, 400);
  }

  if (endDate < startDate) {
    return json({ error: 'The end date cannot be before the start date.' }, 400);
  }

  if (endDate < todayIso()) {
    return json({ error: 'The whole absence period is already in the past.' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO absences (
      id,
      person,
      start_date,
      end_date,
      reason
    )
    VALUES (?, ?, ?, ?, ?)
  `)
    .bind(crypto.randomUUID(), person, startDate, endDate, reason || 'Away')
    .run();

  return json(await readState(env));
}
