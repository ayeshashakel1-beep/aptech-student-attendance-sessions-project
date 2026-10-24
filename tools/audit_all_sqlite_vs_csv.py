#!/usr/bin/env python3
"""Compare each SQLite import against its original CSV export, field by field.
No records are modified. Run: python tools/audit_all_sqlite_vs_csv.py path/to/large.csv path/to/small.csv
The arguments must appear in the same order as the import names shown by the program.
"""
import sys, csv, sqlite3, collections, pathlib

FIELDS=("studentId", "studentName", "courseCode", "courseName", "termName", "termSequence", "moduleName", "moduleSequence", "sessionName", "sessionSequence", "attendanceDate", "centerName")
CSV_NAMES=("StudentID", "StudentName", "CourseCode", "CourseName", "TermName", "TermSequence", "ModuleName", "ModuleSequence", "SessionName", "SessionSequence", "AttendanceDate", "CenterName")
SQL_NAMES=("student_id", "student_name", "course_code", "course_name", "term_name", "term_sequence", "module_name", "module_sequence", "session_name", "session_sequence", "attendance_date", "center_name")

def normalized(row):
    return tuple(str(x or "").strip() if index != 9 else str(int(str(x).strip())) for index,x in enumerate(row))

def source_rows(path):
    with open(path, 'r', encoding='utf-8-sig', newline='') as stream:
        for line, item in enumerate(csv.DictReader(stream), start=2):
            try:
                value=normalized([item.get(name, "") for name in CSV_NAMES])
            except (ValueError, TypeError):
                raise ValueError(f"Invalid session sequence on CSV line {line}")
            if not value[0] or not value[6] or int(value[9])<=0:
                raise ValueError(f"Invalid student/module/session on CSV line {line}")
            yield value

def audit(db_path, paths):
    con=sqlite3.connect(f'file:{pathlib.Path(db_path).resolve()}?mode=ro',uri=True)
    try:
        imports=con.execute('select id, filename, row_count from session_log_imports order by uploaded_at asc, rowid asc').fetchall()
        if len(paths)!=len(imports):
            raise ValueError(f"Expected {len(imports)} original files, got {len(paths)}")
        print('SQLite check:',con.execute('pragma quick_check').fetchone()[0])
        result=True
        for (import_id, name, expected), file_path in zip(imports,paths):
            observed=collections.Counter(source_rows(file_path))
            stored=collections.Counter(normalized(row) for row in con.execute('select '+','.join(SQL_NAMES)+' from session_log_rows where import_id=?',(import_id,)))
            missing=observed-stored; unexpected=stored-observed
            good= not missing and not unexpected and sum(stored.values())==expected
            print(f"{'PASS' if good else 'FAIL'} | {name} | original {sum(observed.values())} | SQLite {sum(stored.values())} | missing {sum(missing.values())} | extra {sum(unexpected.values())}")
            if missing: print('First missing record:',next(iter(missing)))
            if unexpected: print('First extra record:',next(iter(unexpected)))
            result &= good
        return result
    finally: con.close()

if __name__=='__main__':
    db=pathlib.Path(__file__).resolve().parents[1]/'backend/data/attendance.sqlite'
    try: ok=audit(db, sys.argv[1:])
    except Exception as err: print('AUDIT ERROR:',err);sys.exit(2)
    print('FINAL:', 'PASS' if ok else 'FAIL')
    sys.exit(0 if ok else 1)
