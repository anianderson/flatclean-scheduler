import { json, readState } from './_shared.js';

const ADVANCE_THRESHOLD = 0.7;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : name;
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function getLastLog(logs, taskId) {
  return logs
    .filter(log => log.taskId === taskId)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
}

function calculateScores(people, logs, task) {
  const normalizedPeople = people.map(normalizeName);

  const taskIds =
    task.taskGroup === 'floor'
      ? ['vacuum', 'deep_water']
      : [task.id];

  const scores = Object.fromEntries(normalizedPeople.map(person => [person, 0]));
  const lastDates = Object.fromEntries(
    normalizedPeople.map(person => [person, '1900-01-01'])
  );

  for (const log of logs) {
    if (!taskIds.includes(log.taskId)) continue;

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

function fairPerson(people, logs, task) {
  const { scores, lastDates, normalizedPeople } = calculateScores(people, logs, task);

  return [...normalizedPeople].sort((a, b) => {
    if ((scores[a] || 0) !== (scores[b] || 0)) {
      return (scores[a] || 0) - (scores[b] || 0);
    }

    return (lastDates[a] || '1900-01-01').localeCompare(
      lastDates[b] || '1900-01-01'
    );
  })[0];
}

function getDueDateFromLastLog(task, last) {
  if (!last) return null;

  if (last.nextDueDate) {
    return last.nextDueDate;
  }

  if (task.type === 'scheduled' && task.intervalDays) {
    return addDays(last.date, task.intervalDays);
  }

  return null;
}

function calculateNextDueDate({
  scheduledDueDate,
  actualDoneDate,
  intervalDays,
  shouldAdvance
}) {
  if (!intervalDays) return null;

  if (!shouldAdvance) {
    return scheduledDueDate || actualDoneDate;
  }

  const anchorDate =
    scheduledDueDate && actualDoneDate <= scheduledDueDate
      ? scheduledDueDate
      : actualDoneDate;

  return addDays(anchorDate, intervalDays);
}

function getCompletionType({ assignedPerson, actualPerson, scheduledDueDate, actualDoneDate }) {
  if (!scheduledDueDate) return 'normal';

  const someoneElseDidIt =
    assignedPerson &&
    actualPerson &&
    normalizeName(assignedPerson) !== normalizeName(actualPerson);

  if (actualDoneDate < scheduledDueDate) {
    return someoneElseDidIt ? 'completed_by_other_early' : 'early';
  }

  if (actualDoneDate === scheduledDueDate) {
    return someoneElseDidIt ? 'completed_by_other_on_time' : 'on_time';
  }

  return someoneElseDidIt ? 'completed_by_other_late' : 'late';
}

function getCreditWeight(completionType, taskBaseWeight, completionRatio) {
  const base = Number(taskBaseWeight || 1);
  const ratio = Number(completionRatio || 1);

  switch (completionType) {
    case 'completed_by_other_late':
      return base * ratio * 1.25;
    case 'auto_included':
      return base * ratio * 0.5;
    case 'auto_included_overdue_for_other':
      return base * ratio * 1.5;
    default:
      return base * ratio;
  }
}

async function getTaskInfo(state, taskId) {
  const task = state.tasks.find(item => item.id === taskId);

  if (!task) return null;

  const last = getLastLog(state.logs, taskId);
  const dueDate = getDueDateFromLastLog(task, last);
  const assignedPerson = fairPerson(state.flatmates, state.logs, task);

  return {
    task,
    last,
    dueDate,
    assignedPerson
  };
}

function getTotalSubtaskWeight(task) {
  return (task.subtasks || []).reduce((sum, subtask) => {
    return sum + Number(subtask.weight || 1);
  }, 0);
}

function getSelectedSubtasks(task, completedSubtaskIds) {
  const taskSubtasks = task.subtasks || [];

  if (!taskSubtasks.length) return [];

  const selectedIds =
    Array.isArray(completedSubtaskIds) && completedSubtaskIds.length
      ? new Set(completedSubtaskIds)
      : new Set(taskSubtasks.map(subtask => subtask.id));

  return taskSubtasks.filter(subtask => selectedIds.has(subtask.id));
}

function getCycleId(taskId, scheduledDueDate, actualDoneDate) {
  return `${taskId}:${scheduledDueDate || actualDoneDate}`;
}

function getAggregateCompletedSubtaskIds(logs, taskId, cycleId, newSelectedIds) {
  const completed = new Set(newSelectedIds);

  for (const log of logs) {
    if (log.taskId !== taskId) continue;
    if (log.cycleId !== cycleId) continue;

    for (const subtask of log.completedSubtasks || []) {
      completed.add(subtask.id);
    }
  }

  return completed;
}

function calculateCompletion(task, selectedSubtasks, aggregateCompletedIds) {
  const taskSubtasks = task.subtasks || [];

  if (!taskSubtasks.length) {
    return {
      selectedWeight: 1,
      aggregateWeight: 1,
      totalWeight: 1,
      selectedRatio: 1,
      aggregateRatio: 1,
      isPartial: false
    };
  }

  const totalWeight = getTotalSubtaskWeight(task);

  const selectedWeight = selectedSubtasks.reduce((sum, subtask) => {
    return sum + Number(subtask.weight || 1);
  }, 0);

  const aggregateWeight = taskSubtasks
    .filter(subtask => aggregateCompletedIds.has(subtask.id))
    .reduce((sum, subtask) => sum + Number(subtask.weight || 1), 0);

  const selectedRatio = totalWeight > 0 ? selectedWeight / totalWeight : 1;
  const aggregateRatio = totalWeight > 0 ? aggregateWeight / totalWeight : 1;

  return {
    selectedWeight,
    aggregateWeight,
    totalWeight,
    selectedRatio: Math.min(selectedRatio, 1),
    aggregateRatio: Math.min(aggregateRatio, 1),
    isPartial: aggregateRatio < 1
  };
}

async function insertCompletionLog({
  env,
  taskId,
  actualPerson,
  assignedPerson,
  doneDate,
  scheduledDueDate,
  nextDueDate,
  completionType,
  creditWeight,
  note,
  isPartial,
  completionRatio,
  cycleId,
  selectedSubtasks
}) {
  const logId = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO logs (
      id,
      task_id,
      person,
      actual_person,
      assigned_person,
      done_date,
      scheduled_due_date,
      next_due_date,
      completion_type,
      credit_weight,
      is_partial,
      completion_ratio,
      cycle_id,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      logId,
      taskId,
      actualPerson,
      actualPerson,
      assignedPerson || null,
      doneDate,
      scheduledDueDate || null,
      nextDueDate || null,
      completionType,
      creditWeight,
      isPartial ? 1 : 0,
      completionRatio,
      cycleId,
      note || 'Marked done'
    )
    .run();

  for (const subtask of selectedSubtasks || []) {
    await env.DB.prepare(`
      INSERT INTO log_subtasks (
        log_id,
        subtask_id,
        completed,
        weight
      )
      VALUES (?, ?, 1, ?)
    `)
      .bind(logId, subtask.id, Number(subtask.weight || 1))
      .run();
  }

  return logId;
}

async function completeTask({
  env,
  stateBefore,
  taskId,
  actualPerson,
  date,
  note,
  completedSubtaskIds,
  forcedCompletionType,
  forcedNote
}) {
  const info = await getTaskInfo(stateBefore, taskId);

  if (!info) {
    return { error: 'Unknown task' };
  }

  const selectedSubtasks = getSelectedSubtasks(info.task, completedSubtaskIds);
  const selectedIds = selectedSubtasks.map(subtask => subtask.id);
  const cycleId = getCycleId(taskId, info.dueDate, date);

  const aggregateIds = getAggregateCompletedSubtaskIds(
    stateBefore.logs,
    taskId,
    cycleId,
    selectedIds
  );

  const completion = calculateCompletion(info.task, selectedSubtasks, aggregateIds);
  const shouldAdvance = completion.aggregateRatio >= ADVANCE_THRESHOLD;

  const completionType =
    forcedCompletionType ||
    getCompletionType({
      assignedPerson: info.assignedPerson,
      actualPerson,
      scheduledDueDate: info.dueDate,
      actualDoneDate: date
    });

  const nextDueDate = calculateNextDueDate({
    scheduledDueDate: info.dueDate,
    actualDoneDate: date,
    intervalDays: info.task.intervalDays,
    shouldAdvance
  });

  const creditWeight = getCreditWeight(
    completionType,
    info.task.baseWeight,
    completion.selectedRatio
  );

  await insertCompletionLog({
    env,
    taskId,
    actualPerson,
    assignedPerson: info.assignedPerson,
    doneDate: date,
    scheduledDueDate: info.dueDate,
    nextDueDate,
    completionType,
    creditWeight,
    note: forcedNote || note || 'Marked done',
    isPartial: completion.isPartial,
    completionRatio: completion.selectedRatio,
    cycleId,
    selectedSubtasks
  });

  if (info.task.type === 'on_demand') {
    await env.DB.prepare(`
      UPDATE bin_status
      SET is_full = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE task_id = ?
    `)
      .bind(taskId)
      .run();
  }

  return { ok: true, info };
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const {
    taskId,
    person,
    date,
    note,
    completedSubtaskIds,
    includeAlsoLogs = true,
    alsoLogSubtaskIds
  } = body;

  if (!taskId || !person || !date) {
    return json({ error: 'Missing task, person, or date' }, 400);
  }

  if (date > todayIso()) {
    return json({ error: 'Future dates are not allowed' }, 400);
  }

  const actualPerson = normalizeName(person);
  const stateBefore = await readState(env);

  const mainResult = await completeTask({
    env,
    stateBefore,
    taskId,
    actualPerson,
    date,
    note,
    completedSubtaskIds
  });

  if (mainResult.error) {
    return json({ error: mainResult.error }, 400);
  }

  const mainTask = mainResult.info.task;

  if (includeAlsoLogs && mainTask.alsoLogs?.length) {
    for (const extraTaskId of mainTask.alsoLogs) {
      const updatedState = await readState(env);
      const extraInfo = await getTaskInfo(updatedState, extraTaskId);

      if (!extraInfo) continue;

      const overdueForSomeoneElse =
        extraInfo.dueDate &&
        date > extraInfo.dueDate &&
        extraInfo.assignedPerson &&
        normalizeName(extraInfo.assignedPerson) !== actualPerson;

      const completionType = overdueForSomeoneElse
        ? 'auto_included_overdue_for_other'
        : 'auto_included';

      await completeTask({
        env,
        stateBefore: updatedState,
        taskId: extraTaskId,
        actualPerson,
        date,
        completedSubtaskIds: Array.isArray(alsoLogSubtaskIds)
          ? alsoLogSubtaskIds
          : completedSubtaskIds,
        forcedCompletionType: completionType,
        forcedNote: overdueForSomeoneElse
          ? `Auto-added because ${taskId} includes this task. It was overdue for ${extraInfo.assignedPerson}.`
          : `Auto-added because ${taskId} includes this task.`
      });
    }
  }

  return json(await readState(env));
}