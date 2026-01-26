import AnalysisViewPlaceholder from "@/components/dashboard/AnalysisViewPlaceholder";
import { FileBarChart } from "lucide-react";

const ReportesPage = () => (
  <AnalysisViewPlaceholder
    title="Reportes"
    description="Generación y exportación de informes personalizados"
    icon={FileBarChart}
  />
);

export default ReportesPage;
