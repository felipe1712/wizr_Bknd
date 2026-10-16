import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScheduledSearchConfig } from "@/components/fuentes/ScheduledSearchConfig";
import { AutoSaveConfigPanel } from "@/components/fuentes/AutoSaveConfigPanel";
import { ManualUrlIngestCard } from "@/components/fuentes/ManualUrlIngestCard";
import { SocialDateEnrichmentCard } from "@/components/fuentes/SocialDateEnrichmentCard";

/**
 * Panel lateral con todo lo operativo de automatización, fuera de las pestañas
 * principales para no saturar la captura.
 */
export function AutomationPanel({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings2 className="h-4 w-4" />
          <span className="hidden sm:inline">Automatización</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Automatización de captura</SheetTitle>
          <SheetDescription>
            Búsquedas programadas, autoguardado, ingesta manual de URLs y enriquecimiento de fechas.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-6 pb-10">
          <ScheduledSearchConfig projectId={projectId} />
          <AutoSaveConfigPanel projectId={projectId} />
          <ManualUrlIngestCard projectId={projectId} />
          <SocialDateEnrichmentCard projectId={projectId} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default AutomationPanel;
