import { runMaintenance } from './functions/api/maintenance-core.js';

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(runMaintenance(env, {
      runType: 'cron',
      scheduledTime: controller.scheduledTime
    }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname !== '/maintenance/run' || request.method !== 'POST') {
      return new Response('Not found', { status: 404 });
    }

    const provided =
      request.headers.get('x-maintenance-token') ||
      request.headers.get('x-admin-pin') ||
      '';

    const expected = env.MAINTENANCE_TOKEN || env.ADMIN_PIN || env.APP_PIN || '';

    if (!expected || provided !== expected) {
      return Response.json({ error: 'Maintenance token is missing or incorrect.' }, { status: 401 });
    }

    const force = url.searchParams.get('force') === '1';
    const result = await runMaintenance(env, {
      force,
      runType: 'manual_worker'
    });

    return Response.json(result);
  }
};
