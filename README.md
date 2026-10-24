# Pixel Perfect Picture Match

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/56abb506-870c-40c4-bf2f-768bd27d5e6e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```


## Local backend (Express + SQLite)

The application uses a local Express API and SQLite database. On first launch, the supplied 7144/7062 academic structure and all 666 planned session slots are loaded into the local database automatically. No demo students or student attendance marks are seeded. The database is created at `backend/data/attendance.sqlite` the first time the API starts.

### Requirements
- Node.js 20 or newer (Node.js 22 LTS recommended)
- npm

### Start the app in VS Code
1. Open this project folder in VS Code.
2. Open **Terminal → New Terminal**.
3. Run `npm install`.
4. Run `npm run dev`. This starts the frontend and API together.
5. Open the local URL printed by Vite (usually `http://localhost:3000` or the port shown in your terminal).

The API health endpoint is `http://127.0.0.1:4000/api/health`. The frontend proxies `/api` requests to the local API. Keep the terminal open while using the app.

### Persistence and privacy
Student IDs and BC Numbers are stored as text to preserve leading zeros. Student ID and non-empty BC Number values must be unique; the BC Number comparison is case-insensitive. The SQLite database remains on this computer. Back up `backend/data/attendance.sqlite` before moving or reinstalling the project.

### Important limitation
This local version is intended for one computer and does not yet include user accounts, authentication, role permissions, or multi-user network access. Do not expose the API to the public internet as-is.

## Student Session Tracker (CSV session-log mode)

- Open **Student Session Tracker** in the sidebar.
- Upload the session report CSV (the report must contain `StudentID`, `StudentName`, `CourseCode`, `TermName`, `TermSequence`, `ModuleName`, `ModuleSequence`, `SessionName`, `SessionSequence`, and `AttendanceDate`; the supplied export also includes `CourseName` and `CenterName`).
- Search a Student ID, for example `Student1692755`.
- The tracker compares unique `SessionSequence` values with the planned session totals for exact module names in the supplied catalog. Matching includes curriculum code and semester. A differently named module is not treated as the same module: for example, `Progressive Website Development` (20 planned sessions) and `eProject-Responsive Website Development` (10 CSV sessions) remain separate. Only modules from the supplied catalog are reported.
- The uploaded session-log rows are stored in the local SQLite database. Each CSV import is saved separately and appended to existing imports; individual imported files can be deleted from the tracker.
- The source export has no explicit Present/Absent or marks column. The tracker therefore reports sessions **found in the CSV** and session numbers **missing from the CSV**; missing records are not asserted to be confirmed absences.
- The supplied 7144 and 7062 curriculum/module list is loaded automatically when the database has no academic structure. Existing non-empty structure is preserved. The supplied course labels (CPISM, DISM, HDSE I, HDSE II, ADSE I and ADSE II) are included under both curriculum codes 7144 and 7062.
- Student ID and name are required for manual student entry; BC Number is optional.


## Hosting / Netlify note

This repository is currently a full-stack local app, not a static-only website. Its `/api/*` endpoints are served by `backend/server.mjs` and data is stored in `backend/data/attendance.sqlite`. The Vite development proxy points to `127.0.0.1:4000`, which exists only on the developer's computer. Uploading this ZIP to Netlify as-is will **not** make CSV import, student search, or per-file deletion work on the public site. Netlify's normal static hosting also does not provide a persistent local SQLite disk for this backend.

For a working public URL, deploy the Node/Express API to a host with persistent storage (or migrate the database to a hosted database), then configure the frontend to call that API and enable restricted CORS. Do not publish student CSV data publicly or expose the current API without authentication and access controls.
