# Marada standalone booking application

This directory contains only the existing React client and Express/MySQL server, copied without changing their source behavior. No ChatGPT Sites deployment, Worker, D1, Git history, production data or secret files belong here. Do not add or deploy a hosted Sites copy unless explicitly requested.

## Structure

- `client/src/main.jsx` mounts the language and authentication providers. `client/src/App.jsx` owns the calendar, dialogs and fetching. `client/src/theme.css` owns the UI themes and responsive sizing.
- `server/src/index.js` mounts the API routes. `server/src/bootstrap.js` checks schema/account prerequisites. `server/sql/schema.sql` initializes MySQL; it is schema, not a data backup.
- The frontend test `client/src/lib/reservation-list.test.js` imports `server/src/lib/mask.js`. Keep the sibling client/server paths intact.
- `client/dev/` contains local visual fixtures excluded from the production build. These are not production pages.
- API authorization and phone masking remain server responsibilities. Staff is read-only; admin writes must retain existing checks.

## Commands

From this directory: `npm --prefix client ci`, `npm --prefix server ci`, `npm --prefix client test`, `npm --prefix client run build`.

After configuring a database and local environment, the existing runtime commands are `npm --prefix server run dev` and `npm --prefix client run dev`. Vite uses 5173 and proxies /api to localhost:4000. Read README.md for startup prerequisites; check VERIFICATION.md for what has actually been run. Never connect to or overwrite an existing database just to verify a source copy.

## Changes and verification

Preserve the existing layout, roles, API contracts, two-second action success behavior, data-bound skeleton readiness and keyboard interactions. Run relevant tests and builds after changes. Do not claim runtime or visual approval from build results alone.

Keep real `.env`, credentials, database dumps and customer data out of documentation and Git. Production deployment configuration is not provided in this copy.

## Loading display changes

Calendar date cells no longer render loading placeholder bars beneath their numerals. The pending-request count uses a plain dash when data is unavailable, and shows the actual count after loading, including zero. Keep aria-busy, request readiness, errors and refresh behavior intact. Reservation-card skeletons, the startup calendar skeleton, request-list skeletons and management-page skeletons remain. These changes apply only to this standalone directory, not the original project or hosted site.
