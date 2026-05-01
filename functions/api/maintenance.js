import { json } from './_shared.js';
import { runMaintenance } from './maintenance-core.js';

function isAuthorized(request, env) {
  const provided =
    request.headers.get('x-maintenance-token') ||
    request.headers.get('x-admin-pin') ||
    '';

  const expected = env.MAINTENANCE_TOKEN || env.ADMIN_PIN || env.APP_PIN || '';

  return !!expected && provided === expected;
}

export async function onRequestPost({ request, env }) {
  if (!isAuthorized(request, env)) {
    return json({ error: 'Maintenance token is missing or incorrect.' }, 401);
  }

  const url = new URL(request.url);
  const force = url.searchParams.get('force') === '1';

  const result = await runMaintenance(env, {
    force,
    runType: 'manual_api'
  });

  return json(result);
}
