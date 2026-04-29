import { json, readState } from './_shared.js';

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

function calculateNextDueDate({ scheduledDueDate, actualDoneDate, intervalDays }) {
  if (!intervalDays) return null;

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

function getCreditWeight(completionType) {
  switch (completionType) {
    case 'completed_by_other_late':
      return 1.25;
    case 'auto_included':
      return 0.5;
    case 'auto_included_overdue_for_other':
      return 1.5;
    default:
      return 1;
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
  note
}) {
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
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      crypto.randomUUID(),
      taskId,
      actualPerson,
      actualPerson,
      assignedPerson || null,
      doneDate,
      scheduledDueDate || null,
      nextDueDate || null,
      completionType,
      creditWeight,
      note || 'Marked done'
    )
    .run();
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { taskId, person, date, note } = body;

  const includeAlsoLogs = body.includeAlsoLogs !== false;

  if (!taskId || !person || !date) {
    return json({ error: 'Missing task, person, or date' }, 400);
  }

  if (date > todayIso()) {
    return json({ error: 'Future dates are not allowed' }, 400);
  }

  const actualPerson = normalizeName(person);
  const stateBefore = await readState(env);

  const mainInfo = await getTaskInfo(stateBefore, taskId);

  if (!mainInfo) {
    return json({ error: 'Unknown task' }, 400);
  }

  const mainCompletionType = getCompletionType({
    assignedPerson: mainInfo.assignedPerson,
    actualPerson,
    scheduledDueDate: mainInfo.dueDate,
    actualDoneDate: date
  });

  const mainNextDueDate = calculateNextDueDate({
    scheduledDueDate: mainInfo.dueDate,
    actualDoneDate: date,
    intervalDays: mainInfo.task.intervalDays
  });

  await insertCompletionLog({
    env,
    taskId,
    actualPerson,
    assignedPerson: mainInfo.assignedPerson,
    doneDate: date,
    scheduledDueDate: mainInfo.dueDate,
    nextDueDate: mainNextDueDate,
    completionType: mainCompletionType,
    creditWeight: getCreditWeight(mainCompletionType),
    note: note || 'Marked done'
  });

  if (includeAlsoLogs && mainInfo.task.alsoLogs?.length) {
    for (const extraTaskId of mainInfo.task.alsoLogs) {
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

      const nextDueDate = calculateNextDueDate({
        scheduledDueDate: extraInfo.dueDate,
        actualDoneDate: date,
        intervalDays: extraInfo.task.intervalDays
      });

      await insertCompletionLog({
        env,
        taskId: extraTaskId,
        actualPerson,
        assignedPerson: extraInfo.assignedPerson,
        doneDate: date,
        scheduledDueDate: extraInfo.dueDate,
        nextDueDate,
        completionType,
        creditWeight: getCreditWeight(completionType),
        note: overdueForSomeoneElse
          ? `Auto-added because ${taskId} includes this task. It was overdue for ${extraInfo.assignedPerson}.`
          : `Auto-added because ${taskId} includes this task.`
      });
    }
  }

  if (mainInfo.task.type === 'on_demand') {
    await env.DB.prepare(`
      UPDATE bin_status
      SET is_full = 0,
          updated_at = CURRENT_TIMESTAMP
      WHERE task_id = ?
    `)
      .bind(taskId)
      .run();
  }

  return json(await readState(env));
}