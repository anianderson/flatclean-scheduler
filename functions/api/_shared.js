const HEAVY_TASK_IDS = new Set([
  'driveway_backyard',
  'deep_water',
  'bath_toilet_basin',
  'vacuum'
]);

export const FLOOR_MIN_GAP_DAYS = 10;
export const FLOOR_BUNDLE_WINDOW_DAYS = 5;

const TASK_TIE_OFFSETS = {
  gas_stove: 0,
  deep_water: 1,
  bath_toilet_basin: 2,
  driveway_backyard: 1,
  vacuum: 2,
  bio_bin: 1,
  yellow_bin: 2,
  black_bin: 0,
  paper_bin: 1
};

const MILESTONE_LEVELS = [5, 10, 25, 50, 75, 100, 125, 150, 175, 200];

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : String(name || '').trim();
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
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

function getBaseWeight(task) {
  return Number(task?.baseWeight || 1);
}

function isHeavyTask(task) {
  return HEAVY_TASK_IDS.has(task?.id) || getBaseWeight(task) >= 2;
}

export function isPersonUnavailable(absences, person, date) {
  if (!person || !date) return false;
  const normalized = normalizeName(person);
  return (absences || []).some(absence =>
    normalizeName(absence.person) === normalized &&
    absence.startDate <= date &&
    absence.endDate >= date
  );
}

export function wasPersonUnavailableBetween(absences, person, fromDate, toDate) {
  if (!person || !fromDate || !toDate) return false;
  const normalized = normalizeName(person);
  return (absences || []).some(absence =>
    normalizeName(absence.person) === normalized &&
    absence.startDate <= toDate &&
    absence.endDate >= fromDate
  );
}

export function availablePeopleForDate(people, absences, date) {
  const normalized = (people || []).map(normalizeName);
  if (!date) return normalized;

  const available = normalized.filter(person => !isPersonUnavailable(absences, person, date));
  return available.length ? available : normalized;
}

export function lastLog(logs, taskId) {
  return (logs || [])
    .filter(log => log.taskId === taskId && !log.isDummy)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
}

