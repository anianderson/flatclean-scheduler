import { json, requirePin, readState } from './_shared.js';

export async function onRequestPost({ request, env }) {
  const pinError = requirePin(request, env);
  if (pinError) return pinError;

  await env.DB.prepare('DELETE FROM logs').run();
  await env.DB.prepare('UPDATE bin_status SET is_full = 0, updated_at = CURRENT_TIMESTAMP').run();
  const rows = [
    ['init-1', 'vacuum', 'Animesh', '2026-04-19', 'Initial record'],
    ['init-2', 'deep_water', 'Animesh', '2026-04-19', 'Initial record'],
    ['init-3', 'bath_toilet_basin', 'Animesh', '2026-04-19', 'Initial record'],
    ['init-4', 'bio_bin', 'Animesh', '2026-04-29', 'Initial record'],
    ['init-5', 'paper_bin', 'Animesh', '2026-04-29', 'Initial record'],
    ['init-6', 'gas_stove', 'Animesh', '2026-04-29', 'Initial record']
  ];
  for (const row of rows) {
    await env.DB.prepare('INSERT INTO logs (id, task_id, person, done_date, note) VALUES (?, ?, ?, ?, ?)').bind(...row).run();
  }
  return json(await readState(env));
}
