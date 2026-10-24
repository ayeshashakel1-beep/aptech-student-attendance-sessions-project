"""Compare one CSV against its latest same-name import in the project SQLite DB.
Usage: python tools/audit_csv_import.py "path/to/StudentAttendanceReport.csv"
Does not modify the database. Exit 0 = exact match; exit 1 = mismatch/error.
"""
import csv
import sqlite3
import sys
from collections import Counter
from pathlib import Path

FIELDS = [
    ('StudentID', 'student_id'), ('StudentName', 'student_name'), ('CourseCode', 'course_code'),
    ('CourseName', 'course_name'), ('TermName', 'term_name'), ('TermSequence', 'term_sequence'),
    ('ModuleName', 'module_name'), ('ModuleSequence', 'module_sequence'),
    ('SessionName', 'session_name'), ('SessionSequence', 'session_sequence'),
    ('AttendanceDate', 'attendance_date'), ('CenterName', 'center_name')
]
REQUIRED = ['StudentID', 'ModuleName', 'SessionSequence']

def normalize(row, source):
    values = []
    for csvfield, dbfield in FIELDS:
        value = row.get(csvfield if source == 'csv' else dbfield, '')
        value = '' if value is None else str(value).strip()
        if dbfield == 'session_sequence':
            try: value = str(int(value))
            except ValueError: raise ValueError(f'Invalid session sequence: {value!r}')
        values.append(value)
    return tuple(values)

def main():
    if len(sys.argv) < 2:
        print(__doc__); return 1
    file = Path(sys.argv[1]).resolve()
    database = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else Path(__file__).resolve().parents[1] / 'backend/data/attendance.sqlite'
    if not file.is_file() or not database.is_file():
        print('Missing CSV or database:', file, database); return 1
    with sqlite3.connect(f'file:{database}?mode=ro', uri=True) as conn:
        candidates = conn.execute('SELECT id, row_count FROM session_log_imports WHERE filename=? ORDER BY rowid DESC', (file.name,)).fetchall()
        if not candidates:
            print('No import with the same filename. Import the CSV before auditing.'); return 1
        import_id, recorded_count = candidates[0]
        if len(candidates)>1: print('Note: Multiple imports share this filename; comparing the most recent import.')
        expected = Counter()
        with file.open(encoding='utf-8-sig', newline='') as fh:
            reader = csv.DictReader(fh)
            absent = [name for name in REQUIRED if name not in (reader.fieldnames or [])]
            if absent: print('Missing required CSV headers:', absent); return 1
            for n, row in enumerate(reader, 2):
                if not row.get('StudentID','').strip() or not row.get('ModuleName','').strip():
                    print(f'Invalid student/module at CSV row {n}'); return 1
                try: expected[normalize(row, 'csv')] += 1
                except ValueError as exc: print(f'CSV row {n}: {exc}'); return 1
        query = 'SELECT ' + ','.join(dbf for _, dbf in FIELDS) + ' FROM session_log_rows WHERE import_id=?'
        found = Counter(normalize(dict(zip([name for _,name in FIELDS], r)), 'db') for r in conn.execute(query,(import_id,)))
        total_csv = sum(expected.values()); total_db = sum(found.values())
        missing = expected - found
        extras = found - expected
        print('Filename:',file.name,'CSV rows:',total_csv,'SQLite rows:',total_db,'Import recorded:',recorded_count)
        if not missing and not extras and total_csv == recorded_count:
            print('PASS: Every field of every CSV record matches the imported SQLite records.'); return 0
        print('FAIL: Mismatch detected. Missing source rows:', sum(missing.values()), 'Extra database rows:',sum(extras.values()))
        for title, rows in [('Missing',missing), ('Extra',extras)]:
            for key, count in list(rows.items())[:5]:
                print(title, count, 'Student:',key[0], 'Skill:',key[6], 'Session:',key[9])
        return 1

if __name__ == '__main__':
    sys.exit(main())
