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
  const [flatmates, tasks, taskSubtasks, logs, logSubtasks, bins] = await Promise.all([
    env.DB.prepare('SELECT name FROM flatmates ORDER BY rowid').all(),

    env.DB.prepare(`
      SELECT
        id,
        name,
        type,
        interval_days AS intervalDays,
        task_group AS taskGroup,
        also_logs AS alsoLogs,
        COALESCE(base_weight, 1) AS baseWeight
      FROM tasks
      ORDER BY rowid
    `).all(),

    env.DB.prepare(`
      SELECT
        ts.task_id AS taskId,
        s.id,
        s.name_en AS nameEn,
        s.name_de AS nameDe,
        s.weight,
        s.sort_order AS sortOrder
      FROM task_subtasks ts
      JOIN subtasks s ON s.id = ts.subtask_id
      ORDER BY ts.task_id, s.sort_order
    `).all(),

    env.DB.prepare(`
      SELECT
        id,
        task_id AS taskId,
        person,
        COALESCE(actual_person, person) AS actualPerson,
        assigned_person AS assignedPerson,
        done_date AS date,
        scheduled_due_date AS scheduledDueDate,
        next_due_date AS nextDueDate,
        completion_type AS completionType,
        COALESCE(credit_weight, 1) AS creditWeight,
        COALESCE(is_partial, 0) AS isPartial,
        COALESCE(completion_ratio, 1) AS completionRatio,
        cycle_id AS cycleId,
        note,
        created_at AS createdAt
      FROM logs
      ORDER BY done_date DESC, created_at DESC
    `).all(),

    env.DB.prepare(`
      SELECT
        log_id AS logId,
        subtask_id AS subtaskId,
        completed,
        weight
      FROM log_subtasks
    `).all(),

    env.DB.prepare(`
      SELECT
        task_id AS taskId,
        is_full AS isFull
      FROM bin_status
    `).all()
  ]);

  const subtasksByTask = {};
  for (const row of taskSubtasks.results || []) {
    if (!subtasksByTask[row.taskId]) subtasksByTask[row.taskId] = [];
    subtasksByTask[row.taskId].push({
      id: row.id,
      nameEn: row.nameEn,
      nameDe: row.nameDe,
      weight: Number(row.weight || 1),
      sortOrder: row.sortOrder
    });
  }

  const logSubtasksByLog = {};
  for (const row of logSubtasks.results || []) {
    if (!logSubtasksByLog[row.logId]) logSubtasksByLog[row.logId] = [];
    if (row.completed) {
      logSubtasksByLog[row.logId].push({
        id: row.subtaskId,
        weight: Number(row.weight || 1)
      });
    }
  }

  const fullBins = {};
  for (const row of bins.results || []) {
    fullBins[row.taskId] = !!row.isFull;
  }

  return {
    flatmates: (flatmates.results || []).map(row => normalizeName(row.name)),

    tasks: (tasks.results || []).map(task => ({
      ...task,
      baseWeight: Number(task.baseWeight || 1),
      alsoLogs: task.alsoLogs
        ? task.alsoLogs
            .split(',')
            .map(value => value.trim())
            .filter(Boolean)
        : [],
      subtasks: subtasksByTask[task.id] || []
    })),

    logs: (logs.results || []).map(log => ({
      ...log,
      person: normalizeName(log.person),
      actualPerson: normalizeName(log.actualPerson),
      assignedPerson: normalizeName(log.assignedPerson),
      creditWeight: Number(log.creditWeight || 1),
      isPartial: !!log.isPartial,
      completionRatio: Number(log.completionRatio || 1),
      completedSubtasks: logSubtasksByLog[log.id] || []
    })),

    fullBins
  };
}