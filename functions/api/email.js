import { json } from './_shared.js';

function escapeHeader(value) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/\n/g, '')
    .trim();
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeRFC2047(value) {
  const safe = escapeHeader(value);

  if (/^[\x00-\x7F]*$/.test(safe)) {
    return safe;
  }

  return `=?UTF-8?B?${base64EncodeUtf8(safe)}?=`;
}

function base64EncodeUtf8(input) {
  const bytes = new TextEncoder().encode(String(input || ''));
  let binary = '';

  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

function base64UrlEncodeUtf8(input) {
  return base64EncodeUtf8(input)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function buildFromHeader(env) {
  const fromEmail = escapeHeader(env.GMAIL_FROM_EMAIL);

  if (!fromEmail) {
    throw new Error('Missing GMAIL_FROM_EMAIL');
  }

  const fromName = escapeHeader(env.GMAIL_FROM_NAME || 'Flat Cleaning');

  return `${encodeRFC2047(fromName)} <${fromEmail}>`;
}

function buildMimeMessage({ env, to, subject, html, text }) {
  const boundary = `flatclean_${crypto.randomUUID()}`;
  const from = buildFromHeader(env);
  const toHeader = escapeHeader(to);
  const subjectHeader = encodeRFC2047(subject);

  const plainText = text || stripHtml(html);

  return [
    `From: ${from}`,
    `To: ${toHeader}`,
    `Subject: ${subjectHeader}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    plainText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    html || `<pre>${plainText}</pre>`,
    '',
    `--${boundary}--`
  ].join('\r\n');
}

async function getGmailAccessToken(env) {
  const clientId = env.GMAIL_CLIENT_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET;
  const refreshToken = env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing Gmail OAuth secrets');
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok || !result.access_token) {
    throw new Error(
      result.error_description ||
      result.error ||
      `Could not get Gmail access token: ${response.status}`
    );
  }

  return result.access_token;
}

export async function sendEmail(env, { to, subject, html, text }) {
  try {
    const accessToken = await getGmailAccessToken(env);
    const mime = buildMimeMessage({ env, to, subject, html, text });
    const raw = base64UrlEncodeUtf8(mime);

    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      }
    );

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.error?.message ||
        result.message ||
        `Gmail send failed with ${response.status}`
      );
    }

    return {
      ok: true,
      result
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message || 'Could not send Gmail email'
    };
  }
}

export function bilingualEmail({
  titleEn,
  titleDe,
  summaryEn,
  summaryDe,
  detailsEn,
  detailsDe
}) {
  const subject = `${titleDe} / ${titleEn}`;

  const text = `
${titleDe}
${summaryDe}

Details:
${detailsDe}

------------------------------

${titleEn}
${summaryEn}

Details:
${detailsEn}
`.trim();

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:680px">
      <section style="padding:16px 0">
        <h2 style="margin:0 0 8px">${titleDe}</h2>
        <p style="font-size:16px;margin:0 0 14px"><strong>${summaryDe}</strong></p>
        <div style="padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb">
          ${detailsDe}
        </div>
      </section>

      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb" />

      <section style="padding:4px 0 16px">
        <h2 style="margin:0 0 8px">${titleEn}</h2>
        <p style="font-size:16px;margin:0 0 14px"><strong>${summaryEn}</strong></p>
        <div style="padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #e5e7eb">
          ${detailsEn}
        </div>
      </section>
    </div>
  `;

  return { subject, text, html };
}

export async function logEmail(env, {
  emailType,
  taskId = null,
  recipientPerson = null,
  recipientEmail,
  referenceDate = null,
  status,
  error = null
}) {
  await env.DB.prepare(`
    INSERT INTO email_log (
      id,
      email_type,
      task_id,
      recipient_person,
      recipient_email,
      reference_date,
      status,
      error
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      crypto.randomUUID(),
      emailType,
      taskId,
      recipientPerson,
      recipientEmail,
      referenceDate,
      status,
      error
    )
    .run();
}

export async function sendAndLog(env, payload, logPayload) {
  const result = await sendEmail(env, payload);

  await logEmail(env, {
    ...logPayload,
    recipientEmail: payload.to,
    status: result.ok ? 'sent' : 'failed',
    error: result.error || null
  });

  return result;
}

export async function onRequestPost() {
  return json({ error: 'Direct email API calls are disabled' }, 405);
}