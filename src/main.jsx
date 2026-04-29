import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { CheckCircle2, RotateCcw, AlertTriangle, Lock, Trash2 } from 'lucide-react';
import './styles.css';

const TODAY = new Date().toISOString().slice(0, 10);

function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function diffDays(from, to) {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  return Math.round((b - a) / 86400000);
}
function fmt(date) {
  if (!date) return 'When full';
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}
function lastLog(logs, taskId) {
  return logs.filter(l => l.taskId === taskId).sort((a, b) => b.date.localeCompare(a.date))[0];
}
function fairPerson(people, logs, task) {
  const ids = task.taskGroup === 'floor' ? ['vacuum', 'deep_water'] : [task.id];
  const counts = Object.fromEntries(people.map(p => [p, 0]));
  const lastDates = Object.fromEntries(people.map(p => [p, '1900-01-01']));
  logs.forEach(l => {
    if (ids.includes(l.taskId)) {
      counts[l.person] = (counts[l.person] || 0) + 1;
      if (l.date > lastDates[l.person]) lastDates[l.person] = l.date;
    }
  });
  return [...people].sort((a, b) => (counts[a] - counts[b]) || lastDates[a].localeCompare(lastDates[b]))[0];
}
function status(row, fullBins) {
  if (row.task.type === 'on_demand') return fullBins[row.task.id] ? ['Needs cleaning', 'bad'] : ['On demand', 'plain'];
  const d = diffDays(TODAY, row.dueDate);
  if (d < 0) return [`${Math.abs(d)} day${Math.abs(d) === 1 ? '' : 's'} late`, 'bad'];
  if (d === 0) return ['Due today', 'warn'];
  if (d <= 3) return [`Due in ${d} day${d === 1 ? '' : 's'}`, 'warn'];
  return [`Due in ${d} days`, 'good'];
}