function lastGroupLog(logs, task) {
  const ids = task?.taskGroup === 'floor' ? ['vacuum', 'deep_water'] : [task?.id];

  return (logs || [])
    .filter(log => ids.includes(log.taskId) && !log.isDummy)
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

export function getRawTaskDueDate(state, taskId) {
  const task = (state.tasks || []).find(item => item.id === taskId);
  if (!task) return null;

  const last = lastLog(state.logs || [], taskId);
  return getDueDateFromLastLog(task, last);
}

export function shouldBundleFloorTasks(vacuumDueDate, deepDueDate) {
  if (!vacuumDueDate || !deepDueDate) return false;

  const vacuumToDeepGap = diffDays(vacuumDueDate, deepDueDate);
  const deepToVacuumGap = diffDays(deepDueDate, vacuumDueDate);

  if (vacuumToDeepGap === 0) return true;

  if (
    vacuumToDeepGap !== null &&
    vacuumToDeepGap > 0 &&
    vacuumToDeepGap <= FLOOR_BUNDLE_WINDOW_DAYS
  ) {
    return true;
  }

  if (
    deepToVacuumGap !== null &&
    deepToVacuumGap > 0 &&
    deepToVacuumGap < FLOOR_MIN_GAP_DAYS
  ) {
    return true;
  }

  return false;
}

export function getMinimumNextFloorDate(doneDate) {
  return addDays(doneDate, FLOOR_MIN_GAP_DAYS);
}

export function getActivePeriod(state) {
  return state.scoringPeriods?.find(period => !period.endedAt) || state.scoringPeriods?.[0] || null;
}

function rotatedRank(person, people, taskId) {
  const normalizedPeople = people.map(normalizeName);
  const offset = TASK_TIE_OFFSETS[taskId] ?? 0;
  const rotated = [...normalizedPeople.slice(offset), ...normalizedPeople.slice(0, offset)];
  const index = rotated.indexOf(normalizeName(person));
  return index === -1 ? 999 : index;
}

export function calculateScores(people, logs, task, activePeriodId = null) {
  const normalizedPeople = (people || []).map(normalizeName);
  const taskIds = task?.taskGroup === 'floor' ? ['vacuum', 'deep_water'] : task?.id ? [task.id] : [];

  const scores = Object.fromEntries(normalizedPeople.map(person => [person, 0]));
  const lastDates = Object.fromEntries(normalizedPeople.map(person => [person, '1900-01-01']));

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

    const canApplyPenalty = log.taskType !== 'on_demand';
    const wasOverdueForSomeoneElse =
      canApplyPenalty &&
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

function personFairnessScore({ person, people, logs, task, activePeriodId, plannedLoad = {} }) {
  const { scores } = calculateScores(people, logs, task, activePeriodId);
  const normalizedPerson = normalizeName(person);
  const baseWeight = getBaseWeight(task);
  const heavy = isHeavyTask(task);

  let score = Number(scores[normalizedPerson] || 0);
  score += Number(plannedLoad[normalizedPerson] || 0);

  const exactLast = lastLog(logs || [], task.id);
  const exactLastPerson = normalizeName(exactLast?.actualPerson || exactLast?.person);

  if (exactLastPerson && exactLastPerson === normalizedPerson) {
    score += heavy ? baseWeight * 4 : baseWeight * 0.75;
  }

  const groupLast = lastGroupLog(logs || [], task);
  const groupLastPerson = normalizeName(groupLast?.actualPerson || groupLast?.person);

  if (groupLastPerson && groupLastPerson === normalizedPerson && groupLast?.taskId !== task.id) {
    score += heavy ? baseWeight * 1.5 : baseWeight * 0.5;
  }

  return score;
}

export function fairPerson(people, logs, task, activePeriodId = null, plannedLoad = {}) {
  const { lastDates, normalizedPeople } = calculateScores(people, logs, task, activePeriodId);

  return [...normalizedPeople].sort((a, b) => {
    const aScore = personFairnessScore({ person: a, people: normalizedPeople, logs, task, activePeriodId, plannedLoad });
    const bScore = personFairnessScore({ person: b, people: normalizedPeople, logs, task, activePeriodId, plannedLoad });

    if (aScore !== bScore) return aScore - bScore;

    if ((lastDates[a] || '1900-01-01') !== (lastDates[b] || '1900-01-01')) {
      return (lastDates[a] || '1900-01-01').localeCompare(lastDates[b] || '1900-01-01');
    }

    return rotatedRank(a, normalizedPeople, task.id) - rotatedRank(b, normalizedPeople, task.id);
  })[0];
}

export function fairPersonForDate({ people, logs, task, activePeriodId = null, plannedLoad = {}, absences = [], date = null }) {
  const available = availablePeopleForDate(people, absences, date);
  return fairPerson(available, logs, task, activePeriodId, plannedLoad);
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

export function buildScoreSummary(state, periodId = null) {
  const people = state.flatmates || [];
  const tasks = state.tasks || [];
  const logs = state.logs || [];
  const activePeriod = periodId
    ? (state.scoringPeriods || []).find(period => period.id === periodId)
    : getActivePeriod(state);

  const activePeriodId = activePeriod?.id || null;
  const byPerson = {};
  const byTask = {};
  const byPersonTask = {};
  const byPersonTaskSubtask = {};

  for (const person of people) {
    byPerson[person] = { person, positive: 0, negative: 0, total: 0 };
    byPersonTask[person] = {};
    byPersonTaskSubtask[person] = {};
  }

  for (const task of tasks) {
    byTask[task.id] = {
      taskId: task.id,
      taskName: task.name,
      baseWeight: Number(task.baseWeight || 1),
      earnedTotal: 0,
      subtasks: (task.subtasks || []).map(subtask => ({ ...subtask, earnedTotal: 0 }))
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
      byPerson[person] = { person, positive: 0, negative: 0, total: 0 };
      byPersonTask[person] = {};
      byPersonTaskSubtask[person] = {};
    }

    byPerson[person].positive += value;
    byPerson[person].total += value;
    byPersonTask[person][log.taskId] = (byPersonTask[person][log.taskId] || 0) + value;

    if (!byTask[log.taskId]) {
      byTask[log.taskId] = { taskId: log.taskId, taskName: log.taskId, baseWeight: 1, earnedTotal: 0, subtasks: [] };
    }

    byTask[log.taskId].earnedTotal += value;

    const taskSubtasks = task?.subtasks || [];
    const totalSubtaskWeight = taskSubtasks.reduce((sum, subtask) => sum + Number(subtask.weight || 1), 0);

    if (taskSubtasks.length && log.completedSubtasks?.length) {
      for (const completedSubtask of log.completedSubtasks) {
        const fullSubtask = taskSubtasks.find(item => item.id === completedSubtask.id);
        if (!fullSubtask || !totalSubtaskWeight) continue;

        const subtaskPoints = Number(task.baseWeight || 1) * (Number(fullSubtask.weight || 1) / totalSubtaskWeight);

        if (!byPersonTaskSubtask[person][log.taskId]) byPersonTaskSubtask[person][log.taskId] = {};
        byPersonTaskSubtask[person][log.taskId][fullSubtask.id] =
          (byPersonTaskSubtask[person][log.taskId][fullSubtask.id] || 0) + subtaskPoints;

        const subtaskScore = byTask[log.taskId].subtasks.find(item => item.id === fullSubtask.id);
        if (subtaskScore) subtaskScore.earnedTotal += subtaskPoints;
      }
    }

    const someoneElseCoveredOverdue =
      task?.type !== 'on_demand' &&
      assigned &&
      person &&
      assigned !== person &&
      (
        log.completionType === 'completed_by_other_late' ||
        log.completionType === 'auto_included_overdue_for_other'
      );

    if (someoneElseCoveredOverdue) {
      if (!byPerson[assigned]) byPerson[assigned] = { person: assigned, positive: 0, negative: 0, total: 0 };
      byPerson[assigned].negative -= 1;
      byPerson[assigned].total -= 1;
    }
  }

  return {
    activePeriod,
    byPerson: Object.values(byPerson).map(row => ({ ...row, positive: round(row.positive), negative: round(row.negative), total: round(row.total) })),
    byTask: Object.values(byTask).map(row => ({ ...row, earnedTotal: round(row.earnedTotal), subtasks: (row.subtasks || []).map(subtask => ({ ...subtask, earnedTotal: round(subtask.earnedTotal) })) })),
    byPersonTask,
    byPersonTaskSubtask
  };
}

function buildPeriodHistory(state) {
  const periods = state.scoringPeriods || [];

  return periods.map(period => {
    const periodLogs = (state.logs || []).filter(log => log.scoringPeriodId === period.id);
    const scores = buildScoreSummary({ ...state, logs: periodLogs }, period.id);
    const milestones = [];

    for (const row of scores.byPerson || []) {
      for (const milestone of MILESTONE_LEVELS) {
        if (row.total >= milestone) milestones.push({ person: row.person, milestone });
      }
    }

    return { ...period, logs: periodLogs, scores, milestones };
  });
}

export async function readState(env) {
  const [periods, flatmates, tasks, taskSubtasks, logs, logSubtasks, bins, flatmateHistory, absences] = await Promise.all([
    env.DB.prepare(`SELECT id, name, started_at AS startedAt, ended_at AS endedAt, reason FROM scoring_periods ORDER BY started_at DESC`).all(),
    env.DB.prepare(`SELECT name, email FROM flatmates ORDER BY rowid`).all(),
    env.DB.prepare(`SELECT id, name, type, interval_days AS intervalDays, task_group AS taskGroup, also_logs AS alsoLogs, COALESCE(base_weight, 1) AS baseWeight FROM tasks ORDER BY rowid`).all(),
    env.DB.prepare(`SELECT ts.task_id AS taskId, s.id, s.name_en AS nameEn, s.name_de AS nameDe, s.weight, s.sort_order AS sortOrder FROM task_subtasks ts JOIN subtasks s ON s.id = ts.subtask_id ORDER BY ts.task_id, s.sort_order`).all(),
    env.DB.prepare(`SELECT id, task_id AS taskId, person, COALESCE(actual_person, person) AS actualPerson, assigned_person AS assignedPerson, done_date AS date, scheduled_due_date AS scheduledDueDate, next_due_date AS nextDueDate, completion_type AS completionType, COALESCE(credit_weight, 1) AS creditWeight, COALESCE(is_partial, 0) AS isPartial, COALESCE(completion_ratio, 1) AS completionRatio, cycle_id AS cycleId, scoring_period_id AS scoringPeriodId, COALESCE(is_dummy, 0) AS isDummy, note, created_at AS createdAt FROM logs ORDER BY done_date DESC, created_at DESC`).all(),
    env.DB.prepare(`SELECT log_id AS logId, subtask_id AS subtaskId, completed, weight FROM log_subtasks`).all(),
    env.DB.prepare(`SELECT task_id AS taskId, is_full AS isFull FROM bin_status`).all(),
    env.DB.prepare(`SELECT id, name, email, action, scoring_period_id AS scoringPeriodId, created_at AS createdAt, note FROM flatmate_history ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT id, person, start_date AS startDate, end_date AS endDate, reason, created_at AS createdAt FROM absences ORDER BY start_date DESC, created_at DESC`).all()
  ]);

  const subtasksByTask = {};
  for (const row of taskSubtasks.results || []) {
    if (!subtasksByTask[row.taskId]) subtasksByTask[row.taskId] = [];
    subtasksByTask[row.taskId].push({ id: row.id, nameEn: row.nameEn, nameDe: row.nameDe, weight: Number(row.weight || 1), sortOrder: row.sortOrder });
  }

  const logSubtasksByLog = {};
  for (const row of logSubtasks.results || []) {
    if (!logSubtasksByLog[row.logId]) logSubtasksByLog[row.logId] = [];
    if (row.completed) logSubtasksByLog[row.logId].push({ id: row.subtaskId, weight: Number(row.weight || 1) });
  }

  const fullBins = {};
  for (const row of bins.results || []) fullBins[row.taskId] = !!row.isFull;

  const people = (flatmates.results || []).map(row => ({ name: normalizeName(row.name), email: row.email || '' }));

  const taskRows = (tasks.results || []).map(task => ({
    ...task,
    baseWeight: Number(task.baseWeight || 1),
    alsoLogs: task.alsoLogs ? task.alsoLogs.split(',').map(value => value.trim()).filter(Boolean) : [],
    subtasks: subtasksByTask[task.id] || []
  }));

  const logsWithTasks = (logs.results || []).map(log => {
    const task = taskRows.find(item => item.id === log.taskId);
    return {
      ...log,
      person: normalizeName(log.person),
      actualPerson: normalizeName(log.actualPerson),
      assignedPerson: normalizeName(log.assignedPerson),
      creditWeight: Number(log.creditWeight || 1),
      isPartial: !!log.isPartial,
      completionRatio: Number(log.completionRatio || 1),
      isDummy: !!log.isDummy,
      taskType: task?.type || '',
      completedSubtasks: logSubtasksByLog[log.id] || []
    };
  });

  const state = {
    scoringPeriods: periods.results || [],
    flatmates: people.map(person => person.name),
    flatmateProfiles: people,
    flatmateHistory: (flatmateHistory.results || []).map(row => ({ ...row, name: normalizeName(row.name) })),
    absences: (absences.results || []).map(row => ({ ...row, person: normalizeName(row.person) })),
    tasks: taskRows,
    logs: logsWithTasks,
    fullBins
  };

  state.activeScoringPeriod = getActivePeriod(state);
  state.currentLogs = state.logs.filter(log => log.scoringPeriodId === state.activeScoringPeriod?.id && !log.isDummy);
  state.scores = buildScoreSummary(state);
  state.periodHistory = buildPeriodHistory(state);

  return state;
}
