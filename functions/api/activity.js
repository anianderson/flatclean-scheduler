import {
  diffDays,
  json,
  normalizeName,
  readStateWithAssignments,
  requireAdmin,
  todayIso
} from './_shared.js';

const USER_ACTIVITY_UNDO_WINDOW_DAYS = 7;

async function readLog(env, logId) {
  return env.DB.prepare(`
    SELECT
      id,
      task_id AS taskId,
      person,
      COALESCE(actual_person, person) AS actualPerson,
      assigned_person AS assignedPerson,
      done_date AS doneDate,
      scheduled_due_date AS scheduledDueDate,
      next_due_date AS nextDueDate,
      completion_type AS completionType,
      scoring_period_id AS scoringPeriodId,
      COALESCE(is_dummy, 0) AS isDummy,
      note,
      created_at AS createdAt
    FROM logs
    WHERE id = ?
    LIMIT 1
  `)
    .bind(logId)
    .first();
}

function canUserUndoLog(log, person) {
  if (!log || log.isDummy) return false;

  const actualPerson = normalizeName(log.actualPerson || log.person);
  const requestedPerson = normalizeName(person);

  if (!requestedPerson || actualPerson !== requestedPerson) return false;

  const daysSinceDone = diffDays(log.doneDate, todayIso());

  return (
    daysSinceDone !== null &&
    daysSinceDone >= 0 &&
    daysSinceDone <= USER_ACTIVITY_UNDO_WINDOW_DAYS
  );
}

async function writeActivityRemovalAudit(env, { log, actor, admin }) {
  try {
    await env.DB.prepare(`
      INSERT INTO admin_events (id, action, details)
      VALUES (?, ?, ?)
    `)
      .bind(
        crypto.randomUUID(),
        admin ? 'admin_remove_activity' : 'user_remove_own_activity',
        JSON.stringify({
          removedLogId: log.id,
          taskId: log.taskId,
          doneDate: log.doneDate,
          actualPerson: normalizeName(log.actualPerson || log.person),
          assignedPerson: normalizeName(log.assignedPerson),
          completionType: log.completionType,
          actor: normalizeName(actor),
          admin: !!admin
        })
      )
      .run();
  } catch (_error) {
    // Older databases may not have admin_events yet. The undo itself should still work.
  }
}

async function deleteCompletionLog(env, logId) {
  await env.DB.prepare(`DELETE FROM log_subtasks WHERE log_id = ?`)
    .bind(logId)
    .run();

  await env.DB.prepare(`DELETE FROM logs WHERE id = ?`)
    .bind(logId)
    .run();
}

export async function onRequestPost({ request, env }) {
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || '').trim();

  if (action !== 'delete_log') {
    return json({ error: 'Unknown activity action.' }, 400);
  }

  const logId = String(body.logId || '').trim();
  if (!logId) {
    return json({ error: 'Missing activity id.' }, 400);
  }

  const admin = body.admin === true;

  if (admin) {
    const adminError = requireAdmin(request, env);
    if (adminError) return adminError;
  }

  const log = await readLog(env, logId);
  if (!log || log.isDummy) {
    return json({ error: 'Activity not found.' }, 404);
  }

  if (!admin && !canUserUndoLog(log, body.person)) {
    return json({
      error: 'You can only remove your own activity from the last 7 days. Ask an admin to remove older or other people’s activity.'
    }, 403);
  }

  await writeActivityRemovalAudit(env, {
    log,
    actor: admin ? 'admin' : body.person,
    admin
  });

  await deleteCompletionLog(env, logId);

  return json(await readStateWithAssignments(env));
}
