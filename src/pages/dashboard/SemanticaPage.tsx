import AnalysisViewPlaceholder from "@/components/dashboard/AnalysisViewPlaceholder";
import { MessageSquareText } from "lucide-react";

const SemanticaPage = () => (
  <AnalysisViewPlaceholder
    title="Semántica"
    description="Análisis de sentimiento, temas y contexto de las conversaciones"
    icon={MessageSquareText}
  />
);

export default SemanticaPage;
