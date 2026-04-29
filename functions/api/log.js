import { json, readState } from './_shared.js';

function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : name;
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { taskId, person, date, note } = body;

  if (!taskId || !person || !date) {
    return json({ error: 'Missing task, person, or date' }, 400);
  }

  const normalizedPerson = normalizeName(person);

  const task = await env.DB.prepare(
    'SELECT id, also_logs AS alsoLogs, type FROM tasks WHERE id = ?'
  )
    .bind(taskId)
    .first();

  if (!task) {
    return json({ error: 'Unknown task' }, 400);
  }

  await env.DB.prepare(
    'INSERT INTO logs (id, task_id, person, done_date, note) VALUES (?, ?, ?, ?, ?)'
  )
    .bind(
      crypto.randomUUID(),
      taskId,
      normalizedPerson,
      date,
      note || 'Marked done'
    )
    .run();

  if (task.alsoLogs) {
    for (const extraTaskId of task.alsoLogs
      .split(',')
      .map(value => value.trim())
      .filter(Boolean)) {
      await env.DB.prepare(
        'INSERT INTO logs (id, task_id, person, done_date, note) VALUES (?, ?, ?, ?, ?)'
      )
        .bind(
          crypto.randomUUID(),
          extraTaskId,
          normalizedPerson,
          date,
          `Auto-added because ${taskId} includes this task`
        )
        .run();
    }
  }

  if (task.type === 'on_demand') {
    await env.DB.prepare(
      'UPDATE bin_status SET is_full = 0, updated_at = CURRENT_TIMESTAMP WHERE task_id = ?'
    )
      .bind(taskId)
      .run();
  }

  return json(await readState(env));
}