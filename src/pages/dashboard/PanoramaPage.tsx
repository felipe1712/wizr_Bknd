import AnalysisViewPlaceholder from "@/components/dashboard/AnalysisViewPlaceholder";
import { LayoutDashboard } from "lucide-react";

const PanoramaPage = () => (
  <AnalysisViewPlaceholder
    title="Panorama"
    description="Vista consolidada de todas las fuentes y métricas clave"
    icon={LayoutDashboard}
  />
);

export default PanoramaPage;
