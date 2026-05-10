<!-- # Flat Cleaning Scheduler — Cloudflare Free Version

This is a responsive shared apartment cleaning scheduler for Melanie, Animesh, and Naveen.

## Stack

- React + Vite frontend
- Cloudflare Pages hosting
- Cloudflare Pages Functions API
- Cloudflare D1 database
- Shared PIN for write actions

## Local test

```bash
npm install
npm run build
npx wrangler d1 create flatclean_db
npx wrangler d1 execute flatclean_db --local --file=schema.sql
npx wrangler pages dev dist --d1 DB=flatclean_db
```

Open the local URL shown by Wrangler.

## Production deployment summary

1. Create D1 database:

```bash
npx wrangler d1 create flatclean_db
```

2. Copy the returned database_id into `wrangler.toml`.
3. Create tables:

```bash
npx wrangler d1 execute flatclean_db --remote --file=schema.sql
```

4. Push code to GitHub.
5. In Cloudflare: Workers & Pages → Create → Pages → Connect to Git.
6. Build command: `npm run build`
7. Build output directory: `dist`
8. Add D1 binding:
   - Variable name: `DB`
   - Database: `flatclean_db`
9. Add environment variable:
   - `APP_PIN=your_chosen_pin`
10. Deploy. -->


# Flat Cleaning Scheduler — Cloudflare Free Version

A responsive shared-apartment cleaning scheduler for Melanie, Animesh, and Naveen.

## Stack

- React + Vite frontend
- Cloudflare Pages hosting
- Cloudflare Pages Functions API
- Cloudflare D1 database
- Separate Cloudflare Worker for scheduled maintenance/reminders
- Gmail OAuth for email notifications
- Shared admin PIN for admin-only actions

## Important security note

Do **not** commit real PINs, Gmail OAuth tokens, or production database IDs to a public repository.

Use Cloudflare environment variables/secrets for:

- `ADMIN_PIN`
- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_FROM_EMAIL`
- `GMAIL_FROM_NAME` optional
- `MAINTENANCE_TOKEN` optional but recommended for manual maintenance endpoint calls

`APP_PIN` is still accepted by the API as a legacy fallback, but new deployments should use `ADMIN_PIN`.

## Local test

```bash
npm install
npm run build
npx wrangler d1 create flatclean_db
npx wrangler d1 execute flatclean_db --local --file=schema.sql
npx wrangler pages dev dist --d1 DB=flatclean_db
```

Open the local URL shown by Wrangler.

## Production deployment summary

1. Create the D1 database:

```bash
npx wrangler d1 create flatclean_db
```

2. Copy the returned `database_id` into `wrangler.toml` or configure the D1 binding in the Cloudflare Pages dashboard.

3. Create the current database schema:

```bash
npx wrangler d1 execute flatclean_db --remote --file=schema.sql
```

`schema.sql` is now a complete fresh-install schema. The older `migration_*.sql` files are retained for reference/legacy databases, but a new database should only need `schema.sql`.

4. Add Cloudflare Pages environment variables:

```text
ADMIN_PIN=your_chosen_admin_pin
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REFRESH_TOKEN=...
GMAIL_FROM_EMAIL=...
GMAIL_FROM_NAME=Flat Cleaning Schedule
```

5. Push code to GitHub.
6. In Cloudflare: Workers & Pages → Create → Pages → Connect to Git.
7. Build command: `npm run build`.
8. Build output directory: `dist`.
9. Add D1 binding:
   - Variable name: `DB`
   - Database: `flatclean_db`
10. Deploy.

## Scheduled maintenance Worker

The app includes a separate Worker entry point in `maintenance-worker.js` and config in `wrangler.maintenance.toml`.

Before deploying it, make sure its D1 binding points to the same database and that Gmail variables are available to the Worker as well.

Then deploy with:

```bash
npx wrangler deploy -c wrangler.maintenance.toml
```

## Fresh DB verification

After applying `schema.sql`, verify that the API can read state:

```bash
npx wrangler pages dev dist --d1 DB=flatclean_db
```

Then open:

```text
/api/state
```

You should receive JSON containing `flatmates`, `tasks`, `logs`, `scores`, and `activeScoringPeriod`.

## Notes on legacy migrations

Older deployments may have applied these files over time:

- `migration_subtasks.sql`
- `migration_due_logic.sql`
- `migration_email_scores.sql`
- `migration_availability.sql`
- `migration_admin_scoring_periods.sql`
- `006_task_admin.sql`
- `maintenance_optional_migration.sql`

For a new database, prefer the canonical `schema.sql`. For an existing database, back up first and apply only the missing migrations carefully, because raw `ALTER TABLE ... ADD COLUMN` statements are not safe to run twice.
