import { useState } from "react";
import { useClients, useClient } from "@/hooks/useClients";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDetail } from "@/components/clients/ClientDetail";
import { Building2, Loader2 } from "lucide-react";

const PerformancePage = () => {
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const { data: clients = [], isLoading } = useClients();
  const { data: selectedClient, isLoading: loadingClient } = useClient(selectedClientId ?? undefined);

  if (selectedClientId) {
    if (loadingClient) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!selectedClient) {
      return (
        <div className="flex items-center justify-center h-[60vh] text-center">
          <div>
            <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Cliente no encontrado</p>
          </div>
        </div>
      );
    }
    return <ClientDetail client={selectedClient} onBack={() => setSelectedClientId(null)} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-8 w-8 text-primary" />
          Performance
        </h1>
        <p className="text-muted-foreground">
          Análisis de desempeño en redes sociales por cliente. Compara la marca vs su competencia.
        </p>
      </div>
      <ClientList clients={clients} isLoading={isLoading} onSelect={setSelectedClientId} />
    </div>
  );
};

export default PerformancePage;
