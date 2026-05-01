import {
  APP_TIME_ZONE,
  FLOOR_BUNDLE_WINDOW_DAYS,
  FLOOR_MIN_GAP_DAYS,
  diffDays,
  fairPersonForDate,
  getActivePeriod,
  getDueDateFromLastLog,
  lastLog,
  normalizeName,
  readState,
  shouldBundleFloorTasks,
  todayIso
} from './_shared.js';
import { bilingualEmail, sendAndLog } from './email.js';

const SEND_WINDOW_START_HOUR = 7;
const SEND_WINDOW_END_HOUR = 21;
const UPCOMING_REMINDER_DAYS = 1;

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

function taskName(task, fallback = '') {
  return task?.name || fallback || task?.id || '';
}

function getProfile(state, person) {
  return (state.flatmateProfiles || []).find(
    profile => normalizeName(profile.name) === normalizeName(person)
  );
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

function makeTaskRows(state) {
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
    const originalVacuumPerson = fairPersonForDate({
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

    deep.person = floorPerson;
    deep.bundledVacuumRow = {
      ...vacuum,
      originalDueDate: vacuum.dueDate,
      originalPerson: originalVacuumPerson,
      dueDate: deep.dueDate,
      person: floorPerson
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
      if (a.task.type !== b.task.type) return a.task.type === 'scheduled' ? -1 : 1;
      return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
    });

  for (const row of assignmentOrder) {
    if (row.person) continue;

    row.person = fairPersonForDate({
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

  if (!options.force && !insideSendWindow(now)) {
    await logMaintenanceRun(env, {
      runType: options.runType || 'scheduled',
      status: 'skipped_outside_send_window',
      details: { today, germanHour: germanHour(now) }
    });

    return {
      ok: true,
      skipped: true,
      reason: 'outside_send_window',
      today,
      germanHour: germanHour(now),
      results: []
    };
  }

  const state = await readState(env);
  const rows = makeTaskRows(state);
  const dueRows = rows
    .map(row => ({ row, reminder: classifyReminder(row, today) }))
    .filter(item => item.reminder);

  const results = [];
  for (const item of dueRows) {
    results.push(await sendReminderForRow(env, state, item.row, item.reminder, today));
  }

  await logMaintenanceRun(env, {
    runType: options.runType || 'scheduled',
    status: 'ok',
    details: { today, germanHour: germanHour(now), checkedRows: rows.length, reminderRows: dueRows.length, results }
  });

  return { ok: true, today, germanHour: germanHour(now), checkedRows: rows.length, reminderRows: dueRows.length, results };
}
