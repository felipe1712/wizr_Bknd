import AnalysisViewPlaceholder from "@/components/dashboard/AnalysisViewPlaceholder";
import { Settings } from "lucide-react";

const ConfiguracionPage = () => (
  <AnalysisViewPlaceholder
    title="Configuración"
    description="Ajustes de cuenta, preferencias y permisos"
    icon={Settings}
  />
);

export default ConfiguracionPage;
