import { isValidEmail, json, normalizeName, readState } from './_shared.js';

function requireAdmin(request, env) {
  const configuredPin = env.ADMIN_PIN || env.APP_PIN;
  const provided = request.headers.get('x-admin-pin') || '';

  if (!configuredPin) {
    return json({ error: 'Admin PIN has not been set up yet.' }, 500);
  }

  if (provided !== configuredPin) {
    return json({ error: 'The admin PIN is missing or incorrect.' }, 401);
  }

  return null;
}

async function getActivePeriod(env) {
  return env.DB.prepare(`
    SELECT id
    FROM scoring_periods
    WHERE ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `).first();
}

async function startNewPeriod(env, reason) {
  const active = await getActivePeriod(env);

  if (active?.id) {
    await env.DB.prepare(`
      UPDATE scoring_periods
      SET ended_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(active.id)
      .run();
  }

  await env.DB.prepare(`
    INSERT INTO scoring_periods (
      id,
      name,
      started_at,
      reason
    )
    VALUES (?, 'Current period', CURRENT_TIMESTAMP, ?)
  `)
    .bind(crypto.randomUUID(), reason)
    .run();

  await env.DB.prepare(`DELETE FROM score_milestones`).run();
}

async function insertHistory(env, { name, email, action, note }) {
  const active = await getActivePeriod(env);

  await env.DB.prepare(`
    INSERT INTO flatmate_history (
      id,
      name,
      email,
      action,
      scoring_period_id,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `)
    .bind(
      crypto.randomUUID(),
      normalizeName(name),
      email || '',
      action,
      active?.id || null,
      note || ''
    )
    .run();
}

export async function onRequestPost({ request, env }) {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const body = await request.json();
  const action = String(body.action || '').trim();
  const name = normalizeName(body.name);
  const email = String(body.email || '').trim();

  if (!action || !name) {
    return json({ error: 'Please choose an action and enter a name.' }, 400);
  }

  if (email && !isValidEmail(email)) {
    return json({ error: 'Please enter a valid email address.' }, 400);
  }

  const existing = await env.DB.prepare(`
    SELECT name, email
    FROM flatmates
    WHERE lower(name) = lower(?)
  `)
    .bind(name)
    .first();

  if (action === 'add') {
    if (existing) {
      return json({ error: 'This flatmate already exists.' }, 400);
    }

    await insertHistory(env, {
      name,
      email,
      action: 'add',
      note: `${name} was added as an active flatmate.`
    });

    await env.DB.prepare(`
      INSERT INTO flatmates (
        name,
        email
      )
      VALUES (?, ?)
    `)
      .bind(name, email || '')
      .run();

    await startNewPeriod(env, `Flatmate list changed: ${name} was added.`);

    return json(await readState(env));
  }

  if (action === 'update') {
    if (!existing) {
      return json({ error: 'This flatmate does not exist.' }, 404);
    }

    if (!email) {
      return json({ error: 'Please enter an email address to update.' }, 400);
    }

    await env.DB.prepare(`
      UPDATE flatmates
      SET email = ?
      WHERE lower(name) = lower(?)
    `)
      .bind(email, name)
      .run();

    await insertHistory(env, {
      name,
      email,
      action: 'update',
      note: `Email address was updated for ${name}.`
    });

    return json(await readState(env));
  }

  if (action === 'delete') {
    if (!existing) {
      return json({ error: 'This flatmate does not exist.' }, 404);
    }

    await insertHistory(env, {
      name: existing.name,
      email: existing.email || '',
      action: 'delete',
      note: `${existing.name} was removed from the active flatmates.`
    });

    await env.DB.prepare(`
      DELETE FROM flatmates
      WHERE lower(name) = lower(?)
    `)
      .bind(name)
      .run();

    await startNewPeriod(env, `Flatmate list changed: ${existing.name} was removed.`);

    return json(await readState(env));
  }

  return json({ error: 'Unknown admin action.' }, 400);
}