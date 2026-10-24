# Accuracy and repair guide

The application reports **sessions found in the local SQLite database**, not live portal attendance. A correct original CSV does not fix an older incomplete database import until the CSV is imported again.

## Verified example

The supplied `StudentAttendanceReport (1)(3).csv` contains all session numbers 1–12 for Student1528729, curriculum 7062, semester 01, Office Automation. Expected coverage after import is 12/12 = 100%, missing none.

## Repair existing installations

1. Back up `backend/data/attendance.sqlite` (and accompanying SQLite WAL/SHM files if present; stop server before copying).
2. Open CSV imports and upload the complete original `StudentAttendanceReport (1)(3).csv` again. Do not delete older imports first.
3. Wait for the verified upload success message. The import now checks server acknowledgements per chunk and verifies saved row count.
4. Search `Student1528729`, select 7062 > CPISM > Semester 01 > Inside Microsoft Office. You should see session numbers 1–12 and 100% **record coverage**.
5. If not, confirm that the app is using the same SQLite database and the expected server instance. Check the student ID and imported file list.

Reimporting a file appends source records; the report deduplicates identical records and session numbers. These checks validate persistence, not attendance status. The portal remains the authoritative attendance source.
