import { PageHeader, LocalNotice } from "@/components/shared";
import { CsvImportWizard } from "@/components/CsvImportWizard";

export function CsvImportPage() {
  return (
    <div>
      <PageHeader title="CSV Import" description="Upload a file, map its columns, review validation, then confirm. Column names are never assumed." />
      <LocalNotice>CSV files are parsed in your browser. Confirmed import records and attendance marks are saved to the local database on this computer.</LocalNotice>
      <CsvImportWizard />
    </div>
  );
}
