import { json, normalizeName, readState } from './_shared.js';
import { bilingualEmail, sendAndLog } from './email.js';

function requireAdmin(request, env) {
  const configured = env.APP_ADMIN_PIN;
  const provided = request.headers.get('x-admin-pin') || '';

  if (!configured) {
    return json({ error: 'APP_ADMIN_PIN is not configured' }, 500);
  }

  if (provided !== configured) {
    return json({ error: 'Wrong admin PIN' }, 401);
  }

  return null;
}

export async function onRequestPost({ request, env }) {
  const adminError = requireAdmin(request, env);
  if (adminError) return adminError;

  const body = await request.json();
  const person = normalizeName(body.person);

  const state = await readState(env);

  const profile = state.flatmateProfiles.find(
    item => normalizeName(item.name) === person
  );

  if (!profile?.email) {
    return json({ error: 'Selected user has no email' }, 400);
  }

  const email = bilingualEmail({
    titleDe: 'Test-E-Mail vom Putzplan',
    titleEn: 'Test email from cleaning scheduler',
    summaryDe: 'Dies ist eine Entwickler-Test-E-Mail.',
    summaryEn: 'This is a developer test email.',
    detailsDe:
      'Wenn du diese E-Mail erhalten hast, funktioniert der Gmail-Versand über die App.',
    detailsEn:
      'If you received this email, Gmail sending through the app is working.'
  });

  const result = await sendAndLog(
    env,
    {
      to: profile.email,
      ...email
    },
    {
      emailType: 'developer_test',
      taskId: null,
      recipientPerson: person,
      referenceDate: new Date().toISOString().slice(0, 10)
    }
  );

  return json({
    ok: result.ok,
    result,
    state: await readState(env)
  });
}