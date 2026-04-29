# Flat Cleaning Scheduler — Cloudflare Free Version

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
10. Deploy.
