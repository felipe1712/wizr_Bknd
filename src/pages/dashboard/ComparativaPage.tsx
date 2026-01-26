import AnalysisViewPlaceholder from "@/components/dashboard/AnalysisViewPlaceholder";
import { GitCompare } from "lucide-react";

const ComparativaPage = () => (
  <AnalysisViewPlaceholder
    title="Comparativa"
    description="Benchmark contra competidores y análisis de share of voice"
    icon={GitCompare}
  />
);

export default ComparativaPage;
