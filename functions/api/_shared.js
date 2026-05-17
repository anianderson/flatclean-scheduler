const HEAVY_TASK_IDS = new Set([
  'driveway_backyard',
  'deep_water',
  'bath_toilet_basin',
  'vacuum'
]);

export const GRACE_PERIOD_DAYS = 3;

export const FAIRNESS_TASK_SPECIFIC_WEIGHT = 0.75;
export const FAIRNESS_GLOBAL_POINTS_WEIGHT = 0.18;
export const FAIRNESS_TASK_COUNT_WEIGHT = 0.07;
export const SUBSTANTIAL_COMPLETION_THRESHOLD = 0.7;

const HISTORICAL_ASSIGNMENT_CREDIT_TYPES = new Set([
  'first_cycle_assignment_credit',
  'pre_launch_baseline',
  'baseline_history'
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

export const APP_TIME_ZONE = 'Europe/Berlin';

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

export function getAdminPin(env) {
  return env.ADMIN_PIN || env.APP_PIN || '';
}

export function requireAdmin(request, env) {
  const configuredPin = getAdminPin(env);
  const providedPin = request.headers.get('x-admin-pin') || '';

  if (!configuredPin) {
    return json({ error: 'Admin PIN has not been set up yet.' }, 500);
  }

  if (providedPin !== configuredPin) {
    return json({ error: 'The admin PIN is missing or incorrect.' }, 401);
  }

  return null;
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

function parseIsoDateParts(date) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

export function todayIso() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

export function addDays(date, days) {
  const parts = parseIsoDateParts(date);
  if (!parts) return null;

  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Number(days || 0)));
  return d.toISOString().slice(0, 10);
}

export function diffDays(from, to) {
  const aParts = parseIsoDateParts(from);
  const bParts = parseIsoDateParts(to);
  if (!aParts || !bParts) return null;

  const a = Date.UTC(aParts.year, aParts.month - 1, aParts.day);
  const b = Date.UTC(bParts.year, bParts.month - 1, bParts.day);
  const diff = Math.round((b - a) / 86400000);

  return Number.isNaN(diff) ? null : diff;
}

export function daysAfterScheduledDate(scheduledDueDate, actualDate) {
  if (!scheduledDueDate || !actualDate) return null;
  return diffDays(scheduledDueDate, actualDate);
}

export function getDefaultGraceUntil(scheduledDueDate) {
  return scheduledDueDate ? addDays(scheduledDueDate, GRACE_PERIOD_DAYS) : null;
}

export function getDayOfWeek(date) {
  const parts = parseIsoDateParts(date);
  if (!parts) return null;

  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}

export function dateRangeIncludesWeekend(startDate, endDate) {
  if (!startDate || !endDate) return false;

  let date = startDate;

  while (date <= endDate) {
    const day = getDayOfWeek(date);
    if (day === 0 || day === 6) return true;
    date = addDays(date, 1);
  }

  return false;
}

export function getNextWeekendGraceUntil(date) {
  if (!date) return null;

  for (let offset = 0; offset <= 10; offset += 1) {
    const candidate = addDays(date, offset);
    const day = getDayOfWeek(candidate);

    // Saturday found: extend through Sunday.
    if (day === 6) return addDays(candidate, 1);

    // Sunday found.
    if (day === 0) return candidate;
  }

  return null;
}

export function canOfferWeekendGraceExtension(scheduledDueDate, today = todayIso()) {
  if (!scheduledDueDate) return false;

  const defaultGraceUntil = getDefaultGraceUntil(scheduledDueDate);
  if (!defaultGraceUntil) return false;

  if (dateRangeIncludesWeekend(scheduledDueDate, defaultGraceUntil)) {
    return false;
  }

  if (today < scheduledDueDate || today > defaultGraceUntil) {
    return false;
  }

  const extendedUntil = getNextWeekendGraceUntil(defaultGraceUntil);
  return !!extendedUntil && extendedUntil > defaultGraceUntil;
}

export function getGraceExtensionForCycle({
  graceExtensions = [],
  taskId,
  cycleId,
  scheduledDueDate
}) {
  return (graceExtensions || []).find(extension =>
    extension.taskId === taskId &&
    extension.cycleId === cycleId &&
    extension.scheduledDueDate === scheduledDueDate
  ) || null;
}

export function getEffectiveGraceUntil({
  graceExtensions = [],
  taskId,
  cycleId,
  scheduledDueDate
}) {
  const defaultGraceUntil = getDefaultGraceUntil(scheduledDueDate);

  const extension = getGraceExtensionForCycle({
    graceExtensions,
    taskId,
    cycleId,
    scheduledDueDate
  });

  if (!extension?.extendedUntil) return defaultGraceUntil;

  return extension.extendedUntil > defaultGraceUntil
    ? extension.extendedUntil
    : defaultGraceUntil;
}

export function isInEffectiveGracePeriod({
  scheduledDueDate,
  actualDate,
  effectiveGraceUntil
}) {
  if (!scheduledDueDate || !actualDate || !effectiveGraceUntil) return false;

  return actualDate > scheduledDueDate && actualDate <= effectiveGraceUntil;
}

export function isAfterEffectiveGracePeriod({
  scheduledDueDate,
  actualDate,
  effectiveGraceUntil
}) {
  if (!scheduledDueDate || !actualDate || !effectiveGraceUntil) return false;

  return actualDate > effectiveGraceUntil;
}

export function isInGracePeriod(scheduledDueDate, actualDate) {
  const daysAfter = daysAfterScheduledDate(scheduledDueDate, actualDate);

  return (
    daysAfter !== null &&
    daysAfter > 0 &&
    daysAfter <= GRACE_PERIOD_DAYS
  );
}

export function isAfterGracePeriod(scheduledDueDate, actualDate) {
  const daysAfter = daysAfterScheduledDate(scheduledDueDate, actualDate);

  return (
    daysAfter !== null &&
    daysAfter > GRACE_PERIOD_DAYS
  );
}

function getBaseWeight(task) {
  return Number(task?.baseWeight || 1);
}

function isHeavyTask(task) {
  return HEAVY_TASK_IDS.has(task?.id) || getBaseWeight(task) >= 2;
}

function isHistoricalAssignmentCreditLog(log) {
  return HISTORICAL_ASSIGNMENT_CREDIT_TYPES.has(String(log?.completionType || ''));
}

function isSubstantialCompletionLog(log) {
  if (!log || log.isDummy) return false;
  if (isHistoricalAssignmentCreditLog(log)) return false;

  return Number(log.completionRatio || 1) >= SUBSTANTIAL_COMPLETION_THRESHOLD;
}

function taskIdsForFairnessTask(task) {
  return task?.taskGroup === 'floor'
    ? ['vacuum', 'deep_water']
    : task?.id
      ? [task.id]
      : [];
}

function hasRealSubstantialCompletionForTask(logs, task) {
  const taskIds = taskIdsForFairnessTask(task);

  return (logs || []).some(log =>
    taskIds.includes(log.taskId) && isSubstantialCompletionLog(log)
  );
}

function getFirstCycleHistoricalCredits(logs, task, people = []) {
  const taskIds = taskIdsForFairnessTask(task);
  const allowedPeople = new Set((people || []).map(normalizeName));

  if (!taskIds.length || hasRealSubstantialCompletionForTask(logs, task)) {
    return [];
  }

  return (logs || [])
    .filter(log => taskIds.includes(log.taskId))
    .filter(isHistoricalAssignmentCreditLog)
    .map(log => {
      const person = normalizeName(log.actualPerson || log.person);
      const creditWeight = Number(log.creditWeight || 0);

      return {
        id: log.id || '',
        taskId: log.taskId,
        person,
        date: log.date || '',
        creditWeight,
        completionRatio: Number(log.completionRatio || 1),
        note: log.note || '',
        source: log.completionType
      };
    })
    .filter(log => log.person && (!allowedPeople.size || allowedPeople.has(log.person)))
    .filter(log => Number(log.creditWeight || 0) > 0);
}

function lastSubstantialLog(logs, taskId) {
  return (logs || [])
    .filter(log => log.taskId === taskId)
    .filter(isSubstantialCompletionLog)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
}

function lastSubstantialGroupLog(logs, task) {
  const ids = task?.taskGroup === 'floor' ? ['vacuum', 'deep_water'] : [task?.id];

  return (logs || [])
    .filter(log => ids.includes(log.taskId))
    .filter(isSubstantialCompletionLog)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
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

export function getCycleId(taskId, scheduledDueDate, actualDoneDate) {
  return `${taskId}:${scheduledDueDate || actualDoneDate}`;
}

export function getCycleCompletionFromLogs(logs, task, dueDate) {
  const subtasks = task?.subtasks || [];

  if (!subtasks.length || !dueDate) {
    return {
      completed: [],
      pending: [],
      ratio: 1,
      isOpen: false
    };
  }

  const cycleId = getCycleId(task.id, dueDate, dueDate);
  const completedIds = new Set();

  for (const log of logs || []) {
    if (log.isDummy) continue;
    if (log.taskId !== task.id) continue;
    if (log.cycleId !== cycleId) continue;

    for (const subtask of log.completedSubtasks || []) {
      completedIds.add(subtask.id);
    }
  }

  const completed = subtasks.filter(subtask => completedIds.has(subtask.id));
  const pending = subtasks.filter(subtask => !completedIds.has(subtask.id));

  const totalWeight = subtasks.reduce(
    (sum, subtask) => sum + Number(subtask.weight || 1),
    0
  );

  const completedWeight = completed.reduce(
    (sum, subtask) => sum + Number(subtask.weight || 1),
    0
  );

  const ratio = totalWeight > 0 ? completedWeight / totalWeight : 1;

  return {
    completed,
    pending,
    ratio,
    isOpen: pending.length > 0 && ratio < 1
  };
}

export function getOpenCycleAssignedPerson({
  logs,
  task,
  dueDate,
  absences = [],
  date = null
}) {
  if (!task || task.type !== 'scheduled' || !dueDate) return '';

  const completion = getCycleCompletionFromLogs(logs, task, dueDate);
  if (!completion.isOpen) return '';

  // If the cycle was substantially completed, do not keep the old assignee for the
  // small leftovers. Below this threshold, the same assigned person stays responsible.
  if (completion.ratio >= SUBSTANTIAL_COMPLETION_THRESHOLD) return '';

  const cycleId = getCycleId(task.id, dueDate, dueDate);

  const cycleLogs = (logs || [])
    .filter(log => !log.isDummy && log.taskId === task.id && log.cycleId === cycleId)
    .sort((a, b) => {
      if ((a.createdAt || '') !== (b.createdAt || '')) {
        return (a.createdAt || '').localeCompare(b.createdAt || '');
      }

      return (a.date || '').localeCompare(b.date || '');
    });

  const assignedPerson = normalizeName(
    cycleLogs.find(log => normalizeName(log.assignedPerson))?.assignedPerson
  );

  if (!assignedPerson) return '';

  const checkDate = date || todayIso();

  if (isPersonUnavailable(absences, assignedPerson, checkDate)) {
    return '';
  }

  return assignedPerson;
}

export function getLoggedAssignedPersonForCycle({
  assignmentLogs = [],
  taskId,
  scheduledDueDate,
  absences = [],
  date = null
}) {
  if (!taskId || !scheduledDueDate) return '';

  const latestAssignment = (assignmentLogs || [])
    .filter(log => log.taskId === taskId && log.scheduledDueDate === scheduledDueDate)
    .sort((a, b) => {
      if ((b.createdAt || '') !== (a.createdAt || '')) {
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      }

      return (b.id || '').localeCompare(a.id || '');
    })[0];

  const assignedPerson = normalizeName(latestAssignment?.assignedPerson);
  if (!assignedPerson) return '';

  const checkDate = date || todayIso();
  if (isPersonUnavailable(absences, assignedPerson, checkDate)) {
    return '';
  }

  return assignedPerson;
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
  const taskIds = taskIdsForFairnessTask(task);

  const scores = Object.fromEntries(normalizedPeople.map(person => [person, 0]));
  const lastDates = Object.fromEntries(normalizedPeople.map(person => [person, '1900-01-01']));
  const historicalCredits = Object.fromEntries(normalizedPeople.map(person => [person, 0]));
  const historicalCreditLogs = [];

  for (const log of logs || []) {
    if (isHistoricalAssignmentCreditLog(log)) continue;
    if (log.isDummy) continue;
    if (activePeriodId && log.scoringPeriodId !== activePeriodId) continue;
    if (taskIds.length && !taskIds.includes(log.taskId)) continue;

    const actualPerson = normalizeName(log.actualPerson || log.person);
    const assignedPerson = normalizeName(log.assignedPerson);
    const weight = Number(log.creditWeight ?? 1);

    if (actualPerson) {
      scores[actualPerson] = (scores[actualPerson] || 0) + weight;

      if (
        isSubstantialCompletionLog(log) &&
        log.date > (lastDates[actualPerson] || '1900-01-01')
      ) {
        lastDates[actualPerson] = log.date;
      }
    }

    const canApplyPenalty = task?.type !== 'on_demand';
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
      const penalty = getPenaltyForCoveredOverdueLog(log, task);
      scores[assignedPerson] = (scores[assignedPerson] || 0) - penalty;
    }
  }

  const firstCycleCredits = getFirstCycleHistoricalCredits(logs, task, normalizedPeople);

  for (const credit of firstCycleCredits) {
    const person = normalizeName(credit.person);
    const value = Number(credit.creditWeight || 0);

    scores[person] = (scores[person] || 0) + value;
    historicalCredits[person] = (historicalCredits[person] || 0) + value;
    historicalCreditLogs.push(credit);

    if (credit.date && credit.date > (lastDates[person] || '1900-01-01')) {
      lastDates[person] = credit.date;
    }
  }

  return {
    scores,
    lastDates,
    normalizedPeople,
    historicalCredits,
    historicalCreditLogs,
    firstCycleHistoricalCreditsApplied: historicalCreditLogs.length > 0
  };
}

export function calculateGlobalWorkload(
  people,
  logs,
  tasks = [],
  activePeriodId = null
) {
  const normalizedPeople = (people || []).map(normalizeName);
  const taskById = Object.fromEntries((tasks || []).map(task => [task.id, task]));

  const workload = Object.fromEntries(
    normalizedPeople.map(person => [
      person,
      {
        points: 0,
        taskCount: 0,
        lastDate: '1900-01-01'
      }
    ])
  );

  for (const log of logs || []) {
    if (isHistoricalAssignmentCreditLog(log)) continue;
    if (log.isDummy) continue;
    if (activePeriodId && log.scoringPeriodId !== activePeriodId) continue;

    const task = taskById[log.taskId] || null;
    const actualPerson = normalizeName(log.actualPerson || log.person);
    const assignedPerson = normalizeName(log.assignedPerson);
    const creditWeight = Number(log.creditWeight || 0);
    const completionRatio = Number(log.completionRatio || 1);

    if (actualPerson) {
      if (!workload[actualPerson]) {
        workload[actualPerson] = {
          points: 0,
          taskCount: 0,
          lastDate: '1900-01-01'
        };
      }

      workload[actualPerson].points += creditWeight;
      workload[actualPerson].taskCount += completionRatio || 1;

      if (log.date > workload[actualPerson].lastDate) {
        workload[actualPerson].lastDate = log.date;
      }
    }

    const someoneElseCoveredOverdue =
      task?.type !== 'on_demand' &&
      assignedPerson &&
      actualPerson &&
      assignedPerson !== actualPerson &&
      (
        log.completionType === 'completed_by_other_late' ||
        log.completionType === 'auto_included_overdue_for_other'
      );

    if (someoneElseCoveredOverdue) {
      if (!workload[assignedPerson]) {
        workload[assignedPerson] = {
          points: 0,
          taskCount: 0,
          lastDate: '1900-01-01'
        };
      }

      const penalty = getPenaltyForCoveredOverdueLog(log, task);
      workload[assignedPerson].points -= penalty;
    }
  }

  return workload;
}

function getPersonFairnessBreakdown({
  person,
  people,
  logs,
  task,
  tasks = [],
  activePeriodId,
  plannedLoad = {}
}) {
  const normalizedPerson = normalizeName(person);
  const baseWeight = getBaseWeight(task);
  const heavy = isHeavyTask(task);

  const {
    scores: taskSpecificScores,
    lastDates,
    historicalCredits,
    historicalCreditLogs,
    firstCycleHistoricalCreditsApplied
  } = calculateScores(
    people,
    logs,
    task,
    activePeriodId
  );

  const globalWorkload = calculateGlobalWorkload(
    people,
    logs,
    tasks,
    activePeriodId
  );

  const taskSpecificScore = Number(taskSpecificScores[normalizedPerson] || 0);
  const historicalTaskCredit = Number(historicalCredits?.[normalizedPerson] || 0);
  const currentTaskSpecificScore = taskSpecificScore - historicalTaskCredit;
  const globalPointsScore = Number(globalWorkload[normalizedPerson]?.points || 0);
  const taskCountScore = Number(globalWorkload[normalizedPerson]?.taskCount || 0);
  const plannedLoadScore = Number(plannedLoad[normalizedPerson] || 0);

  const weightedTaskSpecific = taskSpecificScore * FAIRNESS_TASK_SPECIFIC_WEIGHT;
  const weightedGlobalPoints = globalPointsScore * FAIRNESS_GLOBAL_POINTS_WEIGHT;
  const weightedTaskCount = taskCountScore * FAIRNESS_TASK_COUNT_WEIGHT;

  const exactLast = lastSubstantialLog(logs || [], task.id);
  const exactLastPerson = normalizeName(exactLast?.actualPerson || exactLast?.person);
  const exactRepeatPenalty =
    exactLastPerson && exactLastPerson === normalizedPerson
      ? heavy ? baseWeight * 4 : baseWeight * 0.75
      : 0;

  const groupLast = lastSubstantialGroupLog(logs || [], task);
  const groupLastPerson = normalizeName(groupLast?.actualPerson || groupLast?.person);
  const groupRepeatPenalty =
    groupLastPerson &&
    groupLastPerson === normalizedPerson &&
    groupLast?.taskId !== task.id
      ? heavy ? baseWeight * 1.5 : baseWeight * 0.5
      : 0;

  const finalScore =
    weightedTaskSpecific +
    weightedGlobalPoints +
    weightedTaskCount +
    plannedLoadScore +
    exactRepeatPenalty +
    groupRepeatPenalty;

  return {
    person: normalizedPerson,
    taskSpecificScore: round(taskSpecificScore),
    currentTaskSpecificScore: round(currentTaskSpecificScore),
    historicalTaskCredit: round(historicalTaskCredit),
    historicalTaskCreditWeighted: round(historicalTaskCredit * FAIRNESS_TASK_SPECIFIC_WEIGHT),
    historicalCreditLogs: historicalCreditLogs.filter(log => normalizeName(log.person) === normalizedPerson),
    firstCycleHistoricalCreditsApplied,
    globalPointsScore: round(globalPointsScore),
    taskCountScore: round(taskCountScore),
    weightedTaskSpecific: round(weightedTaskSpecific),
    weightedGlobalPoints: round(weightedGlobalPoints),
    weightedTaskCount: round(weightedTaskCount),
    plannedLoad: round(plannedLoadScore),
    exactRepeatPenalty: round(exactRepeatPenalty),
    groupRepeatPenalty: round(groupRepeatPenalty),
    finalScore: round(finalScore),
    lastTaskDate: lastDates[normalizedPerson] || '1900-01-01',
    tieRank: rotatedRank(normalizedPerson, people, task.id)
  };
}

function personFairnessScore({
  person,
  people,
  logs,
  task,
  tasks = [],
  activePeriodId,
  plannedLoad = {}
}) {
  return getPersonFairnessBreakdown({
    person,
    people,
    logs,
    task,
    tasks,
    activePeriodId,
    plannedLoad
  }).finalScore;
}

export function buildFairnessExplanation({
  people,
  logs,
  task,
  tasks = [],
  activePeriodId = null,
  plannedLoad = {},
  absences = [],
  date = null
}) {
  const availablePeople = availablePeopleForDate(people, absences, date);
  const unavailablePeople = (people || [])
    .map(normalizeName)
    .filter(person => !availablePeople.map(normalizeName).includes(person));

  const candidates = availablePeople
    .map(person => getPersonFairnessBreakdown({
      person,
      people: availablePeople,
      logs,
      task,
      tasks,
      activePeriodId,
      plannedLoad
    }))
    .sort((a, b) => {
      if (a.finalScore !== b.finalScore) return a.finalScore - b.finalScore;
      if ((a.lastTaskDate || '1900-01-01') !== (b.lastTaskDate || '1900-01-01')) {
        return (a.lastTaskDate || '1900-01-01').localeCompare(b.lastTaskDate || '1900-01-01');
      }
      return a.tieRank - b.tieRank;
    });

  return {
    selectedPerson: candidates[0]?.person || '',
    policy: {
      taskSpecificWeight: FAIRNESS_TASK_SPECIFIC_WEIGHT,
      globalPointsWeight: FAIRNESS_GLOBAL_POINTS_WEIGHT,
      taskCountWeight: FAIRNESS_TASK_COUNT_WEIGHT,
      taskSpecificPercent: '75%',
      globalPointsPercent: '18%',
      taskCountPercent: '7%'
    },
    formula:
      'final score = task-specific points × 0.75 + global points × 0.18 + task count × 0.07 + already planned load + repeat-task penalties. The lowest final score is assigned.',
    tieBreakers: [
      'Lowest final fairness score wins.',
      'If scores are equal, the person who did this chore least recently wins.',
      'If still equal, a fixed rotated order for this chore is used.'
    ],
    date,
    taskId: task?.id || '',
    taskName: task?.name || task?.id || '',
    taskBaseWeight: Number(task?.baseWeight || 1),
    substantialCompletionThreshold: SUBSTANTIAL_COMPLETION_THRESHOLD,
    firstCycleHistoricalCreditsApplied: candidates.some(candidate => candidate.firstCycleHistoricalCreditsApplied),
    firstCycleHistoricalCredits: candidates.flatMap(candidate => candidate.historicalCreditLogs || []),
    availablePeople,
    unavailablePeople,
    candidates
  };
}

export function fairPerson(
  people,
  logs,
  task,
  activePeriodId = null,
  plannedLoad = {},
  tasks = []
) {
  const { lastDates, normalizedPeople } = calculateScores(people, logs, task, activePeriodId);

  return [...normalizedPeople].sort((a, b) => {
    const aScore = personFairnessScore({
      person: a,
      people: normalizedPeople,
      logs,
      task,
      tasks,
      activePeriodId,
      plannedLoad
    });

    const bScore = personFairnessScore({
      person: b,
      people: normalizedPeople,
      logs,
      task,
      tasks,
      activePeriodId,
      plannedLoad
    });

    if (aScore !== bScore) return aScore - bScore;

    if ((lastDates[a] || '1900-01-01') !== (lastDates[b] || '1900-01-01')) {
      return (lastDates[a] || '1900-01-01').localeCompare(lastDates[b] || '1900-01-01');
    }

    return rotatedRank(a, normalizedPeople, task.id) - rotatedRank(b, normalizedPeople, task.id);
  })[0];
}

export function fairPersonForDate({
  people,
  logs,
  task,
  tasks = [],
  activePeriodId = null,
  plannedLoad = {},
  absences = [],
  date = null
}) {
  const available = availablePeopleForDate(people, absences, date);

  return fairPerson(
    available,
    logs,
    task,
    activePeriodId,
    plannedLoad,
    tasks
  );
}


export function makeTaskRows(state, today = todayIso()) {
  const activePeriod = getActivePeriod(state);
  const plannedLoad = Object.fromEntries(
    (state.flatmates || []).map(person => [normalizeName(person), 0])
  );

  const rows = (state.tasks || []).map(task => {
    const last = lastLog(state.logs || [], task.id);
    const dueDate = getDueDateFromLastLog(task, last);

    return {
      task,
      last,
      dueDate,
      person: null,
      bundledIntoDeep: false,
      bundledVacuumRow: null,
      assignmentExplanation: null
    };
  });

  const deep = rows.find(row => row.task.id === 'deep_water');
  const vacuum = rows.find(row => row.task.id === 'vacuum');

  if (deep && vacuum && shouldBundleFloorTasks(vacuum.dueDate, deep.dueDate)) {
    const openVacuumAssignedPerson = getOpenCycleAssignedPerson({
      logs: state.logs,
      task: vacuum.task,
      dueDate: vacuum.dueDate,
      absences: state.absences,
      date: today
    });

    const loggedVacuumAssignedPerson = getLoggedAssignedPersonForCycle({
      assignmentLogs: state.assignmentLogs || [],
      taskId: vacuum.task.id,
      scheduledDueDate: vacuum.dueDate,
      absences: state.absences,
      date: today
    });

    const originalVacuumExplanation = buildFairnessExplanation({
      people: state.flatmates,
      logs: state.logs,
      task: vacuum.task,
      tasks: state.allTasks || state.tasks || [],
      activePeriodId: activePeriod?.id || null,
      plannedLoad,
      absences: state.absences,
      date: vacuum.dueDate
    });

    const originalVacuumPerson = openVacuumAssignedPerson || loggedVacuumAssignedPerson || originalVacuumExplanation.selectedPerson;

    const combinedTask = {
      ...deep.task,
      id: 'deep_water',
      baseWeight: Number(deep.task.baseWeight || 1) + Number(vacuum.task.baseWeight || 1),
      taskGroup: 'floor'
    };

    const floorExplanation = buildFairnessExplanation({
      people: state.flatmates,
      logs: state.logs,
      task: combinedTask,
      tasks: state.allTasks || state.tasks || [],
      activePeriodId: activePeriod?.id || null,
      plannedLoad,
      absences: state.absences,
      date: deep.dueDate
    });

    const loggedFloorAssignedPerson = getLoggedAssignedPersonForCycle({
      assignmentLogs: state.assignmentLogs || [],
      taskId: deep.task.id,
      scheduledDueDate: deep.dueDate,
      absences: state.absences,
      date: today
    });

    const floorPerson = loggedFloorAssignedPerson || floorExplanation.selectedPerson;

    const vacuumToDeepGap = diffDays(vacuum.dueDate, deep.dueDate);
    const deepToVacuumGap = diffDays(deep.dueDate, vacuum.dueDate);

    const bundledBecauseOverdue =
      vacuum.dueDate &&
      deep.dueDate &&
      vacuum.dueDate < today &&
      vacuum.dueDate < deep.dueDate &&
      vacuumToDeepGap !== null &&
      vacuumToDeepGap > 0 &&
      vacuumToDeepGap <= FLOOR_BUNDLE_WINDOW_DAYS;

    const bundledBecauseMoppingComesFirst =
      deep.dueDate &&
      vacuum.dueDate &&
      deep.dueDate < vacuum.dueDate &&
      deepToVacuumGap !== null &&
      deepToVacuumGap > 0 &&
      deepToVacuumGap < FLOOR_MIN_GAP_DAYS;

    const vacuumCompletion = getCycleCompletionFromLogs(
      state.logs || [],
      vacuum.task,
      vacuum.dueDate
    );

    deep.person = floorPerson;
    deep.assignmentExplanation = {
      ...floorExplanation,
      selectedPerson: floorPerson,
      assignmentSource: loggedFloorAssignedPerson ? 'logged_current_assignment' : 'fairness_policy_floor_bundle',
      reason: loggedFloorAssignedPerson
        ? 'This chore already has an assignment log for the current scheduled date, so the system preserves that assignment until the cycle changes or the person is unavailable.'
        : floorExplanation.reason,
      bundledVacuum: true,
      bundledVacuumOriginalPerson: originalVacuumPerson,
      bundledVacuumExplanation: originalVacuumExplanation,
      bundledBecauseOverdue,
      bundledBecauseMoppingComesFirst
    };

    deep.bundledVacuumRow = {
      ...vacuum,
      originalDueDate: vacuum.dueDate,
      originalPerson: originalVacuumPerson,
      originalPendingSubtasks: vacuumCompletion.pending || [],
      originalCompletedSubtasks: vacuumCompletion.completed || [],
      originalCompletionRatio: vacuumCompletion.ratio || 0,
      dueDate: deep.dueDate,
      person: floorPerson,
      bundledBecauseOverdue,
      bundledBecauseMoppingComesFirst
    };

    vacuum.person = floorPerson;
    vacuum.dueDate = deep.dueDate;
    vacuum.bundledIntoDeep = true;

    plannedLoad[floorPerson] =
      Number(plannedLoad[floorPerson] || 0) +
      Number(deep.task.baseWeight || 1) +
      Number(vacuum.task.baseWeight || 1);
  }

  const assignmentOrder = [...rows]
    .filter(row => !row.bundledIntoDeep)
    .sort((a, b) => {
      if (a.task.type !== b.task.type) {
        return a.task.type === 'scheduled' ? -1 : 1;
      }

      return (a.dueDate || '9999-12-31').localeCompare(
        b.dueDate || '9999-12-31'
      );
    });

  for (const row of assignmentOrder) {
    if (row.person) continue;

    const assignmentDate = row.task.type === 'scheduled' ? row.dueDate : null;

    const openCycleAssignedPerson = getOpenCycleAssignedPerson({
      logs: state.logs,
      task: row.task,
      dueDate: row.dueDate,
      absences: state.absences,
      date: today
    });

    const loggedAssignedPerson = getLoggedAssignedPersonForCycle({
      assignmentLogs: state.assignmentLogs || [],
      taskId: row.task.id,
      scheduledDueDate: row.dueDate,
      absences: state.absences,
      date: today
    });

    const openCycleCompletion = getCycleCompletionFromLogs(
      state.logs || [],
      row.task,
      row.dueDate
    );

    const explanation = buildFairnessExplanation({
      people: state.flatmates,
      logs: state.logs,
      task: row.task,
      tasks: state.allTasks || state.tasks || [],
      activePeriodId: activePeriod?.id || null,
      plannedLoad,
      absences: state.absences,
      date: assignmentDate
    });

    row.person = openCycleAssignedPerson || loggedAssignedPerson || explanation.selectedPerson;
    row.assignmentExplanation = openCycleAssignedPerson
      ? {
          ...explanation,
          selectedPerson: openCycleAssignedPerson,
          assignmentSource: 'open_partial_cycle',
          reason:
            `This chore is still below the substantial-completion threshold (${round(openCycleCompletion.ratio * 100)}% done, threshold ${round(SUBSTANTIAL_COMPLETION_THRESHOLD * 100)}%), so the original assigned person stays responsible for the still-open parts.`,
          openCycleCompletion: {
            completedRatio: round(openCycleCompletion.ratio),
            completedPercent: round(openCycleCompletion.ratio * 100),
            threshold: SUBSTANTIAL_COMPLETION_THRESHOLD,
            thresholdPercent: round(SUBSTANTIAL_COMPLETION_THRESHOLD * 100),
            completedParts: openCycleCompletion.completed || [],
            pendingParts: openCycleCompletion.pending || []
          }
        }
      : loggedAssignedPerson
        ? {
            ...explanation,
            selectedPerson: loggedAssignedPerson,
            assignmentSource: 'logged_current_assignment',
            reason: 'This chore already has an assignment log for the current scheduled date, so the system preserves that assignment until the cycle changes or the person is unavailable.'
          }
        : {
            ...explanation,
            assignmentSource: 'fairness_policy'
          };

    plannedLoad[row.person] =
      Number(plannedLoad[row.person] || 0) + Number(row.task.baseWeight || 1);
  }

  return rows.filter(row => !row.bundledIntoDeep);
}

export async function syncAssignmentLogs(env, state, rows = null, today = todayIso()) {
  const taskRows = rows || makeTaskRows(state, today);

  try {
    for (const row of taskRows) {
      if (row.task.type !== 'scheduled' || !row.dueDate || !row.person) continue;

      const lastAssignment = await env.DB.prepare(`
        SELECT
          id,
          assigned_person AS assignedPerson,
          details_json AS detailsJson
        FROM assignment_logs
        WHERE task_id = ?
          AND COALESCE(scheduled_due_date, '') = COALESCE(?, '')
        ORDER BY created_at DESC, id DESC
        LIMIT 1
      `)
        .bind(row.task.id, row.dueDate)
        .first();

      const lastAssignedPerson = normalizeName(lastAssignment?.assignedPerson);
      const currentAssignedPerson = normalizeName(row.person);
      const existingDetails = (() => {
        try {
          return lastAssignment?.detailsJson ? JSON.parse(lastAssignment.detailsJson) : {};
        } catch (_error) {
          return {};
        }
      })();

      const existingVersion = Number(existingDetails.assignmentLogVersion || 0);
      const currentSource = row.assignmentExplanation?.assignmentSource || 'fairness_policy';

      if (lastAssignedPerson === currentAssignedPerson && existingVersion >= 2) {
        continue;
      }

      const explanation = row.assignmentExplanation || {};
      const candidates = Array.isArray(explanation.candidates) ? explanation.candidates : [];
      const winningCandidate = candidates.find(
        candidate => normalizeName(candidate.person) === currentAssignedPerson
      ) || null;
      const runnerUpCandidate = candidates.find(
        candidate => normalizeName(candidate.person) !== currentAssignedPerson
      ) || null;

      const scoreGap = winningCandidate && runnerUpCandidate
        ? round(Number(runnerUpCandidate.finalScore || 0) - Number(winningCandidate.finalScore || 0))
        : null;

      const reasonSummary = currentSource === 'open_partial_cycle'
        ? `${currentAssignedPerson} stays assigned because this chore cycle is still partly open. The system keeps the original assigned person responsible for the remaining parts unless they are unavailable.`
        : currentSource === 'logged_current_assignment' && lastAssignedPerson === currentAssignedPerson
          ? `${currentAssignedPerson} stays assigned because this chore already has a saved backend assignment for the current scheduled date.`
          : runnerUpCandidate && winningCandidate
            ? `${currentAssignedPerson} was assigned because their final fairness score was ${winningCandidate.finalScore}, which is ${scoreGap} lower than the next closest person, ${runnerUpCandidate.person} (${runnerUpCandidate.finalScore}). Lower score means the person is currently the fairest choice for this chore.`
            : `${currentAssignedPerson} was assigned because they had the lowest backend fairness score for this chore.`;

      const historicalStep = explanation.firstCycleHistoricalCreditsApplied
        ? 'Because this chore is still in its first substantial app cycle, the system applied database-backed pre-app historical credits for this chore only. These credits stop being used after the first substantial app completion.'
        : null;

      const decisionSteps = currentSource === 'open_partial_cycle'
        ? [
            'The backend checked whether this chore has an unfinished partial cycle.',
            explanation.openCycleCompletion
              ? `Completed so far: ${explanation.openCycleCompletion.completedPercent}%. Threshold: ${explanation.openCycleCompletion.thresholdPercent}%.`
              : 'The cycle is still below the substantial-completion threshold.',
            `The backend found ${currentAssignedPerson} as the saved assigned person for this open cycle.`,
            'Because the assigned person is not unavailable, the backend keeps the same person instead of freshly reassigning the remaining parts.',
            'The frontend only displays this backend assignment.'
          ]
        : [
            'The backend checked the current scheduled date and current chore cycle.',
            'The backend removed flatmates who are unavailable on the scheduled date.',
            historicalStep,
            'The backend calculated task-specific fairness for each available flatmate.',
            'The backend calculated global points and task-count load across all chores in the current points period.',
            'The backend applied the fairness formula: task-specific × 0.75 + global points × 0.18 + task count × 0.07.',
            'The backend added already-planned workload from earlier chores in this same scheduling run.',
            'The backend added repeat-task penalties only for substantial completions, not for small partial completions.',
            'The backend selected the available flatmate with the lowest final score.',
            'The frontend only displays this backend assignment.'
          ].filter(Boolean);

      const details = {
        assignmentLogVersion: 2,
        taskId: row.task.id,
        taskName: row.task.name || row.task.id,
        scheduledDueDate: row.dueDate,
        assignedPerson: currentAssignedPerson,
        previousAssignedPerson: lastAssignedPerson || null,
        assignmentSource: currentSource,
        reason: explanation.reason || null,
        reasonSummary,
        decisionSteps,
        steps: decisionSteps,
        comparison: winningCandidate && runnerUpCandidate ? {
          winner: winningCandidate.person,
          winnerFinalScore: winningCandidate.finalScore,
          runnerUp: runnerUpCandidate.person,
          runnerUpFinalScore: runnerUpCandidate.finalScore,
          scoreGap
        } : null,
        selection: winningCandidate && runnerUpCandidate ? {
          winner: winningCandidate.person,
          winnerScore: winningCandidate.finalScore,
          runnerUp: runnerUpCandidate.person,
          runnerUpScore: runnerUpCandidate.finalScore,
          scoreDifference: scoreGap
        } : null,
        policy: {
          ...(explanation.policy || {}),
          formula: explanation.formula || 'final score = task-specific points × 0.75 + global points × 0.18 + task count × 0.07 + already planned load + repeat-task penalties. The lowest final score is assigned.'
        },
        formula: explanation.formula || null,
        tieBreakers: explanation.tieBreakers || [],
        selectedCandidate: winningCandidate,
        runnerUpCandidate,
        candidates,
        availablePeople: explanation.availablePeople || [],
        unavailablePeople: explanation.unavailablePeople || [],
        firstCycleHistoricalCreditsApplied: !!explanation.firstCycleHistoricalCreditsApplied,
        firstCycleHistoricalCredits: explanation.firstCycleHistoricalCredits || [],
        substantialCompletionThreshold: explanation.substantialCompletionThreshold || null,
        openCycleCompletion: explanation.openCycleCompletion || null,
        partialCycle: explanation.openCycleCompletion || null,
        bundledVacuum: !!row.bundledVacuumRow,
        bundledVacuumOriginalPerson: row.bundledVacuumRow?.originalPerson || null,
        bundledVacuumExplanation: explanation.bundledVacuumExplanation || null,
        generatedOn: today
      };

      await env.DB.prepare(`
        INSERT INTO assignment_logs (
          id,
          task_id,
          task_name,
          scheduled_due_date,
          assigned_person,
          previous_assigned_person,
          reason_summary,
          details_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          crypto.randomUUID(),
          row.task.id,
          row.task.name || row.task.id,
          row.dueDate,
          currentAssignedPerson,
          lastAssignedPerson || null,
          reasonSummary,
          JSON.stringify(details)
        )
        .run();
    }
  } catch (_error) {
    // assignment_logs may not exist in old deployments. Assignment display still works from computed backend rows.
  }
}

export async function readStateWithAssignments(env, today = todayIso()) {
  const state = await readState(env);
  await syncAssignmentLogs(env, state, state.taskRows || makeTaskRows(state, today), today);
  return readState(env);
}

function round(value) {
  return Number(Number(value || 0).toFixed(2));
}

function getPenaltyForCoveredOverdueLog(log, fallbackTask = null) {
  const creditWeight = Number(log?.creditWeight || 0);
  const completionRatio = Number(log?.completionRatio || 1);
  const fallbackBase = Number(fallbackTask?.baseWeight || 1);

  if (log?.completionType === 'completed_by_other_late') {
    return creditWeight > 0 ? creditWeight / 1.25 : fallbackBase * completionRatio;
  }

  if (log?.completionType === 'auto_included_overdue_for_other') {
    return creditWeight > 0 ? creditWeight / 1.5 : fallbackBase * completionRatio;
  }

  return fallbackBase * completionRatio;
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
    if (isHistoricalAssignmentCreditLog(log)) continue;
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
      const penalty = getPenaltyForCoveredOverdueLog(log, task);

      if (!byPerson[assigned]) {
        byPerson[assigned] = {
          person: assigned,
          positive: 0,
          negative: 0,
          total: 0
        };
      }

      byPerson[assigned].negative -= penalty;
      byPerson[assigned].total -= penalty;
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
  const [
    periods,
    flatmates,
    tasks,
    taskSubtasks,
    logs,
    logSubtasks,
    bins,
    flatmateHistory,
    absences,
    graceExtensions,
    assignmentLogs
  ] = await Promise.all([
    env.DB.prepare(`SELECT id, name, started_at AS startedAt, ended_at AS endedAt, reason FROM scoring_periods ORDER BY started_at DESC`).all(),
    env.DB.prepare(`SELECT name, email FROM flatmates ORDER BY rowid`).all(),
    env.DB.prepare(`
      SELECT
        id,
        name,
        type,
        interval_days AS intervalDays,
        task_group AS taskGroup,
        also_logs AS alsoLogs,
        COALESCE(base_weight, 1) AS baseWeight,
        COALESCE(active, 1) AS active
      FROM tasks
      ORDER BY rowid
    `).all(),
    env.DB.prepare(`SELECT ts.task_id AS taskId, s.id, s.name_en AS nameEn, s.name_de AS nameDe, s.weight, s.sort_order AS sortOrder FROM task_subtasks ts JOIN subtasks s ON s.id = ts.subtask_id ORDER BY ts.task_id, s.sort_order`).all(),
    env.DB.prepare(`SELECT id, task_id AS taskId, person, COALESCE(actual_person, person) AS actualPerson, assigned_person AS assignedPerson, done_date AS date, scheduled_due_date AS scheduledDueDate, next_due_date AS nextDueDate, completion_type AS completionType, COALESCE(credit_weight, 1) AS creditWeight, COALESCE(is_partial, 0) AS isPartial, COALESCE(completion_ratio, 1) AS completionRatio, cycle_id AS cycleId, scoring_period_id AS scoringPeriodId, COALESCE(is_dummy, 0) AS isDummy, note, created_at AS createdAt FROM logs ORDER BY done_date DESC, created_at DESC`).all(),
    env.DB.prepare(`SELECT log_id AS logId, subtask_id AS subtaskId, completed, weight FROM log_subtasks`).all(),
    env.DB.prepare(`SELECT task_id AS taskId, is_full AS isFull FROM bin_status`).all(),
    env.DB.prepare(`SELECT id, name, email, action, scoring_period_id AS scoringPeriodId, created_at AS createdAt, note FROM flatmate_history ORDER BY created_at DESC`).all(),
    env.DB.prepare(`SELECT id, person, start_date AS startDate, end_date AS endDate, reason, created_at AS createdAt FROM absences ORDER BY start_date DESC, created_at DESC`).all(),
    env.DB.prepare(`
      SELECT
        id,
        task_id AS taskId,
        cycle_id AS cycleId,
        scheduled_due_date AS scheduledDueDate,
        person,
        default_grace_until AS defaultGraceUntil,
        extended_until AS extendedUntil,
        reason,
        created_at AS createdAt
      FROM grace_extensions
      ORDER BY created_at DESC
    `).all().catch(() => ({ results: [] })),
    env.DB.prepare(`
      SELECT
        id,
        task_id AS taskId,
        task_name AS taskName,
        scheduled_due_date AS scheduledDueDate,
        assigned_person AS assignedPerson,
        previous_assigned_person AS previousAssignedPerson,
        reason_summary AS reasonSummary,
        details_json AS detailsJson,
        created_at AS createdAt
      FROM assignment_logs
      ORDER BY created_at DESC, id DESC
    `).all().catch(() => ({ results: [] }))
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

  const allTaskRows = (tasks.results || []).map(task => ({
    ...task,
    active: task.active !== 0,
    baseWeight: Number(task.baseWeight || 1),
    alsoLogs: task.alsoLogs ? task.alsoLogs.split(',').map(value => value.trim()).filter(Boolean) : [],
    subtasks: subtasksByTask[task.id] || []
  }));

  const taskRows = allTaskRows.filter(task => task.active);

  const logsWithTasks = (logs.results || []).map(log => {
    const task = allTaskRows.find(item => item.id === log.taskId);
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
    allTasks: allTaskRows,
    logs: logsWithTasks,
    graceExtensions: (graceExtensions.results || []).map(row => ({
      ...row,
      person: normalizeName(row.person)
    })),
    assignmentLogs: (assignmentLogs.results || []).map(row => ({
      ...row,
      assignedPerson: normalizeName(row.assignedPerson),
      previousAssignedPerson: normalizeName(row.previousAssignedPerson)
    })),
    fullBins
  };

  state.activeScoringPeriod = getActivePeriod(state);
  state.currentLogs = state.logs.filter(log =>
    log.scoringPeriodId === state.activeScoringPeriod?.id &&
    !log.isDummy &&
    !isHistoricalAssignmentCreditLog(log)
  );
  state.scores = buildScoreSummary({ ...state, tasks: allTaskRows });
  state.periodHistory = buildPeriodHistory({ ...state, tasks: allTaskRows });
  state.taskRows = makeTaskRows(state, todayIso());

  return state;
}
