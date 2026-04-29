export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

export function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : name;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export function diffDays(from, to) {
  if (!from || !to) return null;
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const diff = Math.round((b - a) / 86400000);
  return Number.isNaN(diff) ? null : diff;
}

export function lastLog(logs, taskId) {
  return logs
    .filter(log => log.taskId === taskId)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
}

export function getDueDateFromLastLog(task, last) {
  if (!last) return null;

  if (last.nextDueDate) return last.nextDueDate;

  if (task.type === 'scheduled' && task.intervalDays) {
    return addDays(last.date, task.intervalDays);
  }

  return null;
}

export function calculateScores(people, logs, task) {
  const normalizedPeople = people.map(normalizeName);

  const taskIds =
    task?.taskGroup === 'floor'
      ? ['vacuum', 'deep_water']
      : task?.id
        ? [task.id]
        : [];

  const scores = Object.fromEntries(normalizedPeople.map(person => [person, 0]));
  const lastDates = Object.fromEntries(
    normalizedPeople.map(person => [person, '1900-01-01'])
  );

  for (const log of logs || []) {
    if (taskIds.length && !taskIds.includes(log.taskId)) continue;

    const actualPerson = normalizeName(log.actualPerson || log.person);
    const assignedPerson = normalizeName(log.assignedPerson);
    const weight = Number(log.creditWeight ?? 1);

    if (actualPerson) {
      scores[actualPerson] = (scores[actualPerson] || 0) + weight;

      if (log.date > (lastDates[actualPerson] || '1900-01-01')) {
        lastDates[actualPerson] = log.date;
      }
    }

    const wasOverdueForSomeoneElse =
      assignedPerson &&
      actualPerson &&
      assignedPerson !== actualPerson &&
      (
        log.completionType === 'completed_by_other_late' ||
        log.completionType === 'auto_included_overdue_for_other'
      );

    if (wasOverdueForSomeoneElse) {
      scores[assignedPerson] = (scores[assignedPerson] || 0) - 1;
    }
  }

  return { scores, lastDates, normalizedPeople };
}

export function fairPerson(people, logs, task) {
  const { scores, lastDates, normalizedPeople } = calculateScores(
    people,
    logs,
    task
  );

  return [...normalizedPeople].sort((a, b) => {
    if ((scores[a] || 0) !== (scores[b] || 0)) {
      return (scores[a] || 0) - (scores[b] || 0);
    }

    return (lastDates[a] || '1900-01-01').localeCompare(
      lastDates[b] || '1900-01-01'
    );
  })[0];
}

export function buildScoreSummary(state) {
  const people = state.flatmates || [];
  const tasks = state.tasks || [];
  const logs = state.logs || [];

  const byPerson = {};
  const byTask = {};
  const byPersonTask = {};

  for (const person of people) {
    byPerson[person] = {
      person,
      positive: 0,
      negative: 0,
      total: 0
    };

    byPersonTask[person] = {};
  }

  for (const task of tasks) {
    byTask[task.id] = {
      taskId: task.id,
      taskName: task.name,
      total: 0
    };

    for (const person of people) {
      byPersonTask[person][task.id] = 0;
    }
  }

  for (const log of logs) {
    const person = normalizeName(log.actualPerson || log.person);
    const assigned = normalizeName(log.assignedPerson);
    const value = Number(log.creditWeight || 0);

    if (!byPerson[person]) {
      byPerson[person] = { person, positive: 0, negative: 0, total: 0 };
      byPersonTask[person] = {};
    }

    byPerson[person].positive += value;
    byPerson[person].total += value;

    if (!byPersonTask[person][log.taskId]) {
      byPersonTask[person][log.taskId] = 0;
    }

    byPersonTask[person][log.taskId] += value;

    if (!byTask[log.taskId]) {
      byTask[log.taskId] = {
        taskId: log.taskId,
        taskName: log.taskId,
        total: 0
      };
    }

    byTask[log.taskId].total += value;

    const someoneElseCoveredOverdue =
      assigned &&
      person &&
      assigned !== person &&
      (
        log.completionType === 'completed_by_other_late' ||
        log.completionType === 'auto_included_overdue_for_other'
      );

    if (someoneElseCoveredOverdue) {
      if (!byPerson[assigned]) {
        byPerson[assigned] = {
          person: assigned,
          positive: 0,
          negative: 0,
          total: 0
        };
      }

      byPerson[assigned].negative -= 1;
      byPerson[assigned].total -= 1;
    }
  }

  return {
    byPerson: Object.values(byPerson).map(row => ({
      ...row,
      positive: Number(row.positive.toFixed(2)),
      negative: Number(row.negative.toFixed(2)),
      total: Number(row.total.toFixed(2))
    })),
    byTask: Object.values(byTask).map(row => ({
      ...row,
      total: Number(row.total.toFixed(2))
    })),
    byPersonTask
  };
}

export async function readState(env) {
  const [flatmates, tasks, taskSubtasks, logs, logSubtasks, bins] = await Promise.all([
    env.DB.prepare(`
      SELECT
        name,
        email
      FROM flatmates
      ORDER BY rowid
    `).all(),

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

  const people = (flatmates.results || []).map(row => ({
    name: normalizeName(row.name),
    email: row.email || ''
  }));

  const state = {
    flatmates: people.map(person => person.name),
    flatmateProfiles: people,

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

  state.scores = buildScoreSummary(state);

  return state;
}