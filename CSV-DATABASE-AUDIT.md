# Verify CSV records against SQLite

After importing a CSV successfully, run from the project root:

```bash
python tools/audit_csv_import.py "C:/path/to/StudentAttendanceReport.csv"
```

Python 3 is required. It uses only the standard library. The audit compares every field and every record of the latest import with that filename, including duplicates, against `backend/data/attendance.sqlite`. It is read-only. **PASS** means the imported rows are identical to the source file. **FAIL** means records are missing/modified/extra; back up your database, then re-import that CSV and rerun the audit. The audit cannot determine attendance/presence status not provided by the CSV or validate an export against the external portal.

If multiple imports share a filename, the newest one is compared. Use distinct filenames to audit individual imports.
