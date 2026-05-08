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

const UPCOMING_WEEK_REMINDER_DAYS = 7;
const UPCOMING_REMINDER_DAYS = 1;
const GRACE_PERIOD_DAYS = 3;
const OVERDUE_FOR_DAYS_NOTICE = 3;
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

  // Existing previous email: 1 day before due date.
  if (daysUntilDue === UPCOMING_REMINDER_DAYS) {
    return {
      emailType: 'upcoming_reminder',
      referenceDate: row.dueDate,
      urgency: 'upcoming',
      daysUntilDue
    };
  }

  // New email: due within the next week.
  // This intentionally excludes day 1 so the previous 1-day reminder remains separate.
  if (
    daysUntilDue > UPCOMING_REMINDER_DAYS &&
    daysUntilDue <= UPCOMING_WEEK_REMINDER_DAYS
  ) {
    return {
      emailType: 'upcoming_week_reminder',
      referenceDate: `${row.dueDate}:week-${daysUntilDue}`,
      urgency: 'upcoming_week',
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

  if (daysUntilDue < 0) {
    const daysPastDue = Math.abs(daysUntilDue);

    // Due date + day 1 and day 2 are grace period silence.
    if (daysPastDue < GRACE_PERIOD_DAYS) {
      return null;
    }

    // Due date + day 3: grace-period-ending email.
    if (daysPastDue === GRACE_PERIOD_DAYS) {
      return {
        emailType: 'grace_period_ending_reminder',
        referenceDate: `${row.dueDate}:grace-ending`,
        urgency: 'grace_ending',
        daysUntilDue,
        daysPastDue
      };
    }

    // Overdue starts after the 3-day grace period.
    const overdueDays = daysPastDue - GRACE_PERIOD_DAYS;

    // 3 actual overdue days after grace period.
    // Example: due + 6 days.
    if (overdueDays === OVERDUE_FOR_DAYS_NOTICE) {
      return {
        emailType: 'overdue_3_days_reminder',
        referenceDate: `${row.dueDate}:overdue-${OVERDUE_FOR_DAYS_NOTICE}`,
        urgency: 'overdue_3_days',
        daysUntilDue,
        daysPastDue,
        overdueDays
      };
    }

    return {
      emailType: 'overdue_reminder',
      referenceDate: `${today}:${row.dueDate}`,
      urgency: 'overdue',
      daysUntilDue,
      daysPastDue,
      overdueDays
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
  let summaryDe = `${person}, eine Aufgabe ist bald geplant.`;
  let summaryEn = `${person}, a chore is coming up.`;
  let detailsDe = `Aufgabe: ${choreName}. Geplant ab: ${dueDateText}.`;
  let detailsEn = `Chore: ${choreName}. Scheduled from: ${dueDateText}.`;

  if (reminder.urgency === 'upcoming_week') {
    titleDe = `In den nächsten 7 Tagen geplant: ${choreName}`;
    titleEn = `Scheduled in the next 7 days: ${choreName}`;
    summaryDe = `${person}, diese Aufgabe ist in ${reminder.daysUntilDue} Tagen geplant.`;
    summaryEn = `${person}, this chore is scheduled in ${reminder.daysUntilDue} days.`;
    detailsDe += ` Du bekommst zusätzlich weiterhin die normale Erinnerung 1 Tag vorher. Ab dem geplanten Datum gibt es ${GRACE_PERIOD_DAYS} Tage Kulanzzeit.`;
    detailsEn += ` You will still also receive the normal reminder 1 day before. From the scheduled date, there is a ${GRACE_PERIOD_DAYS}-day grace period.`;
  }

  if (reminder.urgency === 'upcoming') {
    titleDe = `Ab morgen geplant: ${choreName}`;
    titleEn = `Scheduled from tomorrow: ${choreName}`;
    summaryDe = `${person}, diese Aufgabe ist ab morgen geplant.`;
    summaryEn = `${person}, this chore is scheduled from tomorrow.`;
    detailsDe += ` Ab dem geplanten Datum gibt es ${GRACE_PERIOD_DAYS} Tage Kulanzzeit.`;
    detailsEn += ` From the scheduled date, there is a ${GRACE_PERIOD_DAYS}-day grace period.`;
  }

  if (reminder.urgency === 'today') {
    titleDe = `Ab heute geplant: ${choreName}`;
    titleEn = `Scheduled from today: ${choreName}`;
    summaryDe = `${person}, diese Aufgabe ist ab heute geplant.`;
    summaryEn = `${person}, this chore is scheduled from today.`;
    detailsDe += ` Ab heute beginnt eine Kulanzzeit von ${GRACE_PERIOD_DAYS} Tagen.`;
    detailsEn += ` From today, a ${GRACE_PERIOD_DAYS}-day grace period begins.`;
  }

  if (reminder.urgency === 'grace_ending') {
    titleDe = `Kulanzzeit endet heute: ${choreName}`;
    titleEn = `Grace period ends today: ${choreName}`;
    summaryDe = `${person}, die Kulanzzeit für diese Aufgabe endet heute.`;
    summaryEn = `${person}, the grace period for this chore ends today.`;
    detailsDe =
      `Aufgabe: ${choreName}. Geplant ab: ${dueDateText}. ` +
      `Heute ist der ${GRACE_PERIOD_DAYS}. Tag nach dem geplanten Startdatum. ` +
      `Wenn die Aufgabe danach offen bleibt, zählt sie als überfällig.`;
    detailsEn =
      `Chore: ${choreName}. Scheduled from: ${dueDateText}. ` +
      `Today is day ${GRACE_PERIOD_DAYS} after the scheduled-from date. ` +
      `If the chore remains open after this, it will count as overdue.`;
  }

  if (reminder.urgency === 'overdue') {
    titleDe = `Überfällig: ${choreName}`;
    titleEn = `Overdue: ${choreName}`;
    summaryDe = `${person}, diese Aufgabe ist jetzt überfällig.`;
    summaryEn = `${person}, this chore is now overdue.`;
    detailsDe =
      `Aufgabe: ${choreName}. Geplant ab: ${dueDateText}. ` +
      `Die ${GRACE_PERIOD_DAYS}-tägige Kulanzzeit ist abgelaufen. ` +
      `Die Aufgabe ist aktuell ${reminder.overdueDays} Tag${reminder.overdueDays === 1 ? '' : 'e'} überfällig. ` +
      `Wenn jemand anderes die Aufgabe übernimmt, werden die Fairness-Punkte angepasst.`;
    detailsEn =
      `Chore: ${choreName}. Scheduled from: ${dueDateText}. ` +
      `The ${GRACE_PERIOD_DAYS}-day grace period has ended. ` +
      `The chore is currently ${reminder.overdueDays} day${reminder.overdueDays === 1 ? '' : 's'} overdue. ` +
      `If someone else covers it, fairness points will be adjusted.`;
  }

  if (reminder.urgency === 'overdue_3_days') {
    titleDe = `Seit 3 Tagen überfällig: ${choreName}`;
    titleEn = `Overdue for 3 days: ${choreName}`;
    summaryDe = `${person}, diese Aufgabe ist seit 3 Tagen überfällig.`;
    summaryEn = `${person}, this chore has been overdue for 3 days.`;
    detailsDe =
      `Aufgabe: ${choreName}. Geplant ab: ${dueDateText}. ` +
      `Nach der ${GRACE_PERIOD_DAYS}-tägigen Kulanzzeit ist die Aufgabe nun seit ${OVERDUE_FOR_DAYS_NOTICE} Tagen überfällig. ` +
      `Bitte erledige sie möglichst bald. Wenn jemand anderes sie übernimmt, werden die Fairness-Punkte angepasst.`;
    detailsEn =
      `Chore: ${choreName}. Scheduled from: ${dueDateText}. ` +
      `After the ${GRACE_PERIOD_DAYS}-day grace period, this chore has now been overdue for ${OVERDUE_FOR_DAYS_NOTICE} days. ` +
      `Please complete it as soon as possible. If someone else covers it, fairness points will be adjusted.`;
  }

  if (row.bundledVacuumRow) {
    titleDe = `Boden-Aufgabe: ${choreName} + Staubsaugen`;
    titleEn = `Floor chore: ${choreName} + vacuuming`;
    detailsDe += ` Staubsaugen ist in diesem Termin enthalten.`;
    detailsEn += ` Vacuuming is included in this appointment.`;
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
    if (daysUntilDue === null || daysUntilDue >= 0) return false;

    const daysPastDue = Math.abs(daysUntilDue);

    // Group escalation goes to all flatmates on Due + 7.
    // alreadySent() prevents repeating it after that.
    return daysPastDue >= WEEK_OVERDUE_DAYS;
  });
}

function buildWeekOverdueEmail({ row, today }) {
  const choreName = taskName(row.task, row.task.id);
  const person = normalizeName(row.person);
  const dueDateText = formatDate(row.dueDate);
  const daysPastDue = Math.abs(diffDays(today, row.dueDate) || 0);

  let bundleDe = '';
  let bundleEn = '';

  if (row.bundledVacuumRow) {
    bundleDe = ` Staubsaugen ist in dieser Aufgabe enthalten, weil die Boden-Aufgaben gebündelt wurden.`;
    bundleEn = ` Vacuuming is included in this chore because the floor tasks were bundled.`;
  }

  return bilingualEmail({
    titleDe: `Seit 7 Tagen offen: ${choreName}`,
    titleEn: `Open for 7 days: ${choreName}`,
    summaryDe: `Diese Aufgabe ist seit 7 Tagen nach dem geplanten Startdatum offen.`,
    summaryEn: `This chore has been open for 7 days after the scheduled-from date.`,
    detailsDe:
      `Aufgabe: ${choreName}. Geplant ab: ${dueDateText}. Aktuell zuständig: ${person}. ` +
      `Die Aufgabe ist jetzt seit ${daysPastDue} Tag${daysPastDue === 1 ? '' : 'en'} nach dem geplanten Startdatum offen.${bundleDe} ` +
      `Alle können helfen. Wenn jemand anderes diese Aufgabe übernimmt, wird die Fairness-Wertung automatisch angepasst.`,
    detailsEn:
      `Chore: ${choreName}. Scheduled from: ${dueDateText}. Current assigned person: ${person}. ` +
      `The chore has now been open for ${daysPastDue} day${daysPastDue === 1 ? '' : 's'} after the scheduled-from date.${bundleEn} ` +
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
      `Da Nasswischen ab ${formatDate(moppingDueDate)} geplant ist und Nasswischen Staubsaugen einschließt, wird beides als eine gemeinsame Boden-Aufgabe gebündelt. ` +
      `Gemeinsam geplant ab: ${formatDate(moppingDueDate)}. ` +
      `Aufgabe: ${moppingName} + ${vacuumName}. ` +
      `Aktuell zuständig für die gebündelte Boden-Aufgabe: ${floorPerson}. ` +
      `Ursprünglich war Staubsaugen ${originalPerson} zugeordnet. ` +
      `Diese Nachricht ist nur eine Information an alle, weil sich der Bodenplan geändert hat. ` +
      `Die gebündelte Boden-Aufgabe bleibt aktuell ${floorPerson} zugeordnet.`,

    detailsEn:
      `Vacuuming had been open since ${formatDate(vacuumDueDate)}, so it is ${lateDays} day${lateDays === 1 ? '' : 's'} overdue. ` +
      `Pending parts from the original vacuuming chore: ${pendingSubtaskText}. ` +
      `Because mopping is scheduled from ${formatDate(moppingDueDate)} and mopping includes vacuuming, both chores are now bundled into one floor chore. ` +
      `Combined chore scheduled from: ${formatDate(moppingDueDate)}. ` +
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