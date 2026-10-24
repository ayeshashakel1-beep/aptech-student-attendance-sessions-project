# Aptech V3: local SQLite and CSV verification

This is the original React UI + Node.js/Express + `better-sqlite3` backend.
The supplied `backend/data/attendance.sqlite` database is included in this ZIP. Keep it private because it contains student records.

## Run

1. Extract to a folder. Install Node.js 22 or later.
2. From the project folder run `npm install` and `npm run dev`.
3. Use the Local URL printed by Vite. The API runs on port 4000.
4. Take a backup of `backend/data/attendance.sqlite` before importing or deleting a file.

## Accuracy

- CSV batches are read back from SQLite and compared with their SHA-256 checksum.
- If a stored file's row count doesn't match the import metadata, reports are hidden with a warning.
- Data is matched using student ID, curriculum code, semester, and approved portal skill name. SessionSequence identifies a session; the same number is counted once.
- A missing record in a CSV cannot prove a student was absent. Percentage means CSV record coverage, not portal attendance.
- The source CSV exports and current database should be audited together with `tools/audit_csv_import.py` or `tools/audit_all_sqlite_vs_csv.py` before deployment.

## Security

Student data is sensitive. Do not commit the SQLite database or ZIP to public GitHub, Netlify or Vercel. SQLite on Netlify static hosting will not persist. This project runs locally, or on a private server with persistent storage.