function App() {
  const [pin, setPin] = useState(localStorage.getItem('flatclean_pin') || '');
  const [pinInput, setPinInput] = useState(pin);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ taskId: 'gas_stove', person: 'Animesh', date: TODAY, note: '' });

  async function load() {
    try {
      setError('');
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Could not load data');
      const json = await res.json();
      setData(json);
      if (!json.tasks?.some(t => t.id === form.taskId)) {
        setForm(f => ({ ...f, taskId: json.tasks?.[0]?.id || '' }));
      }
    } catch (e) {
      setError(e.message || 'Could not load data');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function savePin() {
    localStorage.setItem('flatclean_pin', pinInput);
    setPin(pinInput);
  }

  async function apiPost(url, body) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-app-pin': pin },
      body: JSON.stringify(body)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Could not save. Check the PIN.');
    setData(json);
    return json;
  }

  const taskById = useMemo(() => Object.fromEntries((data?.tasks || []).map(t => [t.id, t])), [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const base = data.tasks.map(task => {
      const last = lastLog(data.logs, task.id);
      const dueDate = task.type === 'scheduled' && last ? addDays(last.date, task.intervalDays) : null;
      return { task, last, dueDate, person: fairPerson(data.flatmates, data.logs, task) };
    });
    const deep = base.find(r => r.task.id === 'deep_water');
    const vacuum = base.find(r => r.task.id === 'vacuum');
    if (deep && vacuum && deep.dueDate === vacuum.dueDate) {
      vacuum.person = deep.person;
      vacuum.linked = true;
    }
    return base.sort((a, b) => (a.task.type === b.task.type ? (a.dueDate || '9999').localeCompare(b.dueDate || '9999') : a.task.type === 'scheduled' ? -1 : 1));
  }, [data]);

  async function markDone() {
    try {
      setError('');
      await apiPost('/api/log', form);
      setForm({ ...form, note: '' });
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleBin(taskId, isFull) {
    try {
      setError('');
      await apiPost('/api/bin', { taskId, isFull });
    } catch (e) {
      setError(e.message);
    }
  }

  async function reset() {
    if (!confirm('Reset to the initial records?')) return;
    try {
      setError('');
      await apiPost('/api/reset', {});
    } catch (e) {
      setError(e.message);
    }
  }

  const fairness = useMemo(() => {
    if (!data) return [];
    return data.flatmates.map(person => ({
      person,
      total: data.logs.filter(l => l.person === person).length,
      recent: data.logs.filter(l => l.person === person && diffDays(l.date, TODAY) <= 60).length
    }));
  }, [data]);

  if (loading) return <main className="page"><div className="card">Loading…</div></main>;
  if (!data) return <main className="page"><div className="card bad">{error || 'Could not load app data.'}</div></main>;

  return (
    <main className="page">
      <section className="hero">
        <div>
          <div className="eyebrow">Shared apartment scheduler</div>
          <h1>Cleaning schedule</h1>
          <p className="sub">For Melanie, Animesh and Neveen. The next person is chosen by actual completed work, so swaps stay fair.</p>
        </div>
        <div className="today"><span>Today</span><b>{fmt(TODAY)}</b></div>
      </section>

      {error && <div className="notice bad"><AlertTriangle size={20} /> {error}</div>}

      <section className="pin card">
        <div>
          <h2><Lock size={18} /> Apartment PIN</h2>
          <p>Enter the shared PIN once on each device. It is required for saving changes.</p>
        </div>
        <div className="pin-row">
          <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" />
          <button className="secondary" onClick={savePin}>Save PIN</button>
        </div>
      </section>

      <section className="layout">
        <div className="card">
          <div className="card-head"><h2>Next tasks</h2><button className="secondary" onClick={reset}><RotateCcw size={18} /> Reset</button></div>
          <div className="task-list">
            {rows.map(row => {
              const [label, tone] = status(row, data.fullBins);
              return <div className="task" key={row.task.id}>
                <div className="task-main">
                  <h3>{row.task.name}</h3>
                  <p>Last done: {row.last ? `${fmt(row.last.date)} by ${row.last.person}` : 'No record yet'}</p>
                  {row.linked && <p className="hint">Linked with deep water cleaning on the same date.</p>}
                  {row.task.id === 'deep_water' && <p className="hint">Saving this also logs vacuum cleaning.</p>}
                  {row.task.type === 'on_demand' && <label className="check"><input type="checkbox" checked={!!data.fullBins[row.task.id]} onChange={e => toggleBin(row.task.id, e.target.checked)} /> Bin is full / needs cleaning</label>}
                </div>
                <div className="task-meta">
                  <div><span>Next date</span><b>{fmt(row.dueDate)}</b></div>
                  <div><span>Next person</span><b>{row.person}</b></div>
                  <div className={tone}><span>Status</span><b>{label}</b></div>
                </div>
              </div>;
            })}
          </div>
        </div>

        <aside className="side">
          <div className="card">
            <h2>Mark done</h2>
            <label>Task<select value={form.taskId} onChange={e => setForm({ ...form, taskId: e.target.value })}>{data.tasks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            <label>Person who did it<select value={form.person} onChange={e => setForm({ ...form, person: e.target.value })}>{data.flatmates.map(p => <option key={p}>{p}</option>)}</select></label>
            <label>Date done<input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label>Note<input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Optional" /></label>
            <button className="primary" onClick={markDone}><CheckCircle2 size={20} /> Save completed task</button>
          </div>

          <div className="card">
            <h2>Fairness check</h2>
            {fairness.map(f => <div className="fair" key={f.person}><b>{f.person}</b><span>{f.total} total / {f.recent} recent</span></div>)}
          </div>

          <div className="card">
            <h2>Recent log</h2>
            <div className="log-list">{data.logs.slice(0, 20).map(l => <div className="log" key={l.id}><b>{taskById[l.taskId]?.name || l.taskId}</b><span>{fmt(l.date)} by {l.person}</span>{l.note && <small>{l.note}</small>}</div>)}</div>
          </div>
        </aside>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
