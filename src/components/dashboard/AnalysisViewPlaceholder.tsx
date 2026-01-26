import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AnalysisViewPlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
}

const AnalysisViewPlaceholder = ({
  title,
  description,
  icon: Icon,
}: AnalysisViewPlaceholderProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="text-muted-foreground">{description}</p>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-primary/10 p-4">
            <Icon className="h-10 w-10 text-primary" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Vista en desarrollo</h3>
          <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
            Esta vista de análisis estará disponible próximamente. Aquí podrás
            explorar insights de {title.toLowerCase()} de tus proyectos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalysisViewPlaceholder;
