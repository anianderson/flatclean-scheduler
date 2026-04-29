import { json, readState } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { taskId, isFull } = body;

  if (!taskId) {
    return json({ error: 'Missing taskId' }, 400);
  }

  await env.DB.prepare(`
    INSERT INTO bin_status (task_id, is_full, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(task_id)
    DO UPDATE SET
      is_full = excluded.is_full,
      updated_at = CURRENT_TIMESTAMP
  `)
    .bind(taskId, isFull ? 1 : 0)
    .run();

  return json(await readState(env));
}