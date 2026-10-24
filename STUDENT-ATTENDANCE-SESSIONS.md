# Student Attendance Sessions

The sidebar is intentionally simplified to Dashboard, Student Attendance Sessions, and the existing Student Session Tracker. Academic Structure, Attendance Sessions, Mark Attendance, Attendance Reports, Students, CSV Import, CSV Import History, and Settings navigation entries are hidden. Existing source pages remain in the codebase.

## Student Attendance Sessions
- Search by Student ID, then filter by curriculum, course, semester, and skill/module.
- Compare planned session totals with unique session numbers found in imported CSV records. Show missing numbers and record coverage per skill.
- Import one or multiple CSV files at once. Each CSV is saved as a separate import batch and appends to existing session data.
- Delete an individual imported CSV and only the session rows belonging to that file.
- The existing Student Session Tracker page/component is not modified.

## Important data limitation
The uploaded report has no explicit Present/Absent status column. Percentage means recorded unique session numbers / planned sessions, not verified attendance. A missing session means no matching row was found in imported files and does not prove the student was absent. Module matching is normalized exact skill name; differently named modules are not automatically merged.
