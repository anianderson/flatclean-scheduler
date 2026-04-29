import {
  fairPerson,
  getActivePeriod,
  getDueDateFromLastLog,
  json,
  lastLog,
  normalizeName,
  readState
} from './_shared.js';
import { bilingualEmail, sendAndLog } from './email.js';

const ADVANCE_THRESHOLD = 0.7;
const DEEP_WITHOUT_VACUUM_FACTOR = 0.7;
const MILESTONES = [5, 10, 25, 50, 100, 150, 200];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
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
    case 'deep_without_vacuum':
      return base * ratio * DEEP_WITHOUT_VACUUM_FACTOR;
    default:
      return base * ratio;
  }
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

async function getTaskInfo(state, taskId) {
  const task = state.tasks.find(item => item.id === taskId);

  if (!task) return null;

  const last = lastLog(state.logs, taskId);
  const dueDate = getDueDateFromLastLog(task, last);
  const activePeriod = getActivePeriod(state);
  const assignedPerson = fairPerson(state.flatmates, state.logs, task, activePeriod?.id);

  return {
    task,
    last,
    dueDate,
    assignedPerson
  };
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
      selectedRatio: 1,
      aggregateRatio: 1,
      isPartial: false
    };
  }

  const totalWeight = taskSubtasks.reduce(
    (sum, subtask) => sum + Number(subtask.weight || 1),
    0
  );

  const selectedWeight = selectedSubtasks.reduce(
    (sum, subtask) => sum + Number(subtask.weight || 1),
    0
  );

  const aggregateWeight = taskSubtasks
    .filter(subtask => aggregateCompletedIds.has(subtask.id))
    .reduce((sum, subtask) => sum + Number(subtask.weight || 1), 0);

  const selectedRatio = totalWeight > 0 ? selectedWeight / totalWeight : 1;
  const aggregateRatio = totalWeight > 0 ? aggregateWeight / totalWeight : 1;

  return {
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
  selectedSubtasks,
  scoringPeriodId
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
      scoring_period_id,
      is_dummy,
      note
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
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
      scoringPeriodId || null,
      note || 'Marked as done'
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
    return { error: 'Unknown chore' };
  }

  const activePeriod = getActivePeriod(stateBefore);
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

  const logId = await insertCompletionLog({
    env,
    taskId,
    actualPerson,
    assignedPerson: info.assignedPerson,
    doneDate: date,
    scheduledDueDate: info.dueDate,
    nextDueDate,
    completionType,
    creditWeight,
    note: forcedNote || note || 'Marked as done',
    isPartial: completion.isPartial,
    completionRatio: completion.selectedRatio,
    cycleId,
    selectedSubtasks,
    scoringPeriodId: activePeriod?.id || null
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

  return {
    ok: true,
    logId,
    info,
    completionType,
    creditWeight,
    selectedSubtasks
  };
}

function getProfile(state, person) {
  return (state.flatmateProfiles || []).find(
    profile => normalizeName(profile.name) === normalizeName(person)
  );
}

function taskName(taskId, state) {
  const task = state.tasks.find(item => item.id === taskId);
  return task?.name || taskId;
}

async function sendCompletionEmails(env, stateAfter, completionResults, actualPerson, date) {
  const actualProfile = getProfile(stateAfter, actualPerson);

  const totalPoints = completionResults.reduce(
    (sum, item) => sum + Number(item.creditWeight || 0),
    0
  );

  const taskList = completionResults
    .map(item => taskName(item.info.task.id, stateAfter))
    .join(', ');

  if (actualProfile?.email) {
    const email = bilingualEmail({
      titleDe: `Punkte aktualisiert: +${totalPoints.toFixed(2)}`,
      titleEn: `Points updated: +${totalPoints.toFixed(2)}`,
      summaryDe: `${actualPerson}, deine erledigte Aufgabe wurde gespeichert.`,
      summaryEn: `${actualPerson}, your completed chore has been saved.`,
      detailsDe: `Aufgabe(n): ${taskList}. Datum: ${date}. Neue Punkte aus diesem Eintrag: +${totalPoints.toFixed(2)}.`,
      detailsEn: `Chore(s): ${taskList}. Date: ${date}. Points earned from this entry: +${totalPoints.toFixed(2)}.`
    });

    await sendAndLog(
      env,
      {
        to: actualProfile.email,
        ...email
      },
      {
        emailType: 'score_update',
        taskId: completionResults[0]?.info?.task?.id || null,
        recipientPerson: actualPerson,
        referenceDate: date
      }
    );
  }

  for (const result of completionResults) {
    const assignedPerson = normalizeName(result.info.assignedPerson);
    const someoneElseCoveredOverdue =
      assignedPerson &&
      actualPerson &&
      assignedPerson !== actualPerson &&
      (
        result.completionType === 'completed_by_other_late' ||
        result.completionType === 'auto_included_overdue_for_other'
      );

    if (!someoneElseCoveredOverdue) continue;

    const assignedProfile = getProfile(stateAfter, assignedPerson);
    if (!assignedProfile?.email) continue;

    const email = bilingualEmail({
      titleDe: 'Fairness-Update',
      titleEn: 'Fairness update',
      summaryDe: `${actualPerson} hat eine überfällige Aufgabe übernommen.`,
      summaryEn: `${actualPerson} covered an overdue chore.`,
      detailsDe: `Die Aufgabe "${taskName(result.info.task.id, stateAfter)}" war ${assignedPerson} zugeordnet und wurde von ${actualPerson} erledigt. Die Fairness-Punkte wurden angepasst, damit die nächsten Aufgaben wieder ausgeglichener verteilt werden.`,
      detailsEn: `The chore "${taskName(result.info.task.id, stateAfter)}" was assigned to ${assignedPerson} and was completed by ${actualPerson}. The fairness points were adjusted so upcoming chores can be shared more evenly.`
    });

    await sendAndLog(
      env,
      {
        to: assignedProfile.email,
        ...email
      },
      {
        emailType: 'fairness_adjustment',
        taskId: result.info.task.id,
        recipientPerson: assignedPerson,
        referenceDate: date
      }
    );
  }
}

async function sendMilestoneEmails(env, stateAfter) {
  const scores = stateAfter.scores?.byPerson || [];

  for (const row of scores) {
    const reached = MILESTONES.filter(milestone => row.total >= milestone);
    if (!reached.length) continue;

    for (const milestone of reached) {
      const alreadySent = await env.DB.prepare(`
        SELECT person
        FROM score_milestones
        WHERE person = ? AND milestone = ?
      `)
        .bind(row.person, milestone)
        .first();

      if (alreadySent) continue;

      await env.DB.prepare(`
        INSERT INTO score_milestones (
          person,
          milestone
        )
        VALUES (?, ?)
      `)
        .bind(row.person, milestone)
        .run();

      for (const profile of stateAfter.flatmateProfiles || []) {
        if (!profile.email) continue;

        const email = bilingualEmail({
          titleDe: `🎉 ${row.person} hat ${milestone} Punkte erreicht`,
          titleEn: `🎉 ${row.person} reached ${milestone} points`,
          summaryDe: `${row.person} hat einen neuen Putzplan-Meilenstein erreicht.`,
          summaryEn: `${row.person} reached a new cleaning milestone.`,
          detailsDe: `Aktueller Punktestand: ${row.total.toFixed(2)} Punkte. Glückwunsch und danke fürs Mithelfen in der WG!`,
          detailsEn: `Current score: ${row.total.toFixed(2)} points. Congratulations, and thank you for helping keep the flat clean!`
        });

        await sendAndLog(
          env,
          {
            to: profile.email,
            ...email
          },
          {
            emailType: 'milestone',
            taskId: null,
            recipientPerson: profile.name,
            referenceDate: String(milestone)
          }
        );
      }
    }
  }
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
    return json({ error: 'Please choose a chore, profile, and date.' }, 400);
  }

  if (date > todayIso()) {
    return json({ error: 'Future dates are not allowed.' }, 400);
  }

  const actualPerson = normalizeName(person);
  const stateBefore = await readState(env);

  const completionResults = [];

  const deepWithoutVacuum =
    taskId === 'deep_water' &&
    includeAlsoLogs === false;

  const mainResult = await completeTask({
    env,
    stateBefore,
    taskId,
    actualPerson,
    date,
    note,
    completedSubtaskIds,
    forcedCompletionType: deepWithoutVacuum ? 'deep_without_vacuum' : undefined,
    forcedNote: deepWithoutVacuum
      ? `${note || 'Marked as done'} — vacuuming was not included, so mopping points were reduced.`
      : undefined
  });

  if (mainResult.error) {
    return json({ error: mainResult.error }, 400);
  }

  completionResults.push(mainResult);

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

      const extraResult = await completeTask({
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
          ? `Automatically added because this chore includes ${extraTaskId}. It was overdue for ${extraInfo.assignedPerson}.`
          : `Automatically added because this chore includes ${extraTaskId}.`
      });

      if (extraResult.ok) {
        completionResults.push(extraResult);
      }
    }
  }

  const stateAfter = await readState(env);

  await sendCompletionEmails(env, stateAfter, completionResults, actualPerson, date);
  await sendMilestoneEmails(env, stateAfter);

  return json(await readState(env));
}