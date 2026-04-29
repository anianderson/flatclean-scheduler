export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : name;
}

export async function readState(env) {
  const [flatmates, tasks, logs, bins] = await Promise.all([
    env.DB.prepare('SELECT name FROM flatmates ORDER BY rowid').all(),
    env.DB.prepare(
      'SELECT id, name, type, interval_days AS intervalDays, task_group AS taskGroup, also_logs AS alsoLogs FROM tasks ORDER BY rowid'
    ).all(),
    env.DB.prepare(
      'SELECT id, task_id AS taskId, person, done_date AS date, note, created_at AS createdAt FROM logs ORDER BY done_date DESC, created_at DESC'
    ).all(),
    env.DB.prepare(
      'SELECT task_id AS taskId, is_full AS isFull FROM bin_status'
    ).all()
  ]);

  const fullBins = {};

  for (const row of bins.results || []) {
    fullBins[row.taskId] = !!row.isFull;
  }

  return {
    flatmates: (flatmates.results || []).map(row => normalizeName(row.name)),
    tasks: (tasks.results || []).map(task => ({
      ...task,
      alsoLogs: task.alsoLogs
        ? task.alsoLogs
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
        : []
    })),
    logs: (logs.results || []).map(log => ({
      ...log,
      person: normalizeName(log.person)
    })),
    fullBins
  };
}