import { isValidEmail, json, normalizeName, readState } from './_shared.js';

function requireAdmin(request, env) {
  const configured = env.APP_ADMIN_PIN;
  const provided = request.headers.get('x-admin-pin') || '';

  if (!configured) {
    return json({ error: 'APP_ADMIN_PIN is not configured' }, 500);
  }

  if (provided !== configured) {
    return json({ error: 'Wrong admin PIN' }, 401);
  }

  return null;
}

async function resetScoringPeriod(env, reason) {
  const active = await env.DB.prepare(`
    SELECT id
    FROM scoring_periods
    WHERE ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `).first();

  if (active) {
    await env.DB.prepare(`
      UPDATE scoring_periods
      SET ended_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(active.id)
      .run();
  }

  const newId = `period_${crypto.randomUUID()}`;

  await env.DB.prepare(`
    INSERT INTO scoring_periods (
      id,
      name,
      reason
    )
    VALUES (?, ?, ?)
  `)
    .bind(newId, 'Current period', reason)
    .run();

  return newId;
}

async function snapshotCurrentUsers(env, action, note) {
  const active = await env.DB.prepare(`
    SELECT id
    FROM scoring_periods
    WHERE ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `).first();

  const users = await env.DB.prepare(`
    SELECT name, email
    FROM flatmates
  `).all();

  for (const user of users.results || []) {
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
        normalizeName(user.name),
        user.email || '',
        action,
        active?.id || null,
        note || ''
      )
      .run();
  }
}

export async function onRequestPost({ request, env }) {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const body = await request.json();
  const action = body.action;
  const name = normalizeName(body.name);
  const email = String(body.email || '').trim();

  if (!['add', 'update', 'delete'].includes(action)) {
    return json({ error: 'Invalid action' }, 400);
  }

  if (!name) {
    return json({ error: 'Missing user name' }, 400);
  }

  if ((action === 'add' || action === 'update') && !isValidEmail(email)) {
    return json({ error: 'Valid email is required' }, 400);
  }

  await snapshotCurrentUsers(env, action, `Admin action: ${action} ${name}`);

  if (action === 'add') {
    const existing = await env.DB.prepare(`
      SELECT name
      FROM flatmates
      WHERE lower(name) = lower(?)
    `)
      .bind(name)
      .first();

    if (existing) {
      return json({ error: 'User already exists' }, 400);
    }

    await env.DB.prepare(`
      INSERT INTO flatmates (
        name,
        email
      )
      VALUES (?, ?)
    `)
      .bind(name, email)
      .run();
  }

  if (action === 'update') {
    await env.DB.prepare(`
      UPDATE flatmates
      SET email = ?
      WHERE lower(name) = lower(?)
    `)
      .bind(email, name)
      .run();
  }

  if (action === 'delete') {
    await env.DB.prepare(`
      DELETE FROM flatmates
      WHERE lower(name) = lower(?)
    `)
      .bind(name)
      .run();
  }

  await resetScoringPeriod(env, `User set changed: ${action} ${name}`);

  await env.DB.prepare(`
    INSERT INTO admin_events (
      id,
      action,
      details
    )
    VALUES (?, ?, ?)
  `)
    .bind(crypto.randomUUID(), action, JSON.stringify({ name, email }))
    .run();

  return json(await readState(env));
}