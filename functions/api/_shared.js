export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

export function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : String(name || '').trim();
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
    .filter(log => log.taskId === taskId && !log.isDummy)
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

export function getActivePeriod(state) {
  return (
    state.scoringPeriods?.find(period => !period.endedAt) ||
    state.scoringPeriods?.[0] ||
    null
  );
}

export function calculateScores(people, logs, task, activePeriodId = null) {
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
    if (log.isDummy) continue;
    if (activePeriodId && log.scoringPeriodId !== activePeriodId) continue;
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

export function fairPerson(people, logs, task, activePeriodId = null) {
  const { scores, lastDates, normalizedPeople } = calculateScores(
    people,
    logs,
    task,
    activePeriodId
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

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function buildScoreSummary(state) {
  const people = state.flatmates || [];
  const tasks = state.tasks || [];
  const logs = state.logs || [];
  const activePeriod = getActivePeriod(state);
  const activePeriodId = activePeriod?.id || null;

  const byPerson = {};
  const byTask = {};
  const byPersonTask = {};
  const byPersonTaskSubtask = {};

  for (const person of people) {
    byPerson[person] = {
      person,
      positive: 0,
      negative: 0,
      total: 0
    };

    byPersonTask[person] = {};
    byPersonTaskSubtask[person] = {};
  }

  for (const task of tasks) {
    byTask[task.id] = {
      taskId: task.id,
      taskName: task.name,
      baseWeight: Number(task.baseWeight || 1),
      earnedTotal: 0,
      subtasks: (task.subtasks || []).map(subtask => ({
        ...subtask,
        earnedTotal: 0
      }))
    };

    for (const person of people) {
      byPersonTask[person][task.id] = 0;
      byPersonTaskSubtask[person][task.id] = {};

      for (const subtask of task.subtasks || []) {
        byPersonTaskSubtask[person][task.id][subtask.id] = 0;
      }
    }
  }

  for (const log of logs) {
    if (log.isDummy) continue;
    if (activePeriodId && log.scoringPeriodId !== activePeriodId) continue;

    const task = tasks.find(item => item.id === log.taskId);
    const person = normalizeName(log.actualPerson || log.person);
    const assigned = normalizeName(log.assignedPerson);
    const value = Number(log.creditWeight || 0);

    if (!byPerson[person]) {
      byPerson[person] = {
        person,
        positive: 0,
        negative: 0,
        total: 0
      };
      byPersonTask[person] = {};
      byPersonTaskSubtask[person] = {};
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
        baseWeight: 1,
        earnedTotal: 0,
        subtasks: []
      };
    }

    byTask[log.taskId].earnedTotal += value;

    const taskSubtasks = task?.subtasks || [];
    const totalSubtaskWeight = taskSubtasks.reduce(
      (sum, subtask) => sum + Number(subtask.weight || 1),
      0
    );

    if (taskSubtasks.length && log.completedSubtasks?.length) {
      for (const completedSubtask of log.completedSubtasks) {
        const fullSubtask = taskSubtasks.find(item => item.id === completedSubtask.id);
        if (!fullSubtask || !totalSubtaskWeight) continue;

        const subtaskPoints =
          Number(task.baseWeight || 1) *
          (Number(fullSubtask.weight || 1) / totalSubtaskWeight);

        if (!byPersonTaskSubtask[person][log.taskId]) {
          byPersonTaskSubtask[person][log.taskId] = {};
        }

        byPersonTaskSubtask[person][log.taskId][fullSubtask.id] =
          (byPersonTaskSubtask[person][log.taskId][fullSubtask.id] || 0) +
          subtaskPoints;

        const taskScore = byTask[log.taskId];
        const subtaskScore = taskScore.subtasks.find(item => item.id === fullSubtask.id);

        if (subtaskScore) {
          subtaskScore.earnedTotal += subtaskPoints;
        }
      }
    }

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
    activePeriod,
    byPerson: Object.values(byPerson).map(row => ({
      ...row,
      positive: round(row.positive),
      negative: round(row.negative),
      total: round(row.total)
    })),
    byTask: Object.values(byTask).map(row => ({
      ...row,
      earnedTotal: round(row.earnedTotal),
      subtasks: (row.subtasks || []).map(subtask => ({
        ...subtask,
        earnedTotal: round(subtask.earnedTotal)
      }))
    })),
    byPersonTask,
    byPersonTaskSubtask
  };
}

export async function readState(env) {
  const [
    periods,
    flatmates,
    tasks,
    taskSubtasks,
    logs,
    logSubtasks,
    bins,
    flatmateHistory,
    emailLog
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT
        id,
        name,
        started_at AS startedAt,
        ended_at AS endedAt,
        reason
      FROM scoring_periods
      ORDER BY started_at DESC
    `).all(),

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
        scoring_period_id AS scoringPeriodId,
        COALESCE(is_dummy, 0) AS isDummy,
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
    `).all(),

    env.DB.prepare(`
      SELECT
        id,
        name,
        email,
        action,
        scoring_period_id AS scoringPeriodId,
        created_at AS createdAt,
        note
      FROM flatmate_history
      ORDER BY created_at DESC
    `).all(),

    env.DB.prepare(`
      SELECT
        email_type AS emailType,
        recipient_person AS recipientPerson,
        recipient_email AS recipientEmail,
        status,
        error,
        sent_at AS sentAt
      FROM email_log
      ORDER BY sent_at DESC
      LIMIT 20
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
    scoringPeriods: periods.results || [],

    flatmates: people.map(person => person.name),
    flatmateProfiles: people,

    flatmateHistory: (flatmateHistory.results || []).map(row => ({
      ...row,
      name: normalizeName(row.name)
    })),

    recentEmails: emailLog.results || [],

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
      isDummy: !!log.isDummy,
      completedSubtasks: logSubtasksByLog[log.id] || []
    })),

    fullBins
  };

  state.activeScoringPeriod = getActivePeriod(state);
  state.scores = buildScoreSummary(state);

  return state;
}