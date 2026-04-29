import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Globe2,
  History,
  Home,
  Menu,
  Sparkles,
  X
} from 'lucide-react';
import './styles.css';

const TODAY = new Date().toISOString().slice(0, 10);

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
    linkedDeep: 'Linked with deep water cleaning on the same date.',
    deepIncludesVacuum: 'Saving this also logs vacuum cleaning.',
    by: 'by',
    loading: 'Loading…',
    loadError: 'Could not load app data.',
    saveError: 'Could not save. Please try again.',
    auto: 'Auto',
    german: 'German',
    english: 'English',
    dueToday: 'Due today',
    menu: 'Menu',
    close: 'Close',
    jumpTo: 'Jump to',
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
    linkedDeep: 'Mit der Nassreinigung am gleichen Datum verknüpft.',
    deepIncludesVacuum: 'Beim Speichern wird Staubsaugen automatisch mit eingetragen.',
    by: 'von',
    loading: 'Lädt…',
    loadError: 'App-Daten konnten nicht geladen werden.',
    saveError: 'Konnte nicht speichern. Bitte erneut versuchen.',
    auto: 'Auto',
    german: 'Deutsch',
    english: 'Englisch',
    dueToday: 'Heute fällig',
    menu: 'Menü',
    close: 'Schließen',
    jumpTo: 'Springen zu',
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

function lastLog(logs, taskId) {
  return logs
    .filter(log => log.taskId === taskId)
    .sort((a, b) => {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
}

function fairPerson(people, logs, task) {
  const normalizedPeople = people.map(person =>
    person === 'Neveen' ? 'Naveen' : person
  );

  const ids =
    task.taskGroup === 'floor'
      ? ['vacuum', 'deep_water']
      : [task.id];

  const counts = Object.fromEntries(normalizedPeople.map(person => [person, 0]));
  const lastDates = Object.fromEntries(
    normalizedPeople.map(person => [person, '1900-01-01'])
  );

  logs.forEach(log => {
    if (!ids.includes(log.taskId)) return;

    const person = log.person === 'Neveen' ? 'Naveen' : log.person;

    counts[person] = (counts[person] || 0) + 1;

    if (log.date > (lastDates[person] || '1900-01-01')) {
      lastDates[person] = log.date;
    }
  });

  return [...normalizedPeople].sort((a, b) => {
    if ((counts[a] || 0) !== (counts[b] || 0)) {
      return (counts[a] || 0) - (counts[b] || 0);
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

function normalizeName(name) {
  return name === 'Neveen' ? 'Naveen' : name;
}

function App() {
  const [languageSetting, setLanguageSetting] = useState(
    localStorage.getItem('flatclean_lang') || 'auto'
  );
  const lang = getLanguageFromSetting(languageSetting);
  const t = translations[lang];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
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
        person: normalizeName(log.person)
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
      person: normalizeName(log.person)
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
      const dueDate =
        task.type === 'scheduled' && last
          ? addDays(last.date, task.intervalDays)
          : null;

      return {
        task,
        last,
        dueDate,
        person: fairPerson(data.flatmates, data.logs, task)
      };
    });

    const deep = base.find(row => row.task.id === 'deep_water');
    const vacuum = base.find(row => row.task.id === 'vacuum');

    if (deep && vacuum && deep.dueDate && vacuum.dueDate && deep.dueDate === vacuum.dueDate) {
      vacuum.person = deep.person;
      vacuum.linked = true;
    }

    return base.sort((a, b) => {
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
      await apiPost('/api/log', {
        ...form,
        person: normalizeName(form.person)
      });
      setForm(current => ({ ...current, note: '' }));
    } catch (e) {
      setError(e.message || t.saveError);
    }
  }

  async function toggleBin(taskId, isFull) {
    try {
      setError('');
      await apiPost('/api/bin', { taskId, isFull });
    } catch (e) {
      setError(e.message || t.saveError);
    }
  }

  const navItems = [
    { id: 'next-tasks', label: t.nextTasks, icon: ClipboardList },
    { id: 'mark-done', label: t.markDone, icon: CheckCircle2 },
    { id: 'recent-log', label: t.recentLog, icon: History }
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
            <label className="language-select">
              <Globe2 size={17} />
              <select
                value={languageSetting}
                onChange={e => changeLanguage(e.target.value)}
              >
                <option value="auto">{t.auto}</option>
                <option value="de">{t.german}</option>
                <option value="en">{t.english}</option>
              </select>
            </label>

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
                  <div className="task" key={row.task.id}>
                    <div className="task-main">
                      <h3>{taskLabel(row.task)}</h3>

                      <p>
                        {t.lastDone}:{' '}
                        {row.last
                          ? `${fmt(row.last.date, '', lang)} ${t.by} ${normalizeName(row.last.person)}`
                          : t.noRecord}
                      </p>

                      {row.linked && (
                        <p className="hint">{t.linkedDeep}</p>
                      )}

                      {row.task.id === 'deep_water' && (
                        <p className="hint">{t.deepIncludesVacuum}</p>
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

              <label>
                {t.task}
                <select
                  value={form.taskId}
                  onChange={e => setForm({ ...form, taskId: e.target.value })}
                >
                  {data.tasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {taskLabel(task)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t.person}
                <select
                  value={form.person}
                  onChange={e => setForm({ ...form, person: e.target.value })}
                >
                  {data.flatmates.map(person => (
                    <option key={person} value={person}>
                      {normalizeName(person)}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                {t.dateDone}
                <input
                  type="date"
                  value={form.date}
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

              <button className="primary" onClick={markDone}>
                <CheckCircle2 size={20} />
                {t.saveCompleted}
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
                      {fmt(log.date, '', lang)} {t.by} {normalizeName(log.person)}
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