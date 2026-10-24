# Strict curriculum-based student session tracking

Source of truth: `src/lib/academicCatalog.ts`, containing the 7144 and 7062 examination planning rows supplied by the user.

On Student Attendance Sessions, enter a StudentID and select the intended curriculum/course/semester/skill. The report includes only CSV rows where StudentID matches the searched ID, CourseCode contains the selected curriculum code, ModuleName equals the exact catalog skill name after case/spacing/punctuation normalization, TermSequence equals the selected catalog semester and SessionSequence is within 1..planned session total.

`ModuleSequence` is deliberately NOT equated to M1/M2: CSV portal module sequence indexes are different from planning sheet module codes. `CourseName` in source CSV can be the whole ADSE program rather than the planning sheet CPISM/DISM sub-course; catalog course and semester determine the grouping. Outside-catalog CSV skill records are excluded from the report.

Repeated CSV rows for the same session are counted once. The page shows recorded session numbers, numbers not found and coverage. **The source CSV has no attendance Present/Absent field. Thus a record is NOT proven present and a missing record is NOT proven absent.** Confirm actual attendance using a source with explicit marked status if needed.

Upload supports multiple files in one selection and 500-row batches, with text and percentage progress. Large-scale load tests were not run in this environment. Open the project with `START-LOCAL.bat`; follow `MULTI-PC-AND-IMPORT-GUIDE.md` for shared access.
