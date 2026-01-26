import AnalysisViewPlaceholder from "@/components/dashboard/AnalysisViewPlaceholder";
import { TrendingUp } from "lucide-react";

const TendenciasPage = () => (
  <AnalysisViewPlaceholder
    title="Tendencias"
    description="Evolución temporal y patrones emergentes"
    icon={TrendingUp}
  />
);

export default TendenciasPage;
