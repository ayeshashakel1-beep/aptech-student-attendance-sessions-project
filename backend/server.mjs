import express from 'express';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(here, 'data');
mkdirSync(dataDir, { recursive: true });
const db = new Database(resolve(dataDir, 'attendance.sqlite'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS curricula (id TEXT PRIMARY KEY, name TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS courses (id TEXT PRIMARY KEY, name TEXT NOT NULL, curriculum_id TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS semesters (id TEXT PRIMARY KEY, name TEXT NOT NULL, course_id TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS modules (id TEXT PRIMARY KEY, name TEXT NOT NULL, semester_id TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS students (
    student_id TEXT PRIMARY KEY, bc_number TEXT NOT NULL, name TEXT NOT NULL, email TEXT, batch TEXT,
    curriculum_id TEXT NOT NULL, course_id TEXT NOT NULL, semester_id TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS students_bc_number_unique
    ON students(lower(trim(bc_number))) WHERE bc_number IS NOT NULL AND trim(bc_number) <> '';
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY, module_id TEXT NOT NULL, number INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '', date TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
    UNIQUE(module_id, number)
  );
  CREATE TABLE IF NOT EXISTS attendance_records (
    session_id TEXT NOT NULL, student_id TEXT NOT NULL, status TEXT NOT NULL, import_id TEXT,
    PRIMARY KEY(session_id, student_id)
  );
  CREATE TABLE IF NOT EXISTS imports (
    id TEXT PRIMARY KEY, filename TEXT NOT NULL, uploaded_at TEXT NOT NULL, structure_json TEXT NOT NULL,
    total_rows INTEGER NOT NULL, imported_rows INTEGER NOT NULL, rejected_rows INTEGER NOT NULL,
    status TEXT NOT NULL, raw_text TEXT, rejected_json TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_settings (id INTEGER PRIMARY KEY CHECK (id = 1), rules_json TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS session_log_imports (
    id TEXT PRIMARY KEY, filename TEXT NOT NULL, uploaded_at TEXT NOT NULL, row_count INTEGER NOT NULL DEFAULT 0, distinct_students INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS session_log_rows (
    id INTEGER PRIMARY KEY AUTOINCREMENT, import_id TEXT, student_id TEXT NOT NULL, student_name TEXT NOT NULL DEFAULT '',
    course_code TEXT NOT NULL DEFAULT '', course_name TEXT NOT NULL DEFAULT '', term_name TEXT NOT NULL DEFAULT '',
    term_sequence TEXT NOT NULL DEFAULT '', module_name TEXT NOT NULL, module_sequence TEXT NOT NULL DEFAULT '',
    session_name TEXT NOT NULL DEFAULT '', session_sequence INTEGER NOT NULL, attendance_date TEXT NOT NULL DEFAULT '', center_name TEXT NOT NULL DEFAULT ''
  );
  CREATE INDEX IF NOT EXISTS session_log_student_idx ON session_log_rows(student_id);
  CREATE TABLE IF NOT EXISTS session_plan_overrides (module_name TEXT PRIMARY KEY, total_sessions INTEGER NOT NULL CHECK(total_sessions > 0));
`);

try { db.exec('ALTER TABLE session_log_rows ADD COLUMN import_id TEXT'); } catch (error) { if (!String(error?.message ?? '').includes('duplicate column name')) throw error; }

const app = express();
// API failures always return JSON, not an HTML error page.
app.disable('x-powered-by');
app.use(express.json({ limit: '25mb' }));
const emptyState = () => ({ curricula: [], courses: [], semesters: [], modules: [], students: [], sessions: [], records: [], imports: [], rules: { late: 'exclude', excused: 'exclude', lowAttendanceThreshold: 75 } });

function readState() {
  const state = emptyState();
  state.curricula = db.prepare('SELECT id, name FROM curricula ORDER BY rowid').all();
  state.courses = db.prepare('SELECT id, name, curriculum_id AS curriculumId FROM courses ORDER BY rowid').all();
  state.semesters = db.prepare('SELECT id, name, course_id AS courseId FROM semesters ORDER BY rowid').all();
  state.modules = db.prepare('SELECT id, name, semester_id AS semesterId FROM modules ORDER BY rowid').all();
  state.students = db.prepare(`SELECT student_id AS studentId, bc_number AS bcNumber, name, email, batch, curriculum_id AS curriculumId, course_id AS courseId, semester_id AS semesterId FROM students ORDER BY rowid`).all()
    .map((s) => ({ ...s, bcNumber: s.bcNumber ?? undefined, email: s.email ?? undefined, batch: s.batch ?? undefined }));
  state.sessions = db.prepare('SELECT id, module_id AS moduleId, number, title, date, status FROM sessions ORDER BY rowid').all();
  state.records = db.prepare('SELECT session_id AS sessionId, student_id AS studentId, status, import_id AS importId FROM attendance_records ORDER BY rowid').all()
    .map((r) => ({ ...r, importId: r.importId ?? undefined }));
  state.imports = db.prepare(`SELECT id, filename, uploaded_at AS uploadedAt, structure_json, total_rows AS totalRows, imported_rows AS importedRows, rejected_rows AS rejectedRows, status, raw_text AS rawText, rejected_json FROM imports ORDER BY rowid DESC`).all()
    .map((r) => ({ id: r.id, filename: r.filename, uploadedAt: r.uploadedAt, structure: JSON.parse(r.structure_json), totalRows: r.totalRows, importedRows: r.importedRows, rejectedRows: r.rejectedRows, status: r.status, rawText: r.rawText, rejected: JSON.parse(r.rejected_json) }));
  const setting = db.prepare('SELECT rules_json FROM app_settings WHERE id = 1').get();
  if (setting) state.rules = JSON.parse(setting.rules_json);
  return state;
}

function validateState(input) {
  if (!input || typeof input !== 'object') return 'Request body must be a state object.';
  for (const key of ['curricula', 'courses', 'semesters', 'modules', 'students', 'sessions', 'records', 'imports']) {
    if (!Array.isArray(input[key])) return `Field "${key}" must be an array.`;
  }
  const ids = new Set();
  const bcNumbers = new Map();
  for (const s of input.students) {
    const id = String(s.studentId ?? '').trim();
    const bc = String(s.bcNumber ?? '').trim();
    if (!id) return 'Every student must have a Student ID.';
    if (ids.has(id)) return `Student ID "${id}" is duplicated.`;
    ids.add(id);
    if (bc) {
      const key = bc.toLowerCase();
      if (bcNumbers.has(key)) return `BC Number "${bc}" is already assigned to Student ID "${bcNumbers.get(key)}".`;
      bcNumbers.set(key, id);
    }
  }
  const sessionKeys = new Set();
  for (const s of input.sessions) {
    const key = `${s.moduleId}\u0000${s.number}`;
    if (sessionKeys.has(key)) return `Session ${s.number} is duplicated for module "${s.moduleId}".`;
    sessionKeys.add(key);
  }
  return null;
}

const replaceState = db.transaction((state) => {
  db.exec('DELETE FROM attendance_records; DELETE FROM imports; DELETE FROM sessions; DELETE FROM students; DELETE FROM modules; DELETE FROM semesters; DELETE FROM courses; DELETE FROM curricula;');
  const insertCurriculum = db.prepare('INSERT INTO curricula (id, name) VALUES (@id, @name)');
  const insertCourse = db.prepare('INSERT INTO courses (id, name, curriculum_id) VALUES (@id, @name, @curriculumId)');
  const insertSemester = db.prepare('INSERT INTO semesters (id, name, course_id) VALUES (@id, @name, @courseId)');
  const insertModule = db.prepare('INSERT INTO modules (id, name, semester_id) VALUES (@id, @name, @semesterId)');
  const insertStudent = db.prepare('INSERT INTO students (student_id, bc_number, name, email, batch, curriculum_id, course_id, semester_id) VALUES (@studentId, @bcNumber, @name, @email, @batch, @curriculumId, @courseId, @semesterId)');
  const insertSession = db.prepare('INSERT INTO sessions (id, module_id, number, title, date, status) VALUES (@id, @moduleId, @number, @title, @date, @status)');
  const insertRecord = db.prepare('INSERT INTO attendance_records (session_id, student_id, status, import_id) VALUES (@sessionId, @studentId, @status, @importId)');
  const insertImport = db.prepare('INSERT INTO imports (id, filename, uploaded_at, structure_json, total_rows, imported_rows, rejected_rows, status, raw_text, rejected_json) VALUES (@id, @filename, @uploadedAt, @structure, @totalRows, @importedRows, @rejectedRows, @status, @rawText, @rejected)');
  for (const row of state.curricula) insertCurriculum.run({ id: String(row.id), name: String(row.name ?? '') });
  for (const row of state.courses) insertCourse.run({ id: String(row.id), name: String(row.name ?? ''), curriculumId: String(row.curriculumId ?? '') });
  for (const row of state.semesters) insertSemester.run({ id: String(row.id), name: String(row.name ?? ''), courseId: String(row.courseId ?? '') });
  for (const row of state.modules) insertModule.run({ id: String(row.id), name: String(row.name ?? ''), semesterId: String(row.semesterId ?? '') });
  for (const row of state.students) insertStudent.run({ studentId: String(row.studentId).trim(), bcNumber: String(row.bcNumber ?? '').trim(), name: String(row.name ?? '').trim(), email: row.email ? String(row.email) : null, batch: row.batch ? String(row.batch) : null, curriculumId: String(row.curriculumId ?? ''), courseId: String(row.courseId ?? ''), semesterId: String(row.semesterId ?? '') });
  for (const row of state.sessions) insertSession.run({ id: String(row.id), moduleId: String(row.moduleId), number: Number(row.number), title: String(row.title ?? ''), date: String(row.date ?? ''), status: String(row.status) });
  for (const row of state.records) insertRecord.run({ sessionId: String(row.sessionId), studentId: String(row.studentId), status: String(row.status), importId: row.importId ? String(row.importId) : null });
  for (const row of state.imports) insertImport.run({ id: String(row.id), filename: String(row.filename ?? ''), uploadedAt: String(row.uploadedAt ?? new Date().toISOString()), structure: JSON.stringify(row.structure ?? {}), totalRows: Number(row.totalRows ?? 0), importedRows: Number(row.importedRows ?? 0), rejectedRows: Number(row.rejectedRows ?? 0), status: String(row.status ?? 'applied'), rawText: row.rawText ?? null, rejected: JSON.stringify(row.rejected ?? []) });
  db.prepare('INSERT INTO app_settings (id, rules_json) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET rules_json = excluded.rules_json').run(JSON.stringify(state.rules ?? emptyState().rules));
});

app.get('/api/health', (_req, res) => res.json({ ok: true, database: 'sqlite', status: 'connected' }));
app.get('/api/state', (_req, res) => {
  try { res.json(readState()); }
  catch (error) { console.error('Could not read database state:', error); res.status(500).json({ error: 'Could not read local database.' }); }
});
app.put('/api/state', (req, res) => {
  const problem = validateState(req.body);
  if (problem) return res.status(400).json({ error: problem });
  try { replaceState(req.body); return res.json({ ok: true, savedAt: new Date().toISOString() }); }
  catch (error) {
    console.error('Could not save database state:', error);
    if (String(error?.message ?? '').includes('UNIQUE constraint failed')) return res.status(409).json({ error: 'Duplicate BC Number or session number detected. Correct the duplicate and try again.' });
    return res.status(500).json({ error: 'Could not save data to the local database. Check the data and try again.' });
  }
});

const INTEGRITY_FIELDS = ['studentId','studentName','courseCode','courseName','termName','termSequence','moduleName','moduleSequence','sessionName','sessionSequence','attendanceDate','centerName'];
const digestRows = rows => createHash('sha256').update(JSON.stringify(rows.map(row => INTEGRITY_FIELDS.map(key => key === 'sessionSequence' ? Number(row[key]) : String(row[key] ?? '').trim())))).digest('hex');
// Session-log CSV support. Imports are appended and can be removed individually.
app.get('/api/session-log', (req, res) => {
  const studentId = String(req.query.studentId ?? '').trim();
  if (!studentId) {
    const stats = db.prepare(`SELECT COUNT(*) AS rows, COUNT(DISTINCT student_id) AS students,
      (SELECT COUNT(*) FROM (SELECT DISTINCT student_id, student_name, course_code, course_name, term_name, term_sequence, module_name, module_sequence, session_name, session_sequence, attendance_date, center_name FROM session_log_rows)) AS uniqueRows
      FROM session_log_rows`).get();
    const imports = db.prepare('SELECT id, filename, uploaded_at AS uploadedAt, row_count AS rowCount, distinct_students AS distinctStudents FROM session_log_imports ORDER BY uploaded_at DESC, rowid DESC').all();
    const savedByImport = db.prepare('SELECT import_id AS id, COUNT(*) AS storedRows FROM session_log_rows WHERE import_id IS NOT NULL GROUP BY import_id').all();
    const storedMap = new Map(savedByImport.map(entry => [entry.id, entry.storedRows]));
    const importIntegrity = imports.every(entry => entry.rowCount === (storedMap.get(entry.id) ?? 0));
    return res.json({ ...stats, imported: stats.rows > 0, imports, importIntegrity });
  }
  const rows = db.prepare(`SELECT student_id AS studentId, student_name AS studentName, course_code AS courseCode,
    course_name AS courseName, term_name AS termName, term_sequence AS termSequence,
    module_name AS moduleName, module_sequence AS moduleSequence, session_name AS sessionName,
    session_sequence AS sessionSequence, attendance_date AS attendanceDate, center_name AS centerName
    FROM session_log_rows WHERE student_id = ? ORDER BY CAST(term_sequence AS INTEGER), module_name, session_sequence`).all(studentId);
  return res.json({ rows });
});
// Chunked imports prevent large CSVs from exceeding HTTP/proxy body limits.
// A single import ID groups all chunks so deletion removes the complete file.
// Verify every imported row persisted before reporting upload success.
app.get('/api/session-log/imports/:id/verify', (req, res) => {
  const entry = db.prepare('SELECT row_count AS rowCount FROM session_log_imports WHERE id = ?').get(req.params.id);
  if (!entry) return res.status(404).json({ error: 'Import not found.' });
  const stats = db.prepare('SELECT COUNT(*) AS storedRows FROM session_log_rows WHERE import_id = ?').get(req.params.id);
  return res.json({ ...entry, ...stats });
});

app.post('/api/session-log/chunk', (req, res) => {
  const { importId, filename, rows, first, last, expectedHash } = req.body ?? {};
  if (typeof importId !== 'string' || !/^csv-[a-zA-Z0-9-]{8,100}$/.test(importId)) return res.status(400).json({ error: 'Invalid import identifier.' });
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 1000) return res.status(400).json({ error: 'Each CSV batch must have 1 to 1000 rows.' });
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHash)) return res.status(400).json({error: 'Missing CSV batch integrity checksum. Update the frontend.'});
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!String(r.studentId ?? '').trim() || !String(r.moduleName ?? '').trim() || !Number.isInteger(Number(r.sessionSequence)) || Number(r.sessionSequence) < 1)
      return res.status(400).json({ error: `Invalid student/module/session at batch row ${i+1}.` });
  }
  try {
    const commit = db.transaction(() => {
      if (first === true) {
        if (db.prepare('SELECT 1 FROM session_log_imports WHERE id = ?').get(importId)) throw new Error('Import identifier already exists.');
        db.prepare('INSERT INTO session_log_imports (id, filename, uploaded_at, row_count, distinct_students) VALUES (?, ?, ?, 0, 0)')
          .run(importId, String(filename ?? 'attendance.csv').slice(0, 255), new Date().toISOString());
      } else if (!db.prepare('SELECT 1 FROM session_log_imports WHERE id = ?').get(importId)) throw new Error('Import batch not initialized.');
      const insert = db.prepare(`INSERT INTO session_log_rows
        (import_id, student_id, student_name, course_code, course_name, term_name, term_sequence, module_name, module_sequence, session_name, session_sequence, attendance_date, center_name)
        VALUES (@importId, @studentId, @studentName, @courseCode, @courseName, @termName, @termSequence, @moduleName, @moduleSequence, @sessionName, @sessionSequence, @attendanceDate, @centerName)`);
      for (const r of rows) insert.run({
        importId, studentId: String(r.studentId).trim(), studentName: String(r.studentName ?? '').trim(),
        courseCode: String(r.courseCode ?? '').trim(), courseName: String(r.courseName ?? '').trim(),
        termName: String(r.termName ?? '').trim(), termSequence: String(r.termSequence ?? '').trim(),
        moduleName: String(r.moduleName).trim(), moduleSequence: String(r.moduleSequence ?? '').trim(),
        sessionName: String(r.sessionName ?? '').trim(), sessionSequence: Number(r.sessionSequence),
        attendanceDate: String(r.attendanceDate ?? '').trim(), centerName: String(r.centerName ?? '').trim(),
      });
      // Read back the exact inserted batch from SQLite and compare all relevant columns.
      // Never acknowledge a chunk if the stored rows differ from the uploaded rows.
      const savedRows = db.prepare(`SELECT student_id AS studentId, student_name AS studentName,
        course_code AS courseCode, course_name AS courseName, term_name AS termName,
        term_sequence AS termSequence, module_name AS moduleName, module_sequence AS moduleSequence,
        session_name AS sessionName, session_sequence AS sessionSequence,
        attendance_date AS attendanceDate, center_name AS centerName
        FROM session_log_rows WHERE import_id = ? ORDER BY id DESC LIMIT ?`).all(importId, rows.length).reverse();
      const verifiedHash = digestRows(savedRows);
      if (verifiedHash !== expectedHash) throw new Error('CSV rows differ from SQLite records. Batch rolled back.');
      db.prepare('UPDATE session_log_imports SET row_count = row_count + ? WHERE id = ?').run(rows.length, importId);
      if (last === true) db.prepare(`UPDATE session_log_imports SET distinct_students = (SELECT COUNT(DISTINCT student_id) FROM session_log_rows WHERE import_id = ?) WHERE id = ?`).run(importId, importId);
      return verifiedHash;
    });
    const verifiedHash = commit();
    return res.json({ ok: true, importId, importedRows: rows.length, verifiedHash, complete: last === true });
  } catch (error) {
    console.error('CSV batch save failed:', error);
    return res.status(500).json({ error: `CSV batch could not be saved: ${error.message}` });
  }
});

app.post('/api/session-log', (req, res) => {
  const rows = req.body?.rows;
  const filename = String(req.body?.filename ?? 'session-log.csv').trim().slice(0, 255) || 'session-log.csv';
  if (!Array.isArray(rows) || rows.length === 0) return res.status(400).json({ error: 'CSV has no usable session rows.' });
  if (rows.length > 100000) return res.status(413).json({ error: 'CSV is too large (maximum 100,000 session rows).' });
  for (const [i, row] of rows.entries()) {
    if (!String(row.studentId ?? '').trim() || !String(row.moduleName ?? '').trim() || !Number.isInteger(Number(row.sessionSequence)) || Number(row.sessionSequence) < 1) {
      return res.status(400).json({ error: `Invalid StudentID, ModuleName, or SessionSequence in parsed row ${i + 1}.` });
    }
  }
  const importId = `sessions-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const distinctStudents = new Set(rows.map((r) => String(r.studentId).trim())).size;
  const insertBatch = db.transaction((data) => {
    db.prepare('INSERT INTO session_log_imports (id, filename, uploaded_at, row_count, distinct_students) VALUES (?, ?, ?, ?, ?)').run(importId, filename, new Date().toISOString(), data.length, distinctStudents);
    const insert = db.prepare(`INSERT INTO session_log_rows
      (import_id, student_id, student_name, course_code, course_name, term_name, term_sequence, module_name, module_sequence, session_name, session_sequence, attendance_date, center_name)
      VALUES (@importId, @studentId, @studentName, @courseCode, @courseName, @termName, @termSequence, @moduleName, @moduleSequence, @sessionName, @sessionSequence, @attendanceDate, @centerName)`);
    for (const r of data) insert.run({
      importId, studentId: String(r.studentId).trim(), studentName: String(r.studentName ?? '').trim(),
      courseCode: String(r.courseCode ?? '').trim(), courseName: String(r.courseName ?? '').trim(),
      termName: String(r.termName ?? '').trim(), termSequence: String(r.termSequence ?? '').trim(),
      moduleName: String(r.moduleName).trim(), moduleSequence: String(r.moduleSequence ?? '').trim(),
      sessionName: String(r.sessionName ?? '').trim(), sessionSequence: Number(r.sessionSequence),
      attendanceDate: String(r.attendanceDate ?? '').trim(), centerName: String(r.centerName ?? '').trim(),
    });
  });
  try {
    insertBatch(rows);
    const stats = db.prepare(`SELECT COUNT(*) AS rows, COUNT(DISTINCT student_id) AS students,
      (SELECT COUNT(*) FROM (SELECT DISTINCT student_id, student_name, course_code, course_name, term_name, term_sequence, module_name, module_sequence, session_name, session_sequence, attendance_date, center_name FROM session_log_rows)) AS uniqueRows
      FROM session_log_rows`).get();
    return res.json({ ok: true, importId, filename, importedRows: rows.length, distinctStudents, totalRows: stats.rows, totalStudents: stats.students });
  } catch (error) {
    console.error('Could not save session log:', error);
    return res.status(500).json({ error: 'Could not save session-log CSV to the local database.' });
  }
});
app.delete('/api/session-log/imports/:id', (req, res) => {
  const id = String(req.params.id ?? '');
  const remove = db.transaction(() => {
    const batch = db.prepare('SELECT id, filename FROM session_log_imports WHERE id = ?').get(id);
    if (!batch) return null;
    db.prepare('DELETE FROM session_log_rows WHERE import_id = ?').run(id);
    db.prepare('DELETE FROM session_log_imports WHERE id = ?').run(id);
    return batch;
  });
  const deleted = remove();
  if (!deleted) return res.status(404).json({ error: 'Import file nahi mili ya pehle hi delete ho chuki hai.' });
  const stats = db.prepare(`SELECT COUNT(*) AS rows, COUNT(DISTINCT student_id) AS students,
      (SELECT COUNT(*) FROM (SELECT DISTINCT student_id, student_name, course_code, course_name, term_name, term_sequence, module_name, module_sequence, session_name, session_sequence, attendance_date, center_name FROM session_log_rows)) AS uniqueRows
      FROM session_log_rows`).get();
  return res.json({ ok: true, deleted: deleted.filename, ...stats });
});
app.get('/api/session-plans', (_req, res) => {
  const rows = db.prepare('SELECT module_name AS moduleName, total_sessions AS totalSessions FROM session_plan_overrides').all();
  return res.json(Object.fromEntries(rows.map((r) => [r.moduleName, r.totalSessions])));
});
app.put('/api/session-plans', (req, res) => {
  const moduleName = String(req.body?.moduleName ?? '').trim();
  const totalSessions = Number(req.body?.totalSessions);
  if (!moduleName || !Number.isInteger(totalSessions) || totalSessions < 1 || totalSessions > 200) {
    return res.status(400).json({ error: 'Module name and a total session count from 1 to 200 are required.' });
  }
  db.prepare('INSERT INTO session_plan_overrides(module_name, total_sessions) VALUES(?, ?) ON CONFLICT(module_name) DO UPDATE SET total_sessions = excluded.total_sessions').run(moduleName, totalSessions);
  return res.json({ ok: true, moduleName, totalSessions });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'API endpoint not found. Check the server and proxy configuration.' }));
app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  return res.status(err.status || 500).json({ error: err.type === 'entity.too.large' ? 'Request too large. Use the CSV batch import.' : (err.message || 'API server error') });
});
const port = Number(process.env.API_PORT || 4000);
app.listen(port, process.env.API_HOST || '0.0.0.0', () => {
  console.log(`Attendance backend running at http://127.0.0.1:${port}`);
  console.log(`SQLite database: ${resolve(dataDir, 'attendance.sqlite')}`);
});
process.on('SIGINT', () => { db.close(); process.exit(0); });
process.on('SIGTERM', () => { db.close(); process.exit(0); });
