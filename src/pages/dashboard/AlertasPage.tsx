import AnalysisViewPlaceholder from "@/components/dashboard/AnalysisViewPlaceholder";
import { Bell } from "lucide-react";

const AlertasPage = () => (
  <AnalysisViewPlaceholder
    title="Alertas"
    description="Notificaciones y eventos críticos en tiempo real"
    icon={Bell}
  />
);

export default AlertasPage;
