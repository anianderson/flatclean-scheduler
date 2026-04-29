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
  Menu,
  Sparkles,
  X
} from 'lucide-react';
import './styles.css';

const TODAY = new Date().toISOString().slice(0, 10);
const FLOOR_MERGE_WINDOW_DAYS = 2;

const translations = {
  en: {
    badge: 'Shared apartment scheduler',
    title: 'Cleaning schedule',
    subtitle:
      'For Melanie, Animesh and Naveen. The next person is chosen by actual completed work, so swaps stay fair.',
    today: 'Today',
    navigation: 'Navigation',
    nextTasks: 'Next tasks',
    nextTasksHelp: 'Upcoming, overdue and on-demand cleaning work.',
    markDone: 'Mark done',
    markDoneHelp: 'Enter who actually completed the task and on which date.',
    recentLog: 'Recent log',
    recentLogHelp: 'Latest completed cleaning entries.',
    task: 'Task',
    person: 'Person who did it',
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
    hiddenBecauseBundled: 'Vacuum is bundled into deep water cleaning for this cycle.',
    by: 'by',
    loading: 'Loading…',
    loadError: 'Could not load app data.',
    saveError: 'Could not save. Please try again.',
    futureDateError: 'Future dates are not allowed.',
    auto: 'Auto',
    german: 'German',
    english: 'English',
    dueToday: 'Due today',
    menu: 'Menu',
    close: 'Close',
    jumpTo: 'Jump to',
    selectPlaceholder: 'Select',
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
    today: 'Heute',
    navigation: 'Navigation',
    nextTasks: 'Nächste Aufgaben',
    nextTasksHelp: 'Anstehende, überfällige und bedarfsabhängige Putzaufgaben.',
    markDone: 'Erledigt eintragen',
    markDoneHelp: 'Trage ein, wer die Aufgabe wirklich erledigt hat und an welchem Datum.',
    recentLog: 'Letzte Einträge',
    recentLogHelp: 'Die neuesten erledigten Putzaufgaben.',
    task: 'Aufgabe',
    person: 'Person, die es erledigt hat',
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
    hiddenBecauseBundled: 'Staubsaugen ist in diesem Zyklus in der Nassreinigung enthalten.',
    by: 'von',
    loading: 'Lädt…',
    loadError: 'App-Daten konnten nicht geladen werden.',
    saveError: 'Konnte nicht speichern. Bitte erneut versuchen.',
    futureDateError: 'Zukünftige Daten sind nicht erlaubt.',
    auto: 'Auto',
    german: 'Deutsch',
    english: 'Englisch',
    dueToday: 'Heute fällig',
    menu: 'Menü',
    close: 'Schließen',
    jumpTo: 'Springen zu',
    selectPlaceholder: 'Auswählen',
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
  return name === 'Neveen' ? 'Naveen' : name;
}

function lastLog(logs, taskId) {
  return logs
    .filter(log => log.taskId === taskId)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
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

function fairPerson(people, logs, task) {
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

  return [...normalizedPeople].sort((a, b) => {
    if ((scores[a] || 0) !== (scores[b] || 0)) {
      return (scores[a] || 0) - (scores[b] || 0);
    }

    return (lastDates[a] || '1900-01-01').localeCompare(
      lastDates[b] || '1900-01-01'
    );
  })[0];
}

function status(row, fullBins, t) {
  if (row.task.type === 'on_demand') {
    return fullBins[row.task.id] ? [t.needsCleaning, 'bad'] : [t.onDemand, 'plain'];
  }

  if (!row.dueDate) {
    return [t.addFirstRecord, 'plain'];
  }

  const d = diffDays(TODAY, row.dueDate);

  if (d === null) {
    return [t.addFirstRecord, 'plain'];
  }

  if (d < 0) return [t.late(Math.abs(d)), 'bad'];
  if (d === 0) return [t.dueToday, 'warn'];
  if (d <= 3) return [t.dueIn(d), 'warn'];

  return [t.dueIn(d), 'good'];
}

function shouldBundleVacuumWithDeep(vacuumRow, deepRow) {
  if (!vacuumRow || !deepRow || !vacuumRow.dueDate || !deepRow.dueDate) {
    return false;
  }

  const gap = diffDays(vacuumRow.dueDate, deepRow.dueDate);

  if (gap === null) return false;

  if (vacuumRow.dueDate === deepRow.dueDate) return true;

  return gap >= 0 && gap <= FLOOR_MERGE_WINDOW_DAYS;
}

function FancySelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!ref.current?.contains(event.target)) {
        setOpen(false);
      }
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
          <span className="fancy-value">
            {selected?.label || placeholder}
          </span>
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

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({
    taskId: 'gas_stove',
    person: 'Animesh',
    date: TODAY,
    note: ''
  });

  function taskLabel(task) {
    return t.taskNames[task.id] || task.name || task.id;
  }

  function changeLanguage(value) {
    localStorage.setItem('flatclean_lang', value);
    setLanguageSetting(value);
  }

  function jumpTo(sectionId) {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
    setMenuOpen(false);
  }

  function clearSuccessSoon() {
    window.setTimeout(() => {
      setSuccess('');
    }, 2800);
  }

  async function load() {
    try {
      setError('');
      const res = await fetch('/api/state');

      if (!res.ok) {
        throw new Error(t.loadError);
      }

      const json = await res.json();

      json.flatmates = (json.flatmates || []).map(normalizeName);
      json.logs = (json.logs || []).map(log => ({
        ...log,
        person: normalizeName(log.person),
        actualPerson: normalizeName(log.actualPerson || log.person),
        assignedPerson: normalizeName(log.assignedPerson)
      }));

      setData(json);

      if (!json.tasks?.some(task => task.id === form.taskId)) {
        setForm(current => ({
          ...current,
          taskId: json.tasks?.[0]?.id || ''
        }));
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

    if (!res.ok) {
      throw new Error(json.error || t.saveError);
    }

    json.flatmates = (json.flatmates || []).map(normalizeName);
    json.logs = (json.logs || []).map(log => ({
      ...log,
      person: normalizeName(log.person),
      actualPerson: normalizeName(log.actualPerson || log.person),
      assignedPerson: normalizeName(log.assignedPerson)
    }));

    setData(json);
    return json;
  }

  const taskById = useMemo(
    () => Object.fromEntries((data?.tasks || []).map(task => [task.id, task])),
    [data]
  );

  const rows = useMemo(() => {
    if (!data) return [];

    const base = data.tasks.map(task => {
      const last = lastLog(data.logs, task.id);
      const dueDate = getDueDateFromLastLog(task, last);

      return {
        task,
        last,
        dueDate,
        person: fairPerson(data.flatmates, data.logs, task),
        bundledIntoDeep: false,
        bundledVacuumRow: null
      };
    });

    const deep = base.find(row => row.task.id === 'deep_water');
    const vacuum = base.find(row => row.task.id === 'vacuum');

    if (deep && vacuum && shouldBundleVacuumWithDeep(vacuum, deep)) {
      const floorPerson = fairPerson(data.flatmates, data.logs, deep);

      deep.person = floorPerson;
      deep.bundledVacuumRow = {
        ...vacuum,
        dueDate: deep.dueDate,
        person: floorPerson
      };

      vacuum.person = floorPerson;
      vacuum.dueDate = deep.dueDate;
      vacuum.bundledIntoDeep = true;
    }

    return base
      .filter(row => !row.bundledIntoDeep)
      .sort((a, b) => {
        if (a.task.type !== b.task.type) {
          return a.task.type === 'scheduled' ? -1 : 1;
        }

        return (a.dueDate || '9999-12-31').localeCompare(
          b.dueDate || '9999-12-31'
        );
      });
  }, [data]);

  async function markDone() {
    try {
      setError('');
      setSuccess('');

      if (form.date > TODAY) {
        setError(t.futureDateError);
        return;
      }

      setSaving(true);

      await apiPost('/api/log', {
        ...form,
        person: normalizeName(form.person)
      });

      setForm(current => ({ ...current, note: '' }));
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
    { id: 'next-tasks', label: t.nextTasks, icon: ClipboardList },
    { id: 'mark-done', label: t.markDone, icon: CheckCircle2 },
    { id: 'recent-log', label: t.recentLog, icon: History }
  ];

  const taskOptions = (data?.tasks || []).map(task => ({
    value: task.id,
    label: taskLabel(task)
  }));

  const personOptions = (data?.flatmates || []).map(person => ({
    value: person,
    label: normalizeName(person)
  }));

  const languageOptions = [
    { value: 'auto', label: t.auto },
    { value: 'de', label: t.german },
    { value: 'en', label: t.english }
  ];

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

  return (
    <>
      <button
        className="mobile-menu-button"
        onClick={() => setMenuOpen(true)}
        aria-label={t.menu}
      >
        <Menu size={22} />
      </button>

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

        <button className="nav-link" onClick={() => jumpTo('top')}>
          <Home size={18} />
          <span>{t.title}</span>
        </button>

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
        <section className="hero">
          <div>
            <div className="eyebrow">
              <Sparkles size={16} />
              {t.badge}
            </div>
            <h1>{t.title}</h1>
            <p className="sub">{t.subtitle}</p>
          </div>

          <div className="hero-actions">
            <FancySelect
              label=""
              value={languageSetting}
              onChange={changeLanguage}
              options={languageOptions}
              placeholder={t.auto}
              className="language-fancy"
            />

            <div className="today">
              <span>{t.today}</span>
              <b>{fmt(TODAY, '', lang)}</b>
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

                return (
                  <div
                    className={`task ${row.bundledVacuumRow ? 'task-bundled' : ''}`}
                    key={row.task.id}
                  >
                    <div className="task-main">
                      <h3>{taskLabel(row.task)}</h3>

                      <p>
                        {t.lastDone}:{' '}
                        {row.last
                          ? `${fmt(row.last.date, '', lang)} ${t.by} ${normalizeName(row.last.actualPerson || row.last.person)}`
                          : t.noRecord}
                      </p>

                      {row.bundledVacuumRow && (
                        <div className="bundle-pill">
                          <CheckCircle2 size={16} />
                          {t.deepIncludesVacuum}
                        </div>
                      )}

                      {row.task.type === 'on_demand' && (
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={!!data.fullBins?.[row.task.id]}
                            onChange={e =>
                              toggleBin(row.task.id, e.target.checked)
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
                  onChange={value => setForm({ ...form, taskId: value })}
                  options={taskOptions}
                  placeholder={t.selectPlaceholder}
                />

                <FancySelect
                  label={t.person}
                  value={form.person}
                  onChange={value => setForm({ ...form, person: value })}
                  options={personOptions}
                  placeholder={t.selectPlaceholder}
                />

                <label>
                  {t.dateDone}
                  <input
                    type="date"
                    value={form.date}
                    max={TODAY}
                    onChange={e => setForm({ ...form, date: e.target.value })}
                  />
                </label>

                <label>
                  {t.note}
                  <input
                    value={form.note}
                    onChange={e => setForm({ ...form, note: e.target.value })}
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
                  <div className="log" key={log.id}>
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
      </main>
    </>
  );
}

createRoot(document.getElementById('root')).render(<App />);