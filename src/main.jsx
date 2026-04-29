import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  History,
  Home,
  Loader2,
  Mail,
  Menu,
  Pencil,
  Sparkles,
  Trophy,
  X
} from 'lucide-react';
import './styles.css';

const TODAY = new Date().toISOString().slice(0, 10);
const FLOOR_MERGE_WINDOW_DAYS = 2;

const TASK_TIE_OFFSETS = {
  gas_stove: 0,
  deep_water: 1,
  bath_toilet_basin: 2,
  driveway_backyard: 0,
  vacuum: 2,
  bio_bin: 1,
  yellow_bin: 2,
  black_bin: 0,
  paper_bin: 1
};

const translations = {
  en: {
    badge: 'Shared apartment scheduler',
    title: 'Cleaning schedule',
    subtitle:
      'For Melanie, Animesh and Naveen. The next person is chosen by actual completed work, so swaps stay fair.',
    navigation: 'Navigation',
    dashboard: 'Dashboard',
    nextTasks: 'Next tasks',
    nextTasksHelp: 'Upcoming, overdue and on-demand cleaning work.',
    markDone: 'Mark done',
    markDoneHelp: 'Enter the task and date. It will be saved under your logged-in profile.',
    recentLog: 'Recent log',
    recentLogHelp: 'Latest completed cleaning entries.',
    scores: 'Scores',
    scoresHelp:
      'Base score shows task difficulty. Earned score shows points collected in the current scoring period.',
    totalScore: 'Total score',
    positiveScore: 'Work points',
    negativeScore: 'Covered by others',
    taskScores: 'Task scores',
    task: 'Task',
    dateDone: 'Date done',
    note: 'Note',
    optional: 'Optional',
    saveCompleted: 'Save completed task',
    saving: 'Saving…',
    saved: 'Task saved successfully.',
    lastDone: 'Last done',
    noRecord: 'No record yet',
    nextDate: 'Next date',
    nextPerson: 'Next person',
    status: 'Status',
    whenFull: 'When full',
    notScheduled: 'Not scheduled yet',
    addFirstRecord: 'Add first record',
    needsCleaning: 'Needs cleaning',
    onDemand: 'On demand',
    binFull: 'Bin is full / needs cleaning',
    linkedDeep: 'Bundled with deep water cleaning on this date.',
    deepIncludesVacuum: 'This task includes vacuum cleaning on the same day.',
    didVacuumQuestion: 'Have you also vacuumed the flat?',
    didVacuumHelp:
      'Deep water cleaning usually needs vacuuming first. Select this only if vacuuming was actually done too.',
    yesVacuumDone: 'Yes, vacuum was also done',
    noVacuumDone: 'No, only deep water cleaning',
    by: 'by',
    loading: 'Loading…',
    loadError: 'Could not load app data.',
    saveError: 'Could not save. Please try again.',
    futureDateError: 'Future dates are not allowed.',
    auto: 'Auto',
    german: 'German',
    english: 'English',
    language: 'Language',
    languageHelp: 'Choose the app language. Auto uses your device language.',
    dueToday: 'Due today',
    menu: 'Menu',
    close: 'Close',
    jumpTo: 'Jump to',
    selectPlaceholder: 'Select',
    whoAreYou: 'Who are you?',
    chooseProfile: 'Choose your profile once on this device.',
    continueAs: 'Continue as',
    switchUser: 'Switch user',
    yourTask: 'Your task',
    markingAs: 'This will be saved as',
    noUserSelected: 'Please choose who you are first.',
    quickMarkDone: 'Mark this task done',
    openTask: 'Open task',
    cancel: 'Cancel',
    profile: 'Profile',
    yourPendingTasks: 'Your due tasks',
    onePendingTask: '1 due task',
    manyPendingTasks: n => `${n} due tasks`,
    noPendingTasks: 'No due tasks',
    subtasks: 'Areas / subtasks',
    selectAll: 'Select all',
    partialTask: 'Uncheck anything that was not completed.',
    pendingParts: 'Still pending',
    emailTitle: 'Email required',
    emailInfo:
      'We use this email to send reminder emails, overdue notifications, score updates, and milestone emails.',
    emailAddress: 'Email address',
    saveAndContinue: 'Save and continue',
    changeEmail: 'Change email',
    emailSaved: 'Email saved successfully.',
    invalidEmail: 'Please enter a valid email address.',
    admin: 'Admin',
    adminPanel: 'Admin panel',
    adminHelp:
      'Manage active flatmates. User changes start a new fair scoring period for everyone.',
    userName: 'User name',
    addUser: 'Add user',
    updateUser: 'Update email',
    deleteUser: 'Delete',
    activeUsers: 'Active users',
    developer: 'Developer',
    developerTools: 'Developer tools',
    developerHelp:
      'Test UI, scores, and email delivery without changing real scores.',
    dummyTask: 'Developer dummy task',
    dummyTaskHelp:
      'Test saving and UI without affecting real scores, due dates, bin status, emails, or milestones.',
    sendTestEmail: 'Send test email',
    recentEmails: 'Recent email log',
    history: 'History',
    previousPeriods: 'Previous periods',
    historyHelp:
      'Old scoring periods are kept here when flatmates change. This keeps the current period fair for new tenants.',
    showDetails: 'Show details',
    hideDetails: 'Hide details',
    baseScore: 'Base difficulty score',
    earnedScore: 'Earned score',
    singleTask: 'Single task',
    activePeriod: 'Active scoring period',
    confirmAdminPin: 'Enter admin PIN',
    noEmail: 'No email yet',
    enabled: 'Enabled',
    disabled: 'Disabled',
    late: n => `${n} day${n === 1 ? '' : 's'} late`,
    dueIn: n => `Due in ${n} day${n === 1 ? '' : 's'}`,
    taskNames: {
      vacuum: 'Vacuum cleaning whole flat',
      deep_water: 'Deep water cleaning whole flat',
      bath_toilet_basin: 'Bathtub, toilet and wash basin cleaning',
      gas_stove: 'Gas stove cleaning',
      bio_bin: 'Bio trash bin cleaning',
      yellow_bin: 'Yellow trash bin cleaning',
      black_bin: 'Black trash bin cleaning',
      paper_bin: 'Paper trash bin cleaning',
      driveway_backyard: 'Driveway and backyard cleaning'
    }
  },

  de: {
    badge: 'WG-Putzplan',
    title: 'Putzplan',
    subtitle:
      'Für Melanie, Animesh und Naveen. Die nächste Person wird anhand der tatsächlich erledigten Aufgaben gewählt, damit Tauschen fair bleibt.',
    navigation: 'Navigation',
    dashboard: 'Übersicht',
    nextTasks: 'Nächste Aufgaben',
    nextTasksHelp: 'Anstehende, überfällige und bedarfsabhängige Putzaufgaben.',
    markDone: 'Erledigt eintragen',
    markDoneHelp: 'Wähle Aufgabe und Datum. Der Eintrag wird unter deinem Profil gespeichert.',
    recentLog: 'Letzte Einträge',
    recentLogHelp: 'Die neuesten erledigten Putzaufgaben.',
    scores: 'Punkte',
    scoresHelp:
      'Basis-Punkte zeigen die Schwierigkeit. Erarbeitete Punkte zeigen Punkte in der aktuellen Punkteperiode.',
    totalScore: 'Gesamtpunkte',
    positiveScore: 'Arbeitspunkte',
    negativeScore: 'Von anderen übernommen',
    taskScores: 'Punkte nach Aufgabe',
    task: 'Aufgabe',
    dateDone: 'Erledigt am',
    note: 'Notiz',
    optional: 'Optional',
    saveCompleted: 'Erledigte Aufgabe speichern',
    saving: 'Speichert…',
    saved: 'Aufgabe erfolgreich gespeichert.',
    lastDone: 'Zuletzt erledigt',
    noRecord: 'Noch kein Eintrag',
    nextDate: 'Nächstes Datum',
    nextPerson: 'Nächste Person',
    status: 'Status',
    whenFull: 'Wenn voll',
    notScheduled: 'Noch nicht geplant',
    addFirstRecord: 'Ersten Eintrag hinzufügen',
    needsCleaning: 'Muss gereinigt werden',
    onDemand: 'Nach Bedarf',
    binFull: 'Tonne ist voll / muss gereinigt werden',
    linkedDeep: 'In diesem Zyklus mit der Nassreinigung gebündelt.',
    deepIncludesVacuum: 'Diese Aufgabe enthält Staubsaugen am selben Tag.',
    didVacuumQuestion: 'Hast du auch staubgesaugt?',
    didVacuumHelp:
      'Vor der Nassreinigung sollte normalerweise staubgesaugt werden. Wähle dies nur aus, wenn Staubsaugen wirklich erledigt wurde.',
    yesVacuumDone: 'Ja, Staubsaugen wurde auch erledigt',
    noVacuumDone: 'Nein, nur Nassreinigung erledigt',
    by: 'von',
    loading: 'Lädt…',
    loadError: 'App-Daten konnten nicht geladen werden.',
    saveError: 'Konnte nicht speichern. Bitte erneut versuchen.',
    futureDateError: 'Zukünftige Daten sind nicht erlaubt.',
    auto: 'Auto',
    german: 'Deutsch',
    english: 'Englisch',
    language: 'Sprache',
    languageHelp: 'Wähle die App-Sprache. Auto nutzt die Gerätesprache.',
    dueToday: 'Heute fällig',
    menu: 'Menü',
    close: 'Schließen',
    jumpTo: 'Springen zu',
    selectPlaceholder: 'Auswählen',
    whoAreYou: 'Wer bist du?',
    chooseProfile: 'Wähle dein Profil einmal auf diesem Gerät.',
    continueAs: 'Weiter als',
    switchUser: 'Benutzer wechseln',
    yourTask: 'Deine Aufgabe',
    markingAs: 'Dies wird gespeichert als',
    noUserSelected: 'Bitte wähle zuerst aus, wer du bist.',
    quickMarkDone: 'Diese Aufgabe erledigt eintragen',
    openTask: 'Aufgabe öffnen',
    cancel: 'Abbrechen',
    profile: 'Profil',
    yourPendingTasks: 'Deine fälligen Aufgaben',
    onePendingTask: '1 fällige Aufgabe',
    manyPendingTasks: n => `${n} fällige Aufgaben`,
    noPendingTasks: 'Keine fälligen Aufgaben',
    subtasks: 'Bereiche / Teilaufgaben',
    selectAll: 'Alle auswählen',
    partialTask: 'Entferne alles, was nicht erledigt wurde.',
    pendingParts: 'Noch offen',
    emailTitle: 'E-Mail erforderlich',
    emailInfo:
      'Wir verwenden diese E-Mail für Erinnerungen, überfällige Aufgaben, Punkte-Updates und Meilenstein-E-Mails.',
    emailAddress: 'E-Mail-Adresse',
    saveAndContinue: 'Speichern und weiter',
    changeEmail: 'E-Mail ändern',
    emailSaved: 'E-Mail erfolgreich gespeichert.',
    invalidEmail: 'Bitte gib eine gültige E-Mail-Adresse ein.',
    admin: 'Admin',
    adminPanel: 'Adminbereich',
    adminHelp:
      'Aktive Mitbewohner verwalten. Änderungen starten eine neue faire Punkteperiode für alle.',
    userName: 'Name',
    addUser: 'Benutzer hinzufügen',
    updateUser: 'E-Mail ändern',
    deleteUser: 'Löschen',
    activeUsers: 'Aktive Benutzer',
    developer: 'Entwickler',
    developerTools: 'Entwickler-Tools',
    developerHelp:
      'UI, Punkte und E-Mail-Versand testen, ohne echte Punkte zu ändern.',
    dummyTask: 'Entwickler-Testaufgabe',
    dummyTaskHelp:
      'Speichern und UI testen, ohne echte Punkte, Fälligkeiten, Tonnenstatus, E-Mails oder Meilensteine zu beeinflussen.',
    sendTestEmail: 'Test-E-Mail senden',
    recentEmails: 'Letzte E-Mail-Logs',
    history: 'Historie',
    previousPeriods: 'Frühere Perioden',
    historyHelp:
      'Alte Punkteperioden bleiben hier erhalten, wenn Mitbewohner wechseln. So bleibt die aktuelle Periode fair für neue Mieter.',
    showDetails: 'Details anzeigen',
    hideDetails: 'Details ausblenden',
    baseScore: 'Basis-Schwierigkeitspunkte',
    earnedScore: 'Erarbeitete Punkte',
    singleTask: 'Einzelaufgabe',
    activePeriod: 'Aktive Punkteperiode',
    confirmAdminPin: 'Admin-PIN eingeben',
    noEmail: 'Noch keine E-Mail',
    enabled: 'Aktiv',
    disabled: 'Inaktiv',
    late: n => `${n} Tag${n === 1 ? '' : 'e'} überfällig`,
    dueIn: n => `Fällig in ${n} Tag${n === 1 ? '' : 'en'}`,
    taskNames: {
      vacuum: 'Gesamte Wohnung staubsaugen',
      deep_water: 'Gesamte Wohnung nass wischen',
      bath_toilet_basin: 'Badewanne, Toilette und Waschbecken reinigen',
      gas_stove: 'Gasherd reinigen',
      bio_bin: 'Biomülltonne reinigen',
      yellow_bin: 'Gelbe Tonne reinigen',
      black_bin: 'Schwarze Tonne reinigen',
      paper_bin: 'Papiertonne reinigen',
      driveway_backyard: 'Einfahrt und Hinterhof reinigen'
    }
  }
};

