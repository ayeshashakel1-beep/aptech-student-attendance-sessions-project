// Shared application state backed by the local Express + SQLite API.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type {
  AttendanceRecord, CalculationRules, ClassSession, Course, Curriculum,
  ImportRecord, Module, Semester, Student,
} from "./types";
import { ACADEMIC_CATALOG } from "./academicCatalog";

interface AppState {
  curricula: Curriculum[];
  courses: Course[];
  semesters: Semester[];
  modules: Module[];
  students: Student[];
  sessions: ClassSession[];
  records: AttendanceRecord[];
  imports: ImportRecord[];
  rules: CalculationRules;
}

type Setter<K extends keyof AppState> = (fn: (prev: AppState[K]) => AppState[K]) => void;
type Store = AppState & { [K in keyof AppState as `set${Capitalize<K & string>}`]: Setter<K> } & {
  backendReady: boolean;
  backendError: string | null;
};

const initialState: AppState = {
  curricula: [], courses: [], semesters: [], modules: [], students: [], sessions: [], records: [], imports: [],
  rules: { late: "exclude", excused: "exclude", lowAttendanceThreshold: 75 },
};
const StoreCtx = createContext<Store | null>(null);
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function buildSuppliedStructure() {
  const curriculumCodes = [...new Set(ACADEMIC_CATALOG.map((m) => m.curriculumCode))];
  const curricula: Curriculum[] = curriculumCodes.map((code) => ({ id: `curriculum-${code}`, name: `Curriculum ${code}` }));
  const courseId = (code: string, courseName: string) => `course-${code}-${courseName.replace(/\s+/g, "-")}`;
  const semesterId = (code: string, courseName: string, semester: number) => `semester-${code}-${courseName.replace(/\s+/g, "-")}-${semester}`;
  const courseKeys = [...new Set(ACADEMIC_CATALOG.map((m) => `${m.curriculumCode}|${m.courseName}`))];
  const courses: Course[] = courseKeys.map((key) => {
    const [code, name] = key.split("|");
    return { id: courseId(code!, name!), name: name!, curriculumId: `curriculum-${code}` };
  });
  const semesterKeys = [...new Set(ACADEMIC_CATALOG.map((m) => `${m.curriculumCode}|${m.courseName}|${m.semester}`))];
  const semesters: Semester[] = semesterKeys.map((key) => {
    const [code, name, semester] = key.split("|");
    return { id: semesterId(code!, name!, Number(semester)), name: `SEMESTER ${String(semester).padStart(2, "0")}`, courseId: courseId(code!, name!) };
  });
  const modules: Module[] = ACADEMIC_CATALOG.map((m, i) => ({
    id: `module-${m.curriculumCode}-${m.semester}-${i + 1}`,
    name: m.name,
    semesterId: semesterId(m.curriculumCode, m.courseName, m.semester),
  }));
  const sessions: ClassSession[] = ACADEMIC_CATALOG.flatMap((m, i) => Array.from({ length: m.totalSessions }, (_, n) => ({
    id: `session-${m.curriculumCode}-${m.semester}-${i + 1}-${n + 1}`,
    moduleId: modules[i]!.id,
    number: n + 1,
    title: "",
    date: "",
    status: "scheduled" as const,
  })));
  return { curricula, courses, semesters, modules, sessions };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const stateRef = useRef<AppState>(initialState);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());
  const [backendReady, setBackendReady] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/state")
      .then(async (response) => {
        if (!response.ok) throw new Error(`Backend returned HTTP ${response.status}`);
        return response.json() as Promise<AppState>;
      })
      .then(async (loaded) => {
        if (!active) return;
        let complete = { ...initialState, ...loaded };
        const structureIsEmpty = complete.curricula.length === 0 && complete.courses.length === 0 && complete.semesters.length === 0 && complete.modules.length === 0;
        if (structureIsEmpty) {
          complete = { ...complete, ...buildSuppliedStructure() };
        }
        stateRef.current = complete;
        setState(complete);
        if (structureIsEmpty) {
          // Seed the supplied curriculum/module plan once, on first launch only.
          // Existing non-empty structure is never overwritten.
          const response = await fetch("/api/state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(complete),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({})) as { error?: string };
            throw new Error(body.error ?? `Could not save supplied structure (HTTP ${response.status})`);
          }
        }
        setBackendReady(true);
        setBackendError(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = error instanceof Error ? error.message : "Could not connect to local backend.";
        setBackendError(message);
        setBackendReady(true);
      });
    return () => { active = false; };
  }, []);

  const persist = useCallback((snapshot: AppState) => {
    writeQueue.current = writeQueue.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(snapshot),
      });
      const body = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Save failed (HTTP ${response.status})`);
      setBackendError(null);
    }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unknown database error";
      setBackendError(message);
      toast.error(`Data could not be saved: ${message}`);
      console.error("Local database save failed:", error);
    });
  }, []);

  const makeSetter = useCallback(<K extends keyof AppState>(key: K): Setter<K> => (update) => {
    if (!backendReady) {
      toast.error("Please wait while the local database connection is checked.");
      return;
    }
    const nextValue = update(stateRef.current[key]);
    const nextState = { ...stateRef.current, [key]: nextValue } as AppState;
    stateRef.current = nextState;
    setState(nextState);
    persist(nextState);
  }, [backendReady, persist]);

  const value = useMemo<Store>(() => ({
    ...state,
    setCurricula: makeSetter("curricula"),
    setCourses: makeSetter("courses"),
    setSemesters: makeSetter("semesters"),
    setModules: makeSetter("modules"),
    setStudents: makeSetter("students"),
    setSessions: makeSetter("sessions"),
    setRecords: makeSetter("records"),
    setImports: makeSetter("imports"),
    setRules: makeSetter("rules"),
    backendReady,
    backendError,
  }), [state, makeSetter, backendReady, backendError]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

export function useStore() {
  const store = useContext(StoreCtx);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}

export function useStructureNames() {
  const { curricula, courses, semesters, modules } = useStore();
  const n = (list: { id: string; name: string }[], id: string) => list.find((x) => x.id === id)?.name ?? "—";
  return {
    curriculum: (id: string) => n(curricula, id),
    course: (id: string) => n(courses, id),
    semester: (id: string) => n(semesters, id),
    module: (id: string) => n(modules, id),
  };
}
