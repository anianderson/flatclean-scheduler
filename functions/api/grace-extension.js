import {
  canOfferWeekendGraceExtension,
  getCycleId,
  getDefaultGraceUntil,
  getNextWeekendGraceUntil,
  json,
  makeTaskRows,
  normalizeName,
  readState,
  readStateWithAssignments,
  todayIso
} from './_shared.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));

  const taskId = String(body.taskId || '').trim();
  const scheduledDueDate = String(body.scheduledDueDate || '').trim();
  const person = normalizeName(body.person);

  if (!taskId || !scheduledDueDate || !person) {
    return json(
      { error: 'Missing chore, scheduled date, or person.' },
      400
    );
  }

  const today = todayIso();
  const state = await readState(env);
  const rows = makeTaskRows(state, today);

  const row = rows.find(item => item.task.id === taskId);

  if (!row || row.task.type !== 'scheduled') {
    return json(
      { error: 'This grace extension is only available for scheduled chores.' },
      400
    );
  }

  if (row.dueDate !== scheduledDueDate) {
    return json(
      { error: 'This chore schedule has changed. Please refresh and try again.' },
      409
    );
  }

  if (normalizeName(row.person) !== person) {
    return json(
      { error: 'Only the currently assigned flatmate can extend this grace period.' },
      403
    );
  }

  if (!canOfferWeekendGraceExtension(scheduledDueDate, today)) {
    return json(
      { error: 'Weekend grace extension is not available for this chore.' },
      400
    );
  }

  const cycleId = getCycleId(taskId, scheduledDueDate, scheduledDueDate);
  const defaultGraceUntil = getDefaultGraceUntil(scheduledDueDate);
  const extendedUntil = getNextWeekendGraceUntil(defaultGraceUntil);

  if (!defaultGraceUntil || !extendedUntil || extendedUntil <= defaultGraceUntil) {
    return json(
      { error: 'Weekend grace extension could not be calculated.' },
      400
    );
  }

  await env.DB.prepare(`
    INSERT INTO grace_extensions (
      id,
      task_id,
      cycle_id,
      scheduled_due_date,
      person,
      default_grace_until,
      extended_until,
      reason
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(task_id, cycle_id)
    DO UPDATE SET
      person = excluded.person,
      default_grace_until = excluded.default_grace_until,
      extended_until = excluded.extended_until,
      reason = excluded.reason,
      created_at = CURRENT_TIMESTAMP
  `)
    .bind(
      crypto.randomUUID(),
      taskId,
      cycleId,
      scheduledDueDate,
      person,
      defaultGraceUntil,
      extendedUntil,
      'Assigned person manually extended grace period to include the next weekend.'
    )
    .run();

  return json({
    state: await readStateWithAssignments(env),
    extendedUntil
  });
}