function getLanguageFromSetting(setting) {
  if (setting === 'en' || setting === 'de') return setting;

  const browserLanguages = navigator.languages?.length
    ? navigator.languages
    : [navigator.language || ''];

  const firstKnown = browserLanguages
    .map(lang => lang.toLowerCase())
    .find(lang => lang.startsWith('en') || lang.startsWith('de'));

  if (firstKnown?.startsWith('en')) return 'en';
  if (firstKnown?.startsWith('de')) return 'de';

  return 'de';
}

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

function diffDays(from, to) {
  if (!from || !to) return null;

  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  const diff = Math.round((b - a) / 86400000);

  return Number.isNaN(diff) ? null : diff;
}

function fmt(date, fallback = 'Not scheduled yet', lang = 'de') {
  if (!date) return fallback;

  const locale = lang === 'de' ? 'de-DE' : 'en-GB';

  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`));
}

function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : String(name || '').trim();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function lastLog(logs, taskId) {
  return logs
    .filter(log => log.taskId === taskId && !log.isDummy)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
}

function getDueDateFromLastLog(task, last) {
  if (!last) return null;

  if (last.nextDueDate) return last.nextDueDate;

  if (task.type === 'scheduled' && task.intervalDays) {
    return addDays(last.date, task.intervalDays);
  }

  return null;
}

function rotatedRank(person, people, taskId) {
  const normalizedPeople = people.map(normalizeName);
  const offset = TASK_TIE_OFFSETS[taskId] ?? 0;
  const rotated = [
    ...normalizedPeople.slice(offset),
    ...normalizedPeople.slice(0, offset)
  ];

  const index = rotated.indexOf(normalizeName(person));
  return index === -1 ? 999 : index;
}

function calculateScores(people, logs, task, activePeriodId = null) {
  const normalizedPeople = people.map(normalizeName);
  const taskIds = task.taskGroup === 'floor' ? ['vacuum', 'deep_water'] : [task.id];

  const scores = Object.fromEntries(normalizedPeople.map(person => [person, 0]));
  const lastDates = Object.fromEntries(
    normalizedPeople.map(person => [person, '1900-01-01'])
  );

  for (const log of logs) {
    if (log.isDummy) continue;
    if (activePeriodId && log.scoringPeriodId !== activePeriodId) continue;
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

function fairPerson(people, logs, task, activePeriodId = null) {
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

    if ((lastDates[a] || '1900-01-01') !== (lastDates[b] || '1900-01-01')) {
      return (lastDates[a] || '1900-01-01').localeCompare(
        lastDates[b] || '1900-01-01'
      );
    }

    return rotatedRank(a, normalizedPeople, task.id) - rotatedRank(b, normalizedPeople, task.id);
  })[0];
}

function fairPersonAvoiding(people, logs, task, avoidPerson, activePeriodId = null) {
  const avoid = normalizeName(avoidPerson);

  const { scores, lastDates, normalizedPeople } = calculateScores(
    people,
    logs,
    task,
    activePeriodId
  );

  const candidates = normalizedPeople.filter(person => person !== avoid);

  if (!candidates.length) return avoid;

  return candidates.sort((a, b) => {
    if ((scores[a] || 0) !== (scores[b] || 0)) {
      return (scores[a] || 0) - (scores[b] || 0);
    }

    if ((lastDates[a] || '1900-01-01') !== (lastDates[b] || '1900-01-01')) {
      return (lastDates[a] || '1900-01-01').localeCompare(
        lastDates[b] || '1900-01-01'
      );
    }

    return rotatedRank(a, candidates, task.id) - rotatedRank(b, candidates, task.id);
  })[0];
}

function status(row, fullBins, t) {
  if (row.task.type === 'on_demand') {
    return fullBins[row.task.id] ? [t.needsCleaning, 'bad'] : [t.onDemand, 'plain'];
  }

  if (!row.dueDate) return [t.addFirstRecord, 'plain'];

  const d = diffDays(TODAY, row.dueDate);

  if (d === null) return [t.addFirstRecord, 'plain'];
  if (d < 0) return [t.late(Math.abs(d)), 'bad'];
  if (d === 0) return [t.dueToday, 'warn'];
  if (d <= 3) return [t.dueIn(d), 'warn'];

  return [t.dueIn(d), 'good'];
}

function shouldBundleVacuumWithDeep(vacuumRow, deepRow) {
  if (!vacuumRow || !deepRow || !vacuumRow.dueDate || !deepRow.dueDate) return false;

  const gap = diffDays(vacuumRow.dueDate, deepRow.dueDate);

  if (gap === null) return false;
  if (vacuumRow.dueDate === deepRow.dueDate) return true;

  return gap >= 0 && gap <= FLOOR_MERGE_WINDOW_DAYS;
}

function FancySelect({ label, value, onChange, options, placeholder, className = '' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!ref.current?.contains(event.target)) setOpen(false);
    }

    function handleEscape(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const selected = options.find(option => option.value === value);

  return (
    <label className={`fancy-field ${className}`}>
      {label && <span className="field-label">{label}</span>}

      <div className={`fancy-select ${open ? 'open' : ''}`} ref={ref}>
        <button
          type="button"
          className="fancy-trigger"
          onClick={() => setOpen(current => !current)}
          aria-expanded={open}
        >
          <span className="fancy-value">{selected?.label || placeholder}</span>
          <ChevronDown size={18} className="fancy-chevron" />
        </button>

        {open && (
          <div className="fancy-menu">
            {options.map(option => (
              <button
                type="button"
                key={option.value}
                className={`fancy-option ${option.value === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span>{option.label}</span>
                {option.value === value && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>
    </label>
  );
}

function App() {
  const [languageSetting, setLanguageSetting] = useState(
    localStorage.getItem('flatclean_lang') || 'auto'
  );

  const lang = getLanguageFromSetting(languageSetting);
  const t = translations[lang];

  const [activePage, setActivePage] = useState('dashboard');

  const [currentUser, setCurrentUser] = useState(
    localStorage.getItem('flatclean_user') || ''
  );

  const [pendingUser, setPendingUser] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [emailMode, setEmailMode] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalTask, setModalTask] = useState(null);
  const [includeVacuumWithDeep, setIncludeVacuumWithDeep] = useState(true);
  const [selectedSubtasks, setSelectedSubtasks] = useState([]);
  const [isDummyTask, setIsDummyTask] = useState(false);
  const [openScoreTasks, setOpenScoreTasks] = useState({});
  const [adminForm, setAdminForm] = useState({ name: '', email: '' });
  const [adminSaving, setAdminSaving] = useState(false);
  const [devSaving, setDevSaving] = useState(false);

  const [form, setForm] = useState({
    taskId: 'gas_stove',
    date: TODAY,
    note: ''
  });

  useEffect(() => {
    setError('');
    setSuccess('');
  }, [activePage]);

  const languageOptions = [
    { value: 'auto', label: t.auto },
    { value: 'de', label: t.german },
    { value: 'en', label: t.english }
  ];

  function taskLabel(task) {
    return t.taskNames[task.id] || task.name || task.id;
  }

  function getProfile(person) {
    return (data?.flatmateProfiles || []).find(
      profile => normalizeName(profile.name) === normalizeName(person)
    );
  }

  function getSubtaskName(subtask) {
    return lang === 'de' ? subtask.nameDe : subtask.nameEn;
  }

  function getTaskSubtasks(taskId) {
    return data?.tasks?.find(task => task.id === taskId)?.subtasks || [];
  }

  function setAllSubtasksForTask(taskId) {
    const subtasks = getTaskSubtasks(taskId);
    setSelectedSubtasks(subtasks.map(subtask => subtask.id));
  }

  function toggleSubtask(subtaskId) {
    setSelectedSubtasks(current => {
      if (current.includes(subtaskId)) {
        return current.filter(id => id !== subtaskId);
      }

      return [...current, subtaskId];
    });
  }

  function getCycleCompletion(row) {
    const subtasks = row.task.subtasks || [];

    if (!subtasks.length || !row.dueDate) {
      return { completed: [], pending: [], ratio: 1 };
    }

    const cycleId = `${row.task.id}:${row.dueDate}`;
    const completedIds = new Set();

    for (const log of data.logs || []) {
      if (log.isDummy) continue;
      if (log.taskId !== row.task.id) continue;
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

    return {
      completed,
      pending,
      ratio: totalWeight > 0 ? completedWeight / totalWeight : 1
    };
  }

  function getMyDueRows(allRows) {
    return allRows.filter(row => {
      const isMine = normalizeName(row.person) === normalizeName(currentUser);
      if (!isMine) return false;

      if (row.task.type === 'on_demand') return !!data?.fullBins?.[row.task.id];

      return !!row.dueDate && row.dueDate <= TODAY;
    });
  }

  function chooseCurrentUser(person) {
    const normalized = normalizeName(person);
    const profile = getProfile(normalized);

    if (!profile?.email) {
      setPendingUser(normalized);
      setEmailDraft('');
      setEmailMode(true);
      return;
    }

    localStorage.setItem('flatclean_user', normalized);
    setCurrentUser(normalized);
  }

  function switchCurrentUser() {
    localStorage.removeItem('flatclean_user');
    setCurrentUser('');
    setPendingUser('');
    setModalTask(null);
  }

  function startChangeEmail() {
    const profile = getProfile(currentUser);
    setPendingUser(currentUser);
    setEmailDraft(profile?.email || '');
    setEmailMode(true);
  }

  function cancelEmail() {
    setEmailMode(false);
    setPendingUser('');
    setEmailDraft('');
    setError('');
  }

  function changeLanguage(value) {
    localStorage.setItem('flatclean_lang', value);
    setLanguageSetting(value);
  }

  function jumpTo(sectionId) {
    setError('');
    setSuccess('');

    if (['dashboard', 'admin', 'history', 'developer'].includes(sectionId)) {
      setActivePage(sectionId);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setMenuOpen(false);
      return;
    }

    setActivePage('dashboard');

    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }, 50);

    setMenuOpen(false);
  }

  function clearSuccessSoon() {
    window.setTimeout(() => {
      setSuccess('');
    }, 2800);
  }

  function openTaskModal(row) {
    setError('');
    setSuccess('');
    setModalTask(row);

    setForm(current => ({
      ...current,
      taskId: row.task.id,
      date: TODAY,
      note: ''
    }));

    const subtasks = row.task.subtasks || [];
    setSelectedSubtasks(subtasks.map(subtask => subtask.id));

    if (row.task.id === 'deep_water') setIncludeVacuumWithDeep(true);
  }

  function closeTaskModal() {
    if (!saving) setModalTask(null);
  }

  function normalizeApiData(json) {
    json.flatmates = (json.flatmates || []).map(normalizeName);

    json.flatmateProfiles = (json.flatmateProfiles || []).map(profile => ({
      ...profile,
      name: normalizeName(profile.name)
    }));

    json.logs = (json.logs || []).map(log => ({
      ...log,
      person: normalizeName(log.person),
      actualPerson: normalizeName(log.actualPerson || log.person),
      assignedPerson: normalizeName(log.assignedPerson),
      completedSubtasks: log.completedSubtasks || [],
      isDummy: !!log.isDummy
    }));

    json.tasks = (json.tasks || []).map(task => ({
      ...task,
      subtasks: task.subtasks || []
    }));

    json.recentEmails = json.recentEmails || [];
    json.scoringPeriods = json.scoringPeriods || [];

    return json;
  }

  async function load() {
    try {
      setError('');
      const res = await fetch('/api/state');

      if (!res.ok) throw new Error(t.loadError);

      const json = normalizeApiData(await res.json());
      setData(json);

      if (!json.tasks?.some(task => task.id === form.taskId)) {
        const firstTaskId = json.tasks?.[0]?.id || '';
        setForm(current => ({ ...current, taskId: firstTaskId }));
      }
    } catch (e) {
      setError(e.message || t.loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(json.error || t.saveError);

    const normalized = normalizeApiData(json);
    setData(normalized);
    return normalized;
  }

  async function saveEmail() {
    try {
      setError('');

      if (!isValidEmail(emailDraft)) {
        setError(t.invalidEmail);
        return;
      }

      setEmailSaving(true);

      await apiPost('/api/profile', {
        person: pendingUser,
        email: emailDraft.trim()
      });

      localStorage.setItem('flatclean_user', normalizeName(pendingUser));
      setCurrentUser(normalizeName(pendingUser));
      setPendingUser('');
      setEmailMode(false);
      setEmailDraft('');
      setSuccess(t.emailSaved);
      clearSuccessSoon();
    } catch (e) {
      setError(e.message || t.saveError);
    } finally {
      setEmailSaving(false);
    }
  }

  function askAdminPin() {
    return window.prompt(t.confirmAdminPin);
  }

  async function adminUserAction(action, user = null) {
    try {
      setError('');
      setAdminSaving(true);

      const pin = askAdminPin();
      if (!pin) return;

      const payload = user
        ? { action, name: user.name, email: user.email || '' }
        : { action, name: adminForm.name, email: adminForm.email };

      const res = await fetch('/api/admin-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin
        },
        body: JSON.stringify(payload)
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || t.saveError);
      }

      const normalized = normalizeApiData(json);
      setData(normalized);
      setAdminForm({ name: '', email: '' });
      setSuccess(t.saved);
      clearSuccessSoon();

      const stillExists = normalized.flatmates.some(
        person => normalizeName(person) === normalizeName(currentUser)
      );

      const currentProfile = normalized.flatmateProfiles.find(
        profile => normalizeName(profile.name) === normalizeName(currentUser)
      );

      if (!stillExists || !currentProfile?.email) {
        localStorage.removeItem('flatclean_user');
        setCurrentUser('');
      }
    } catch (e) {
      setError(e.message || t.saveError);
    } finally {
      setAdminSaving(false);
    }
  }

  async function sendDeveloperTestEmail() {
    try {
      setError('');
      setDevSaving(true);

      const pin = askAdminPin();
      if (!pin) return;

      const res = await fetch('/api/dev-test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': pin
        },
        body: JSON.stringify({
          person: currentUser
        })
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json.error || t.saveError);
      }

      if (json.state) {
        setData(normalizeApiData(json.state));
      }

      setSuccess(t.saved);
      clearSuccessSoon();
    } catch (e) {
      setError(e.message || t.saveError);
    } finally {
      setDevSaving(false);
    }
  }

  const taskById = useMemo(
    () => Object.fromEntries((data?.tasks || []).map(task => [task.id, task])),
    [data]
  );

  const activePeriodId =
    data?.activeScoringPeriod?.id ||
    data?.scores?.activePeriod?.id ||
    null;

  const rows = useMemo(() => {
    if (!data) return [];

    const base = data.tasks.map(task => {
      const last = lastLog(data.logs, task.id);
      const dueDate = getDueDateFromLastLog(task, last);

      return {
        task,
        last,
        dueDate,
        person: fairPerson(data.flatmates, data.logs, task, activePeriodId),
        bundledIntoDeep: false,
        bundledVacuumRow: null
      };
    });

    const deep = base.find(row => row.task.id === 'deep_water');
    const vacuum = base.find(row => row.task.id === 'vacuum');

    if (deep && vacuum) {
      const floorPerson = fairPerson(data.flatmates, data.logs, deep, activePeriodId);
      deep.person = floorPerson;

      if (shouldBundleVacuumWithDeep(vacuum, deep)) {
        deep.bundledVacuumRow = {
          ...vacuum,
          dueDate: deep.dueDate,
          person: floorPerson
        };

        vacuum.person = floorPerson;
        vacuum.dueDate = deep.dueDate;
        vacuum.bundledIntoDeep = true;
      } else if (vacuum.person === deep.person) {
        vacuum.person = fairPersonAvoiding(
          data.flatmates,
          data.logs,
          vacuum.task,
          deep.person,
          activePeriodId
        );
      }
    }

    const activeUser = normalizeName(currentUser);

    return base
      .filter(row => !row.bundledIntoDeep)
      .sort((a, b) => {
        const aMine = normalizeName(a.person) === activeUser;
        const bMine = normalizeName(b.person) === activeUser;

        if (aMine !== bMine) return aMine ? -1 : 1;

        if (a.task.type !== b.task.type) {
          return a.task.type === 'scheduled' ? -1 : 1;
        }

        return (a.dueDate || '9999-12-31').localeCompare(
          b.dueDate || '9999-12-31'
        );
      });
  }, [data, currentUser, activePeriodId]);

  const myRows = useMemo(() => {
    return getMyDueRows(rows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, currentUser, data]);

  const myPendingLabel = useMemo(() => {
    if (!myRows.length) return t.noPendingTasks;
    if (myRows.length === 1) return t.onePendingTask;
    return t.manyPendingTasks(myRows.length);
  }, [myRows, t]);

  const currentTaskSubtasks = getTaskSubtasks(form.taskId);

  const hasValidCurrentUser =
    !!currentUser &&
    !!data?.flatmates?.some(person => normalizeName(person) === normalizeName(currentUser));

  const currentUserProfile = getProfile(currentUser);

  const currentUserScore = data?.scores?.byPerson?.find(
    row => normalizeName(row.person) === normalizeName(currentUser)
  );

  useEffect(() => {
    if (!data || !currentUser) return;

    const profile = (data.flatmateProfiles || []).find(
      item => normalizeName(item.name) === normalizeName(currentUser)
    );

    if (!profile || !profile.email) {
      localStorage.removeItem('flatclean_user');
      setCurrentUser('');
      setPendingUser('');
      setEmailMode(false);
    }
  }, [data, currentUser]);

  async function markDone() {
    try {
      setError('');
      setSuccess('');

      if (!currentUser) {
        setError(t.noUserSelected);
        return;
      }

      if (form.date > TODAY) {
        setError(t.futureDateError);
        return;
      }

      setSaving(true);

      await apiPost('/api/log', {
        ...form,
        person: normalizeName(currentUser),
        completedSubtaskIds: selectedSubtasks,
        alsoLogSubtaskIds: selectedSubtasks,
        includeAlsoLogs: form.taskId === 'deep_water' ? includeVacuumWithDeep : true,
        isDummy: isDummyTask
      });

      setForm(current => ({ ...current, note: '' }));
      setModalTask(null);
      setSuccess(t.saved);
      clearSuccessSoon();
    } catch (e) {
      setError(e.message || t.saveError);
    } finally {
      setSaving(false);
    }
  }

  async function toggleBin(taskId, isFull) {
    try {
      setError('');
      setSuccess('');
      await apiPost('/api/bin', { taskId, isFull });
      setSuccess(t.saved);
      clearSuccessSoon();
    } catch (e) {
      setError(e.message || t.saveError);
    }
  }

  const navItems = [
    { id: 'dashboard', label: t.dashboard, icon: Home },
    { id: 'next-tasks', label: t.nextTasks, icon: ClipboardList },
    { id: 'mark-done', label: t.markDone, icon: CheckCircle2 },
    { id: 'scores', label: t.scores, icon: Trophy },
    { id: 'recent-log', label: t.recentLog, icon: History },
    { id: 'admin', label: t.admin, icon: Pencil },
    { id: 'history', label: t.history, icon: History },
    { id: 'developer', label: t.developer, icon: Sparkles }
  ];

  const taskOptions = (data?.tasks || []).map(task => ({
    value: task.id,
    label: taskLabel(task)
  }));

  function renderSubtaskSelector() {
    if (!currentTaskSubtasks.length) return null;

    return (
      <div className="subtask-box">
        <div className="subtask-head">
          <div>
            <b>{t.subtasks}</b>
            <p>{t.partialTask}</p>
          </div>

          <button
            type="button"
            className="mini-action"
            onClick={() => setAllSubtasksForTask(form.taskId)}
          >
            {t.selectAll}
          </button>
        </div>

        <div className="subtask-grid">
          {currentTaskSubtasks.map(subtask => (
            <label className="subtask-item" key={subtask.id}>
              <input
                type="checkbox"
                checked={selectedSubtasks.includes(subtask.id)}
                onChange={() => toggleSubtask(subtask.id)}
              />
              <span>{getSubtaskName(subtask)}</span>
              <small>{subtask.weight}</small>
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderDummyToggle() {
    return (
      <label className="check dummy-check">
        <input
          type="checkbox"
          checked={isDummyTask}
          onChange={event => setIsDummyTask(event.target.checked)}
        />
        <span>
          <b>{t.dummyTask}</b>
          <small>{t.dummyTaskHelp}</small>
        </span>
      </label>
    );
  }

  function renderEmailGate() {
    return (
      <main className="page user-picker-page">
        <section className="user-picker-card email-card">
          <div className="eyebrow">
            <Mail size={16} />
            {t.emailTitle}
          </div>

          <h1>{pendingUser || currentUser}</h1>
          <p className="sub">{t.emailInfo}</p>

          {error && (
            <div className="notice bad">
              <AlertTriangle size={20} />
              {error}
            </div>
          )}

          <label>
            {t.emailAddress}
            <input
              type="email"
              value={emailDraft}
              onChange={event => setEmailDraft(event.target.value)}
              placeholder="name@example.com"
              autoFocus
            />
          </label>

          <div className="email-actions">
            <button
              type="button"
              className="secondary-action"
              onClick={cancelEmail}
              disabled={emailSaving}
            >
              {t.cancel}
            </button>

            <button
              type="button"
              className="primary"
              onClick={saveEmail}
              disabled={emailSaving}
            >
              {emailSaving ? (
                <>
                  <Loader2 size={20} className="spin" />
                  {t.saving}
                </>
              ) : (
                <>
                  <CheckCircle2 size={20} />
                  {t.saveAndContinue}
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    );
  }

  function renderDashboardPage() {
    return (
      <>
        <section className="layout">
          <div className="card" id="next-tasks">
            <div className="card-head">
              <div>
                <h2>{t.nextTasks}</h2>
                <p>{t.nextTasksHelp}</p>
              </div>
            </div>

            <div className="task-list">
              {rows.map(row => {
                const [label, tone] = status(row, data.fullBins || {}, t);
                const isMine = normalizeName(row.person) === normalizeName(currentUser);
                const completion = getCycleCompletion(row);

                const showPendingSubtasks =
                  completion.pending.length > 0 &&
                  completion.ratio < 1 &&
                  row.dueDate &&
                  row.dueDate <= TODAY;

                return (
                  <div
                    role="button"
                    tabIndex={0}
                    className={`task task-clickable ${row.bundledVacuumRow ? 'task-bundled' : ''} ${isMine ? 'task-mine' : ''}`}
                    key={row.task.id}
                    onClick={() => openTaskModal(row)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openTaskModal(row);
                      }
                    }}
                    aria-label={`${t.openTask}: ${taskLabel(row.task)}`}
                  >
                    <div className="task-main">
                      <div className="task-title-row">
                        <h3>{taskLabel(row.task)}</h3>
                        {isMine && <span className="mine-badge">{t.yourTask}</span>}
                      </div>

                      <p>
                        {t.lastDone}:{' '}
                        {row.last
                          ? `${fmt(row.last.date, '', lang)} ${t.by} ${normalizeName(row.last.actualPerson || row.last.person)}`
                          : t.noRecord}
                      </p>

                      {showPendingSubtasks && (
                        <div className="pending-subtasks">
                          <b>{t.pendingParts}</b>
                          <span>
                            {completion.pending
                              .map(subtask => getSubtaskName(subtask))
                              .join(', ')}
                          </span>
                        </div>
                      )}

                      {row.bundledVacuumRow && (
                        <div className="bundle-pill">
                          <CheckCircle2 size={16} />
                          {t.deepIncludesVacuum}
                        </div>
                      )}

                      {row.task.type === 'on_demand' && (
                        <label className="check" onClick={event => event.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={!!data.fullBins?.[row.task.id]}
                            onChange={event =>
                              toggleBin(row.task.id, event.target.checked)
                            }
                          />
                          {t.binFull}
                        </label>
                      )}
                    </div>

                    <div className="task-meta">
                      <div>
                        <span>{t.nextDate}</span>
                        <b>
                          {fmt(
                            row.dueDate,
                            row.task.type === 'on_demand'
                              ? t.whenFull
                              : t.notScheduled,
                            lang
                          )}
                        </b>
                      </div>

                      <div>
                        <span>{t.nextPerson}</span>
                        <b>{normalizeName(row.person)}</b>
                      </div>

                      <div className={tone}>
                        <span>{t.status}</span>
                        <b>{label}</b>
                      </div>
                    </div>

                    {row.bundledVacuumRow && (
                      <div className="bundled-subtask">
                        <div>
                          <b>{taskLabel(row.bundledVacuumRow.task)}</b>
                          <span>{t.linkedDeep}</span>
                        </div>
                        <div>
                          <span>{t.nextDate}</span>
                          <b>{fmt(row.dueDate, '', lang)}</b>
                        </div>
                        <div>
                          <span>{t.nextPerson}</span>
                          <b>{normalizeName(row.person)}</b>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <aside className="side">
            <div className="card" id="mark-done">
              <div className="card-title-block">
                <h2>{t.markDone}</h2>
                <p>{t.markDoneHelp}</p>
              </div>

              <div className="form-grid">
                <FancySelect
                  label={t.task}
                  value={form.taskId}
                  onChange={value => {
                    setForm({ ...form, taskId: value });
                    setAllSubtasksForTask(value);

                    if (value === 'deep_water') {
                      setIncludeVacuumWithDeep(true);
                    }
                  }}
                  options={taskOptions}
                  placeholder={t.selectPlaceholder}
                />

                {form.taskId === 'deep_water' && (
                  <div className="vacuum-question">
                    <div>
                      <b>{t.didVacuumQuestion}</b>
                      <p>{t.didVacuumHelp}</p>
                    </div>

                    <div className="vacuum-choice-row">
                      <button
                        type="button"
                        className={`choice-button ${includeVacuumWithDeep ? 'active' : ''}`}
                        onClick={() => setIncludeVacuumWithDeep(true)}
                      >
                        <CheckCircle2 size={18} />
                        {t.yesVacuumDone}
                      </button>

                      <button
                        type="button"
                        className={`choice-button ${!includeVacuumWithDeep ? 'active muted' : ''}`}
                        onClick={() => setIncludeVacuumWithDeep(false)}
                      >
                        <X size={18} />
                        {t.noVacuumDone}
                      </button>
                    </div>
                  </div>
                )}

                {renderSubtaskSelector()}
                {renderDummyToggle()}

                <div className="marking-as">
                  <span>{t.markingAs}</span>
                  <b>{normalizeName(currentUser)}</b>
                </div>

                <label>
                  {t.dateDone}
                  <input
                    type="date"
                    value={form.date}
                    max={TODAY}
                    onChange={event => setForm({ ...form, date: event.target.value })}
                  />
                </label>

                <label>
                  {t.note}
                  <input
                    value={form.note}
                    onChange={event => setForm({ ...form, note: event.target.value })}
                    placeholder={t.optional}
                  />
                </label>
              </div>

              <button
                className={`primary ${saving ? 'saving' : ''}`}
                onClick={markDone}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    {t.saving}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    {t.saveCompleted}
                  </>
                )}
              </button>
            </div>

            <div className="card" id="recent-log">
              <div className="card-title-block">
                <h2>{t.recentLog}</h2>
                <p>{t.recentLogHelp}</p>
              </div>

              <div className="log-list">
                {data.logs.slice(0, 24).map(log => (
                  <div className={`log ${log.isDummy ? 'dummy-log' : ''}`} key={log.id}>
                    <b>{taskLabel(taskById[log.taskId] || { id: log.taskId })}</b>
                    <span>
                      <CalendarDays size={14} />
                      {fmt(log.date, '', lang)} {t.by}{' '}
                      {normalizeName(log.actualPerson || log.person)}
                    </span>
                    {log.note && <small>{log.note}</small>}
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section className="card score-card" id="scores">
          <div className="card-head">
            <div>
              <h2>{t.scores}</h2>
              <p>{t.scoresHelp}</p>
              {data.activeScoringPeriod && (
                <p>
                  {t.activePeriod}: <b>{data.activeScoringPeriod.name}</b>
                </p>
              )}
            </div>
          </div>

          <div className="score-grid">
            {(data.scores?.byPerson || []).map(row => (
              <div className="score-person-card" key={row.person}>
                <div className="score-person-head">
                  <span className="dashboard-avatar">{row.person.slice(0, 1)}</span>
                  <div>
                    <b>{row.person}</b>
                    <strong>{Number(row.total || 0).toFixed(2)}</strong>
                  </div>
                </div>

                <div className="score-split">
                  <span>
                    {t.positiveScore}
                    <b>{Number(row.positive || 0).toFixed(2)}</b>
                  </span>
                  <span>
                    {t.negativeScore}
                    <b>{Number(row.negative || 0).toFixed(2)}</b>
                  </span>
                </div>

                <div className="person-task-score-list">
                  {(data.tasks || []).map(task => {
                    const value = Number(data.scores?.byPersonTask?.[row.person]?.[task.id] || 0);
                    const subtaskMap =
                      data.scores?.byPersonTaskSubtask?.[row.person]?.[task.id] || {};

                    if (!value) return null;

                    return (
                      <details key={task.id} className="person-task-score">
                        <summary>
                          <span>{taskLabel(task)}</span>
                          <b>{value.toFixed(2)}</b>
                        </summary>

                        {(task.subtasks || []).length > 0 ? (
                          task.subtasks.map(subtask => (
                            <div className="person-subtask-score" key={subtask.id}>
                              <span>{getSubtaskName(subtask)}</span>
                              <b>{Number(subtaskMap[subtask.id] || 0).toFixed(2)}</b>
                            </div>
                          ))
                        ) : (
                          <div className="person-subtask-score">
                            <span>{taskLabel(task)}</span>
                            <b>{value.toFixed(2)}</b>
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <h3 className="score-subtitle">{t.taskScores}</h3>

          <div className="task-score-table">
            {(data.scores?.byTask || []).map(row => {
              const open = !!openScoreTasks[row.taskId];

              return (
                <div className="task-score-accordion" key={row.taskId}>
                  <button
                    type="button"
                    className="task-score-row"
                    onClick={() =>
                      setOpenScoreTasks(current => ({
                        ...current,
                        [row.taskId]: !current[row.taskId]
                      }))
                    }
                  >
                    <span>{taskLabel(taskById[row.taskId] || { id: row.taskId })}</span>

                    <span className="score-pair">
                      <small>{t.baseScore}</small>
                      <b>{Number(row.baseWeight || 0).toFixed(2)}</b>
                    </span>

                    <span className="score-pair">
                      <small>{t.earnedScore}</small>
                      <b>{Number(row.earnedTotal || 0).toFixed(2)}</b>
                    </span>

                    <small>{open ? t.hideDetails : t.showDetails}</small>
                  </button>

                  {open && (
                    <div className="task-score-detail">
                      {(row.subtasks || []).length > 0 ? (
                        row.subtasks.map(subtask => (
                          <div className="subtask-score-row" key={subtask.id}>
                            <span>{getSubtaskName(subtask)}</span>
                            <small>weight {subtask.weight}</small>
                            <b>{Number(subtask.earnedTotal || 0).toFixed(2)}</b>
                          </div>
                        ))
                      ) : (
                        <div className="subtask-score-row">
                          <span>{taskLabel(taskById[row.taskId] || { id: row.taskId })}</span>
                          <small>{t.singleTask}</small>
                          <b>{Number(row.earnedTotal || 0).toFixed(2)}</b>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </>
    );
  }

  function renderAdminPage() {
    return (
      <section className="card admin-card" id="admin">
        <div className="card-head">
          <div>
            <h2>{t.adminPanel}</h2>
            <p>{t.adminHelp}</p>
          </div>
        </div>

        <h3>{t.activeUsers}</h3>

        <div className="admin-user-table">
          {(data.flatmateProfiles || []).map(user => (
            <div className="admin-user-row" key={user.name}>
              <div>
                <b>{normalizeName(user.name)}</b>
                <span>{user.email || t.noEmail}</span>
              </div>

              <button
                type="button"
                className="danger-action"
                disabled={adminSaving}
                onClick={() => adminUserAction('delete', user)}
              >
                {t.deleteUser}
              </button>
            </div>
          ))}
        </div>

        <h3>{t.addUser}</h3>

        <div className="admin-grid two">
          <label>
            {t.userName}
            <input
              value={adminForm.name}
              onChange={event => setAdminForm({ ...adminForm, name: event.target.value })}
              placeholder="Name"
            />
          </label>
        </div>

        <div className="admin-actions">
          <button disabled={adminSaving} onClick={() => adminUserAction('add')}>
            {t.addUser}
          </button>
        </div>

        <h3>{t.updateUser}</h3>

        <div className="admin-grid two">
          <label>
            {t.userName}
            <input
              value={adminForm.name}
              onChange={event => setAdminForm({ ...adminForm, name: event.target.value })}
              placeholder="Name"
            />
          </label>

          <label>
            {t.emailAddress}
            <input
              type="email"
              value={adminForm.email}
              onChange={event => setAdminForm({ ...adminForm, email: event.target.value })}
              placeholder="name@example.com"
            />
          </label>
        </div>

        <div className="admin-actions">
          <button disabled={adminSaving} onClick={() => adminUserAction('update')}>
            {t.updateUser}
          </button>
        </div>
      </section>
    );
  }

  function renderHistoryPage() {
    return (
      <section className="card history-card" id="history">
        <div className="card-head">
          <div>
            <h2>{t.previousPeriods}</h2>
            <p>{t.historyHelp}</p>
          </div>
        </div>

        <div className="history-list">
          {(data.scoringPeriods || []).map(period => (
            <div className="history-row" key={period.id}>
              <b>{period.name}</b>
              <span>{period.startedAt} → {period.endedAt || 'active'}</span>
              <small>{period.reason}</small>
            </div>
          ))}
        </div>
      </section>
    );
  }

  function renderDeveloperPage() {
    return (
      <section className="card developer-card" id="developer">
        <div className="card-head">
          <div>
            <h2>{t.developerTools}</h2>
            <p>{t.developerHelp}</p>
          </div>
        </div>

        <div className="developer-grid">
          <div className="developer-box">
            <h3>{t.dummyTask}</h3>
            <p>{t.dummyTaskHelp}</p>
            <label className="check dummy-check">
              <input
                type="checkbox"
                checked={isDummyTask}
                onChange={event => setIsDummyTask(event.target.checked)}
              />
              <span>
                <b>{t.dummyTask}</b>
                <small>{isDummyTask ? t.enabled : t.disabled}</small>
              </span>
            </label>
          </div>

          <div className="developer-box">
            <h3>{t.sendTestEmail}</h3>
            <p>{currentUserProfile?.email || t.noEmail}</p>
            <button
              type="button"
              className="primary"
              disabled={devSaving || !currentUserProfile?.email}
              onClick={sendDeveloperTestEmail}
            >
              {devSaving ? (
                <>
                  <Loader2 size={20} className="spin" />
                  {t.saving}
                </>
              ) : (
                <>
                  <Mail size={20} />
                  {t.sendTestEmail}
                </>
              )}
            </button>
          </div>
        </div>

        <h3>{t.recentEmails}</h3>

        <div className="email-log-list">
          {(data.recentEmails || []).map((email, index) => (
            <div className="email-log-row" key={`${email.sentAt}-${index}`}>
              <b>{email.emailType}</b>
              <span>
                {email.recipientPerson} · {email.recipientEmail}
              </span>
              <small>
                {email.status} · {email.sentAt}
              </small>
              {email.error && <em>{email.error}</em>}
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <main className="page">
        <div className="card loading-card">{t.loading}</div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="page">
        <div className="card bad">{error || t.loadError}</div>
      </main>
    );
  }

  if (emailMode) {
    return renderEmailGate();
  }

  if (!hasValidCurrentUser) {
    return (
      <main className="page user-picker-page">
        <section className="user-picker-card">
          <div className="eyebrow">
            <Sparkles size={16} />
            {t.badge}
          </div>

          <h1>{t.whoAreYou}</h1>
          <p className="sub">{t.chooseProfile}</p>

          <div className="profile-grid">
            {data.flatmates.map(person => (
              <button
                type="button"
                key={person}
                className="profile-card"
                onClick={() => chooseCurrentUser(person)}
              >
                <span className="profile-avatar">
                  {normalizeName(person).slice(0, 1)}
                </span>
                <span>
                  {t.continueAs}
                  <b>{normalizeName(person)}</b>
                </span>
              </button>
            ))}
          </div>

          <div className="profile-language-card">
            <div className="dashboard-card dashboard-language-card language-card-top">
              <span className="dashboard-label">{t.language}</span>
              <p>{t.languageHelp}</p>

              <FancySelect
                label=""
                value={languageSetting}
                onChange={changeLanguage}
                options={languageOptions}
                placeholder={t.auto}
                className="language-inline"
              />
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      {!menuOpen && (
        <button
          className="mobile-menu-button"
          onClick={() => setMenuOpen(true)}
          aria-label={t.menu}
        >
          <Menu size={22} />
        </button>
      )}

      {menuOpen && (
        <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
      )}

      <aside className={`nav-panel ${menuOpen ? 'open' : ''}`}>
        <div className="nav-head">
          <div>
            <b>{t.navigation}</b>
            <span>{t.jumpTo}</span>
          </div>

          <button
            className="icon-button nav-close"
            onClick={() => setMenuOpen(false)}
            aria-label={t.close}
          >
            <X size={20} />
          </button>
        </div>

        {navItems.map(item => {
          const Icon = item.icon;

          return (
            <button
              className="nav-link"
              key={item.id}
              onClick={() => jumpTo(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </aside>

      <main className="page" id="top">
        <section className="hero dashboard-hero">
          <div className="hero-main">
            <div className="eyebrow">
              <Sparkles size={16} />
              {t.badge}
            </div>

            <h1>{t.title}</h1>
            <p className="sub">{t.subtitle}</p>
          </div>

          <div className="dashboard-header">
            <div className="dashboard-card dashboard-language-card language-card-top">
              <span className="dashboard-label">{t.language}</span>
              <p>{t.languageHelp}</p>

              <FancySelect
                label=""
                value={languageSetting}
                onChange={changeLanguage}
                options={languageOptions}
                placeholder={t.auto}
                className="language-inline"
              />
            </div>

            <div className="dashboard-card dashboard-user-card">
              <span className="dashboard-label">{t.profile}</span>

              <div className="dashboard-user-row">
                <span className="dashboard-avatar">
                  {normalizeName(currentUser).slice(0, 1)}
                </span>

                <div>
                  <b>{normalizeName(currentUser)}</b>
                  <small>{currentUserProfile?.email}</small>
                  <div className="profile-actions">
                    <button type="button" onClick={switchCurrentUser}>
                      {t.switchUser}
                    </button>
                    <button type="button" onClick={startChangeEmail}>
                      <Pencil size={13} />
                      {t.changeEmail}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="dashboard-card dashboard-pending-card">
              <span className="dashboard-label">{t.yourPendingTasks}</span>
              <strong>{myPendingLabel}</strong>
              <span className="score-mini">
                {t.totalScore}: {(currentUserScore?.total || 0).toFixed(2)}
              </span>
            </div>
          </div>
        </section>

        {error && (
          <div className="notice bad">
            <AlertTriangle size={20} />
            {error}
          </div>
        )}

        {success && (
          <div className="notice good success-pop">
            <CheckCircle2 size={20} />
            {success}
          </div>
        )}

        {activePage === 'dashboard' && renderDashboardPage()}
        {activePage === 'admin' && renderAdminPage()}
        {activePage === 'history' && renderHistoryPage()}
        {activePage === 'developer' && renderDeveloperPage()}
      </main>

      {modalTask && (
        <div className="modal-backdrop" onClick={closeTaskModal}>
          <section className="task-modal" onClick={event => event.stopPropagation()}>
            <div className="modal-head">
              <div>
                <span className="modal-kicker">{t.quickMarkDone}</span>
                <h2>{taskLabel(modalTask.task)}</h2>
                <p>
                  {t.markingAs} <b>{normalizeName(currentUser)}</b>
                </p>
              </div>

              <button
                type="button"
                className="icon-button"
                onClick={closeTaskModal}
                aria-label={t.close}
              >
                <X size={20} />
              </button>
            </div>

            {modalTask.task.id === 'deep_water' && (
              <div className="vacuum-question">
                <div>
                  <b>{t.didVacuumQuestion}</b>
                  <p>{t.didVacuumHelp}</p>
                </div>

                <div className="vacuum-choice-row">
                  <button
                    type="button"
                    className={`choice-button ${includeVacuumWithDeep ? 'active' : ''}`}
                    onClick={() => setIncludeVacuumWithDeep(true)}
                  >
                    <CheckCircle2 size={18} />
                    {t.yesVacuumDone}
                  </button>

                  <button
                    type="button"
                    className={`choice-button ${!includeVacuumWithDeep ? 'active muted' : ''}`}
                    onClick={() => setIncludeVacuumWithDeep(false)}
                  >
                    <X size={18} />
                    {t.noVacuumDone}
                  </button>
                </div>
              </div>
            )}

            {renderSubtaskSelector()}
            {renderDummyToggle()}

            <div className="modal-grid">
              <label>
                {t.dateDone}
                <input
                  type="date"
                  value={form.date}
                  max={TODAY}
                  onChange={event => setForm({ ...form, date: event.target.value })}
                />
              </label>

              <label>
                {t.note}
                <input
                  value={form.note}
                  onChange={event => setForm({ ...form, note: event.target.value })}
                  placeholder={t.optional}
                />
              </label>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={closeTaskModal}
                disabled={saving}
              >
                {t.cancel}
              </button>

              <button
                className={`primary ${saving ? 'saving' : ''}`}
                onClick={markDone}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={20} className="spin" />
                    {t.saving}
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    {t.saveCompleted}
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);