# CSV import fixes and sharing on multiple PCs

## CSV fix
Large CSV files are parsed locally and sent to the API in batches of 500 rows. Every batch is saved to SQLite and grouped under a single import ID. Failed imports are rolled back by deleting the corresponding batch ID when possible. HTML responses from a misconfigured server are displayed as useful errors rather than JSON parse exceptions. Old records are not erased when another file is imported.

## Run locally
1. Install Node.js (current LTS) and run `npm install` inside the project directory.
2. Run `npm run dev` on the primary PC. The API runs on port 4000; the UI runs on the Vite port shown in the terminal.
3. Make sure the backend health check responds at `http://localhost:4000/api/health`.

## Multiple PCs on one network
Use ONE primary PC for the SQLite database and backend. The API listens on the host network interface. Run the web UI with the Vite host option, e.g. `npm run dev:web -- --host 0.0.0.0`, while the backend runs on the primary PC (`npm run dev:api`). Open `http://PRIMARY-PC-LAN-IP:VITE-PORT` on each client PC. The Vite proxy forwards `/api` to the backend on the primary PC, so every device sees the same database. Allow the selected Vite port in the primary PC firewall for trusted LAN devices only. All devices should remain on the same private LAN; do not expose unauthenticated port 4000 to the internet.

## Public internet use
Deploy behind HTTPS and an authenticated backend with access control and backups. Do not simply publish this dev server or unauthenticated SQLite API to the public internet.

## Backup
The live database is `backend/data/attendance.sqlite`. Make backups with SQLite's backup command or while the server is stopped; copying only the live SQLite file while WAL is active can miss transactions.
