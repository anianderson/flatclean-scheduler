import { json } from './_shared.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function safeParseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (_error) {
    return fallback;
  }
}

function encodeCursor(row) {
  if (!row?.created_at || !row?.id) return null;

  return btoa(JSON.stringify({
    createdAt: row.created_at,
    id: row.id
  }));
}

function decodeCursor(cursor) {
  if (!cursor) return null;

  try {
    const parsed = JSON.parse(atob(cursor));

    if (!parsed?.createdAt || !parsed?.id) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      id: parsed.id
    };
  } catch (_error) {
    return null;
  }
}

function normalizeLimit(value) {
  const parsed = Number(value || DEFAULT_LIMIT);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function mapAssignmentLogRow(row) {
  return {
    id: row.id,
    taskId: row.task_id,
    taskName: row.task_name,
    scheduledDueDate: row.scheduled_due_date,
    assignedPerson: row.assigned_person,
    previousAssignedPerson: row.previous_assigned_person,
    reasonSummary: row.reason_summary,
    details: safeParseJson(row.details_json, {}),
    createdAt: row.created_at
  };
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const limit = normalizeLimit(url.searchParams.get('limit'));
  const cursor = decodeCursor(url.searchParams.get('cursor'));

  const baseSelect = `
    SELECT
      id,
      task_id,
      task_name,
      scheduled_due_date,
      assigned_person,
      previous_assigned_person,
      reason_summary,
      details_json,
      created_at
    FROM assignment_logs
  `;

  const result = cursor
    ? await env.DB.prepare(`
        ${baseSelect}
        WHERE created_at < ?
           OR (created_at = ? AND id < ?)
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `)
        .bind(cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
        .all()
    : await env.DB.prepare(`
        ${baseSelect}
        ORDER BY created_at DESC, id DESC
        LIMIT ?
      `)
        .bind(limit + 1)
        .all();

  const rows = result.results || [];
  const page = rows.slice(0, limit);
  const hasMore = rows.length > limit;
  const lastRow = page[page.length - 1] || null;

  return json({
    logs: page.map(mapAssignmentLogRow),
    nextCursor: hasMore ? encodeCursor(lastRow) : null
  });
}