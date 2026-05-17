import { json, readState, requireAdmin } from './_shared.js';

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function parsePositiveNumber(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Number(number.toFixed(2));
}

function parseIntervalDays(value) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0 || number > 3650) {
    throw new Error('Frequency must be a whole number between 1 and 3650 days.');
  }
  return number;
}

async function taskExists(env, taskId) {
  const row = await env.DB.prepare(`SELECT id FROM tasks WHERE id = ? LIMIT 1`)
    .bind(taskId)
    .first();

  return !!row;
}

function normalizeSubtaskId(taskId, item) {
  const explicitId = String(item?.id || '').trim();

  // Keep existing subtask ids stable during task edits. Historical log_subtasks
  // records refer to these ids, so changing them would fragment score history.
  if (explicitId && slugify(explicitId) === explicitId) {
    return explicitId.slice(0, 96);
  }

  const rawId = explicitId || item?.nameEn || item?.nameDe || item?.name;
  const slug = slugify(rawId);
  return slug ? `${taskId}_${slug}`.slice(0, 96) : '';
}

async function insertSubtasks(env, taskId, subtasks = []) {
  let index = 0;

  for (const item of subtasks || []) {
    const rawId = item.id || item.nameEn || item.nameDe || item.name;
    const subtaskId = normalizeSubtaskId(taskId, item);

    if (!subtaskId) continue;

    const nameEn = String(item.nameEn || item.name || rawId || '').trim();
    const nameDe = String(item.nameDe || item.name || rawId || '').trim();
    const weight = parsePositiveNumber(item.weight, 1);

    if (!nameEn && !nameDe) continue;

    await env.DB.prepare(`
      INSERT INTO subtasks (id, name_en, name_de, weight, sort_order)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name_en = excluded.name_en,
        name_de = excluded.name_de,
        weight = excluded.weight,
        sort_order = excluded.sort_order
    `)
      .bind(subtaskId, nameEn || nameDe, nameDe || nameEn, weight, index)
      .run();

    await env.DB.prepare(`
      INSERT OR IGNORE INTO task_subtasks (task_id, subtask_id)
      VALUES (?, ?)
    `)
      .bind(taskId, subtaskId)
      .run();

    index += 1;
  }
}

async function clearSubtasks(env, taskId) {
  await env.DB.prepare(`DELETE FROM task_subtasks WHERE task_id = ?`)
    .bind(taskId)
    .run();
}

async function addTask(env, payload) {
  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Task name is required.');

  const id = slugify(payload.id || name);
  if (!id) throw new Error('Task id could not be generated.');

  if (await taskExists(env, id)) {
    throw new Error('A task with this id already exists.');
  }

  const type = payload.type === 'on_demand' ? 'on_demand' : 'scheduled';
  const intervalDays = type === 'scheduled' ? parseIntervalDays(payload.intervalDays) : null;
  const baseWeight = parsePositiveNumber(payload.baseWeight, 1);

  await env.DB.prepare(`
    INSERT INTO tasks (
      id,
      name,
      type,
      interval_days,
      task_group,
      also_logs,
      base_weight,
      active
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)
  `)
    .bind(
      id,
      name,
      type,
      intervalDays,
      payload.taskGroup || null,
      Array.isArray(payload.alsoLogs) ? payload.alsoLogs.join(',') : '',
      baseWeight
    )
    .run();

  await insertSubtasks(env, id, payload.subtasks || []);
}

async function updateTask(env, payload) {
  const id = slugify(payload.id);
  if (!id) throw new Error('Task id is required.');

  if (!(await taskExists(env, id))) {
    throw new Error('Task not found.');
  }

  const name = String(payload.name || '').trim();
  if (!name) throw new Error('Task name is required.');

  const type = payload.type === 'on_demand' ? 'on_demand' : 'scheduled';
  const intervalDays = type === 'scheduled' ? parseIntervalDays(payload.intervalDays) : null;
  const baseWeight = parsePositiveNumber(payload.baseWeight, 1);

  await env.DB.prepare(`
    UPDATE tasks
    SET
      name = ?,
      type = ?,
      interval_days = ?,
      task_group = ?,
      also_logs = ?,
      base_weight = ?,
      active = ?
    WHERE id = ?
  `)
    .bind(
      name,
      type,
      intervalDays,
      payload.taskGroup || null,
      Array.isArray(payload.alsoLogs) ? payload.alsoLogs.join(',') : '',
      baseWeight,
      payload.active === false ? 0 : 1,
      id
    )
    .run();

  if (Array.isArray(payload.subtasks)) {
    await clearSubtasks(env, id);
    await insertSubtasks(env, id, payload.subtasks);
  }
}

async function archiveTask(env, payload) {
  const id = slugify(payload.id);
  if (!id) throw new Error('Task id is required.');

  if (!(await taskExists(env, id))) {
    throw new Error('Task not found.');
  }

  await env.DB.prepare(`
    UPDATE tasks
    SET active = 0
    WHERE id = ?
  `)
    .bind(id)
    .run();
}

async function splitTask(env, payload) {
  const originalTaskId = slugify(payload.originalTaskId);

  if (!originalTaskId) {
    throw new Error('Original task is required.');
  }

  if (!(await taskExists(env, originalTaskId))) {
    throw new Error('Original task not found.');
  }

  const newTasks = Array.isArray(payload.newTasks) ? payload.newTasks : [];

  if (newTasks.length < 2) {
    throw new Error('Splitting requires at least two new tasks.');
  }

  for (const task of newTasks) {
    await addTask(env, task);
  }

  if (payload.archiveOriginal !== false) {
    await archiveTask(env, { id: originalTaskId });
  }
}

export async function onRequestPost({ request, env }) {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const body = await request.json().catch(() => ({}));
  const action = body.action;

  try {
    if (action === 'add') {
      await addTask(env, body);
    } else if (action === 'update') {
      await updateTask(env, body);
    } else if (action === 'archive') {
      await archiveTask(env, body);
    } else if (action === 'split') {
      await splitTask(env, body);
    } else {
      return json({ error: 'Unknown task admin action.' }, 400);
    }

    return json(await readState(env));
  } catch (error) {
    return json({ error: error.message || 'Could not update tasks.' }, 400);
  }
}