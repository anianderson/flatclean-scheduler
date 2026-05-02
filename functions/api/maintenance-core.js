import {
  APP_TIME_ZONE,
  FLOOR_BUNDLE_WINDOW_DAYS,
  FLOOR_MIN_GAP_DAYS,
  diffDays,
  fairPersonForDate,
  getActivePeriod,
  getCycleCompletionFromLogs,
  getDueDateFromLastLog,
  getOpenCycleAssignedPerson,
  lastLog,
  normalizeName,
  readState,
  shouldBundleFloorTasks,
  todayIso
} from './_shared.js';
import { bilingualEmail, sendAndLog } from './email.js';

const SEND_WINDOW_START_HOUR = 7;
const SEND_WINDOW_END_HOUR = 21;
const GROUP_NOTICE_HOUR = 10;

const UPCOMING_REMINDER_DAYS = 1;
const WEEK_OVERDUE_DAYS = 7;

function formatDate(date) {
  if (!date) return '';

  return new Intl.DateTimeFormat('de-DE', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00Z`));
}

function germanHour(now = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    hour12: false
  }).format(now));
}

function insideSendWindow(now = new Date()) {
  const hour = germanHour(now);
  return hour >= SEND_WINDOW_START_HOUR && hour < SEND_WINDOW_END_HOUR;
}

function shouldSendGroupNotices(now = new Date()) {
  return germanHour(now) === GROUP_NOTICE_HOUR;
}

function taskName(task, fallback = '') {
  return task?.name || fallback || task?.id || '';
}

function getProfile(state, person) {
  return (state.flatmateProfiles || []).find(
    profile => normalizeName(profile.name) === normalizeName(person)
  );
}

function getTaskById(state, taskId) {
  return (state.tasks || []).find(task => task.id === taskId);
}

function getSubtaskDisplayName(subtask) {
  return subtask?.nameEn || subtask?.nameDe || subtask?.id || '';
}

function formatSubtaskList(subtasks) {
  const names = (subtasks || [])
    .map(getSubtaskDisplayName)
    .filter(Boolean);

  return names.length ? names.join(', ') : 'whole task';
}

async function alreadySent(env, { emailType, taskId, person, referenceDate }) {
  const row = await env.DB.prepare(`
    SELECT id
    FROM email_log
    WHERE email_type = ?
      AND COALESCE(task_id, '') = COALESCE(?, '')
      AND COALESCE(recipient_person, '') = COALESCE(?, '')
      AND COALESCE(reference_date, '') = COALESCE(?, '')
      AND status = 'sent'
    LIMIT 1
  `)
    .bind(emailType, taskId || null, person || null, referenceDate || null)
    .first();

  return !!row;
}

function makeTaskRows(state, today) {
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
      bundledVacuumRow: null
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

    const originalVacuumPerson = openVacuumAssignedPerson || fairPersonForDate({
      people: state.flatmates,
      logs: state.logs,
      task: vacuum.task,
      activePeriodId: activePeriod?.id || null,
      plannedLoad,
      absences: state.absences,
      date: vacuum.dueDate
    });

    const combinedTask = {
      ...deep.task,
      id: 'deep_water',
      baseWeight: Number(deep.task.baseWeight || 1) + Number(vacuum.task.baseWeight || 1),
      taskGroup: 'floor'
    };

    const floorPerson = fairPersonForDate({
      people: state.flatmates,
      logs: state.logs,
      task: combinedTask,
      activePeriodId: activePeriod?.id || null,
      plannedLoad,
      absences: state.absences,
      date: deep.dueDate
    });

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

    const openCycleAssignedPerson = getOpenCycleAssignedPerson({
      logs: state.logs,
      task: row.task,
      dueDate: row.dueDate,
      absences: state.absences,
      date: today
    });

    row.person = openCycleAssignedPerson || fairPersonForDate({
      people: state.flatmates,
      logs: state.logs,
      task: row.task,
      activePeriodId: activePeriod?.id || null,
      plannedLoad,
      absences: state.absences,
      date: row.task.type === 'scheduled' ? row.dueDate : null
    });

    plannedLoad[row.person] =
      Number(plannedLoad[row.person] || 0) + Number(row.task.baseWeight || 1);
  }

  return rows.filter(row => !row.bundledIntoDeep);
}

function classifyReminder(row, today) {
  if (row.task.type !== 'scheduled' || !row.dueDate || !row.person) return null;

  const daysUntilDue = diffDays(today, row.dueDate);
  if (daysUntilDue === null) return null;

  if (daysUntilDue < 0) {
    return {
      emailType: 'overdue_reminder',
      referenceDate: `${today}:${row.dueDate}`,
      urgency: 'overdue',
      daysUntilDue
    };
  }

  if (daysUntilDue === 0) {
    return {
      emailType: 'due_today_reminder',
      referenceDate: today,
      urgency: 'today',
      daysUntilDue
    };
  }

  if (daysUntilDue <= UPCOMING_REMINDER_DAYS) {
    return {
      emailType: 'upcoming_reminder',
      referenceDate: row.dueDate,
      urgency: 'upcoming',
      daysUntilDue
    };
  }

  return null;
}

function buildReminderEmail({ row, reminder, today }) {
  const choreName = taskName(row.task, row.task.id);
  const dueDateText = formatDate(row.dueDate);
  const person = normalizeName(row.person);

  let titleDe = 'Putzplan-Erinnerung';
  let titleEn = 'Cleaning reminder';
  let summaryDe = `${person}, eine Aufgabe ist bald fällig.`;
  let summaryEn = `${person}, a chore is coming up.`;
  let detailsDe = `Aufgabe: ${choreName}. Fällig am: ${dueDateText}.`;
  let detailsEn = `Chore: ${choreName}. Due date: ${dueDateText}.`;

  if (reminder.urgency === 'today') {
    titleDe = `Heute fällig: ${choreName}`;
    titleEn = `Due today: ${choreName}`;
    summaryDe = `${person}, diese Aufgabe ist heute fällig.`;
    summaryEn = `${person}, this chore is due today.`;
  }

  if (reminder.urgency === 'overdue') {
    const lateDays = Math.abs(reminder.daysUntilDue);

    titleDe = `Überfällig: ${choreName}`;
    titleEn = `Overdue: ${choreName}`;
    summaryDe = `${person}, diese Aufgabe ist seit ${lateDays} Tag${lateDays === 1 ? '' : 'en'} überfällig.`;
    summaryEn = `${person}, this chore is ${lateDays} day${lateDays === 1 ? '' : 's'} overdue.`;
    detailsDe += ` Heute ist ${formatDate(today)}. Wenn jemand anderes die überfällige Aufgabe übernimmt, werden die Fairness-Punkte angepasst.`;
    detailsEn += ` Today is ${formatDate(today)}. If someone else covers the overdue chore, fairness points will be adjusted.`;
  }

  if (row.bundledVacuumRow) {
    titleDe = `Boden-Aufgabe: ${choreName} + Staubsaugen`;
    titleEn = `Floor chore: ${choreName} + vacuuming`;
    detailsDe += ` Staubsaugen ist in diesem Termin enthalten. Die Boden-Regel hält mindestens ${FLOOR_MIN_GAP_DAYS} Tage Abstand zwischen Staubsaugen und Nasswischen; nahe Termine werden innerhalb von ${FLOOR_BUNDLE_WINDOW_DAYS} Tagen gebündelt.`;
    detailsEn += ` Vacuuming is included in this appointment. The floor rule keeps at least ${FLOOR_MIN_GAP_DAYS} days between vacuuming and mopping; nearby dates are bundled within ${FLOOR_BUNDLE_WINDOW_DAYS} days.`;
  }

  return bilingualEmail({ titleDe, titleEn, summaryDe, summaryEn, detailsDe, detailsEn });
}

async function sendReminderForRow(env, state, row, reminder, today) {
  const person = normalizeName(row.person);
  const profile = getProfile(state, person);

  if (!profile?.email) {
    return { status: 'skipped_no_email', person, taskId: row.task.id };
  }

  const emailType = row.bundledVacuumRow ? `${reminder.emailType}_floor_bundle` : reminder.emailType;
  const taskId = row.bundledVacuumRow ? 'deep_water+vacuum' : row.task.id;

  if (await alreadySent(env, { emailType, taskId, person, referenceDate: reminder.referenceDate })) {
    return { status: 'skipped_already_sent', person, taskId, emailType };
  }

  const email = buildReminderEmail({ row, reminder, today });
  const result = await sendAndLog(env, { to: profile.email, ...email }, {
    emailType,
    taskId,
    recipientPerson: person,
    referenceDate: reminder.referenceDate
  });

  return {
    status: result.ok ? 'sent' : 'failed',
    person,
    taskId,
    emailType,
    error: result.error || null
  };
}

function getWeekOverdueRows(rows, today) {
  return rows.filter(row => {
    if (row.task.type !== 'scheduled' || !row.dueDate || !row.person) return false;

    const daysUntilDue = diffDays(today, row.dueDate);
    if (daysUntilDue === null) return false;

    return Math.abs(daysUntilDue) > WEEK_OVERDUE_DAYS && daysUntilDue < 0;
  });
}

function buildWeekOverdueEmail({ row, today }) {
  const choreName = taskName(row.task, row.task.id);
  const person = normalizeName(row.person);
  const dueDateText = formatDate(row.dueDate);
  const lateDays = Math.abs(diffDays(today, row.dueDate) || 0);

  let bundleDe = '';
  let bundleEn = '';

  if (row.bundledVacuumRow) {
    bundleDe = ` Staubsaugen ist in dieser Aufgabe enthalten, weil die Boden-Aufgaben gebündelt wurden.`;
    bundleEn = ` Vacuuming is included in this chore because the floor tasks were bundled.`;
  }

  return bilingualEmail({
    titleDe: `Mehr als eine Woche überfällig: ${choreName}`,
    titleEn: `Overdue for more than one week: ${choreName}`,
    summaryDe: `Diese Aufgabe ist seit mehr als einer Woche überfällig.`,
    summaryEn: `This chore is overdue for more than one week.`,
    detailsDe:
      `Aufgabe: ${choreName}. Fällig seit: ${dueDateText}. Aktuell zuständig: ${person}. ` +
      `Die Aufgabe ist jetzt seit ${lateDays} Tagen überfällig.${bundleDe} ` +
      `Alle können helfen. Wenn jemand anderes diese Aufgabe übernimmt, wird die Fairness-Wertung automatisch angepasst.`,
    detailsEn:
      `Chore: ${choreName}. Due since: ${dueDateText}. Current assigned person: ${person}. ` +
      `The chore is now ${lateDays} days overdue.${bundleEn} ` +
      `Anyone can help. If someone else takes over this chore, the fairness score will adjust automatically.`
  });
}

async function sendWeekOverdueEscalations(env, state, rows, today) {
  const results = [];
  const overdueRows = getWeekOverdueRows(rows, today);

  for (const row of overdueRows) {
    const emailType = row.bundledVacuumRow
      ? 'week_overdue_floor_bundle_escalation'
      : 'week_overdue_escalation';

    const taskId = row.bundledVacuumRow ? 'deep_water+vacuum' : row.task.id;
    const referenceDate = `${taskId}:${row.dueDate}`;

    for (const profile of state.flatmateProfiles || []) {
      const person = normalizeName(profile.name);

      if (!profile.email) {
        results.push({ status: 'skipped_no_email', person, taskId, emailType });
        continue;
      }

      if (await alreadySent(env, { emailType, taskId, person, referenceDate })) {
        results.push({ status: 'skipped_already_sent', person, taskId, emailType });
        continue;
      }

      const email = buildWeekOverdueEmail({ row, today });
      const result = await sendAndLog(env, { to: profile.email, ...email }, {
        emailType,
        taskId,
        recipientPerson: person,
        referenceDate
      });

      results.push({
        status: result.ok ? 'sent' : 'failed',
        person,
        taskId,
        emailType,
        error: result.error || null
      });
    }
  }

  return results;
}

function getOverdueVacuumBundleRows(rows, today) {
  return rows.filter(row => {
    const bundledVacuum = row.bundledVacuumRow;
    if (!bundledVacuum) return false;
    if (!bundledVacuum.bundledBecauseOverdue) return false;
    if (!bundledVacuum.originalDueDate || !row.dueDate) return false;

    const lateDays = Math.abs(diffDays(today, bundledVacuum.originalDueDate) || 0);
    const gapToMopping = diffDays(today, row.dueDate);

    return lateDays > 0 && gapToMopping !== null && gapToMopping >= 0;
  });
}

function buildOverdueVacuumBundledEmail({ row, today }) {
  const moppingName = taskName(row.task, row.task.id);
  const vacuumTask = row.bundledVacuumRow.task;
  const vacuumName = taskName(vacuumTask, vacuumTask?.id || 'vacuum');

  const originalPerson = normalizeName(row.bundledVacuumRow.originalPerson);
  const floorPerson = normalizeName(row.person);

  const vacuumDueDate = row.bundledVacuumRow.originalDueDate;
  const moppingDueDate = row.dueDate;

  const lateDays = Math.abs(diffDays(today, vacuumDueDate) || 0);
  const pendingSubtasks = row.bundledVacuumRow.originalPendingSubtasks || [];
  const pendingSubtaskText = formatSubtaskList(pendingSubtasks);

  return bilingualEmail({
    titleDe: 'Boden-Aufgaben wurden gebündelt: Staubsaugen + Nasswischen',
    titleEn: 'Floor chores were bundled: vacuuming + mopping',

    summaryDe:
      'Die überfällige Staubsaug-Aufgabe wurde mit dem nahen Nasswisch-Termin zusammengelegt.',
    summaryEn:
      'The overdue vacuuming chore has been combined with the upcoming mopping chore.',

    detailsDe:
      `Staubsaugen war seit ${formatDate(vacuumDueDate)} offen und ist damit seit ${lateDays} Tag${lateDays === 1 ? '' : 'en'} überfällig. ` +
      `Offene Teile laut ursprünglicher Staubsaug-Aufgabe: ${pendingSubtaskText}. ` +
      `Da der Nasswisch-Termin am ${formatDate(moppingDueDate)} nahe ist und Nasswischen Staubsaugen einschließt, wird beides als eine gemeinsame Boden-Aufgabe gebündelt. ` +
      `Neuer gemeinsamer Termin: ${formatDate(moppingDueDate)}. ` +
      `Aufgabe: ${moppingName} + ${vacuumName}. ` +
      `Aktuell zuständig für die gebündelte Boden-Aufgabe: ${floorPerson}. ` +
      `Ursprünglich war Staubsaugen ${originalPerson} zugeordnet. ` +
      `Diese Nachricht ist nur eine Information an alle, weil sich der Bodenplan geändert hat. ` +
      `Die gebündelte Boden-Aufgabe bleibt aktuell ${floorPerson} zugeordnet.`,

    detailsEn:
      `Vacuuming had been open since ${formatDate(vacuumDueDate)}, so it is ${lateDays} day${lateDays === 1 ? '' : 's'} overdue. ` +
      `Pending parts from the original vacuuming chore: ${pendingSubtaskText}. ` +
      `Because the mopping date on ${formatDate(moppingDueDate)} is nearby and mopping includes vacuuming, both chores are now bundled into one floor chore. ` +
      `New combined date: ${formatDate(moppingDueDate)}. ` +
      `Chore: ${moppingName} + ${vacuumName}. ` +
      `Current assigned person for the bundled floor chore: ${floorPerson}. ` +
      `The original vacuuming chore was assigned to ${originalPerson}. ` +
      `This message is only an information update for everyone because the floor schedule changed. ` +
      `The bundled floor chore is still currently assigned to ${floorPerson}.`
  });
}

async function sendOverdueVacuumBundleNotices(env, state, rows, today) {
  const results = [];
  const bundleRows = getOverdueVacuumBundleRows(rows, today);

  for (const row of bundleRows) {
    const emailType = 'overdue_vacuum_bundled_notice';
    const taskId = 'deep_water+vacuum';
    const referenceDate = `${row.bundledVacuumRow.originalDueDate}->${row.dueDate}`;

    for (const profile of state.flatmateProfiles || []) {
      const person = normalizeName(profile.name);

      if (!profile.email) {
        results.push({ status: 'skipped_no_email', person, taskId, emailType });
        continue;
      }

      if (await alreadySent(env, { emailType, taskId, person, referenceDate })) {
        results.push({ status: 'skipped_already_sent', person, taskId, emailType });
        continue;
      }

      const email = buildOverdueVacuumBundledEmail({ row, today });
      const result = await sendAndLog(env, { to: profile.email, ...email }, {
        emailType,
        taskId,
        recipientPerson: person,
        referenceDate
      });

      results.push({
        status: result.ok ? 'sent' : 'failed',
        person,
        taskId,
        emailType,
        error: result.error || null
      });
    }
  }

  return results;
}

async function logMaintenanceRun(env, payload) {
  try {
    await env.DB.prepare(`
      INSERT INTO maintenance_runs (id, run_date, run_type, status, details)
      VALUES (?, ?, ?, ?, ?)
    `)
      .bind(
        crypto.randomUUID(),
        todayIso(),
        payload.runType || 'scheduled',
        payload.status || 'ok',
        JSON.stringify(payload.details || {})
      )
      .run();
  } catch (_error) {
    // maintenance_runs is optional; do not fail the cron if the table was not created.
  }
}

export async function runMaintenance(env, options = {}) {
  const now = options.now || new Date();
  const today = todayIso();
  const hour = germanHour(now);

  if (!options.force && !insideSendWindow(now)) {
    await logMaintenanceRun(env, {
      runType: options.runType || 'scheduled',
      status: 'skipped_outside_send_window',
      details: { today, germanHour: hour }
    });

    return {
      ok: true,
      skipped: true,
      reason: 'outside_send_window',
      today,
      germanHour: hour,
      results: []
    };
  }

  const state = await readState(env);
  const rows = makeTaskRows(state, today);

  const dueRows = rows
    .map(row => ({ row, reminder: classifyReminder(row, today) }))
    .filter(item => item.reminder);

  const results = [];

  for (const item of dueRows) {
    results.push(await sendReminderForRow(env, state, item.row, item.reminder, today));
  }

  let groupNoticeResults = [];
  let weekOverdueResults = [];

  if (options.force || shouldSendGroupNotices(now)) {
    groupNoticeResults = await sendOverdueVacuumBundleNotices(env, state, rows, today);
    weekOverdueResults = await sendWeekOverdueEscalations(env, state, rows, today);

    results.push(...groupNoticeResults, ...weekOverdueResults);
  }

  await logMaintenanceRun(env, {
    runType: options.runType || 'scheduled',
    status: 'ok',
    details: {
      today,
      germanHour: hour,
      checkedRows: rows.length,
      reminderRows: dueRows.length,
      groupNoticeRows: groupNoticeResults.length,
      weekOverdueRows: weekOverdueResults.length,
      results
    }
  });

  return {
    ok: true,
    today,
    germanHour: hour,
    checkedRows: rows.length,
    reminderRows: dueRows.length,
    groupNoticeRows: groupNoticeResults.length,
    weekOverdueRows: weekOverdueResults.length,
    results
  };
}