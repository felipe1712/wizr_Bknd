import { useState } from "react";
import { useRankings, useRanking } from "@/hooks/useRankings";
import { RankingsList } from "@/components/rankings/RankingsList";
import { RankingDetail } from "@/components/rankings/RankingDetail";
import { Trophy, Loader2 } from "lucide-react";

const RankingsPage = () => {
  const [selectedRankingId, setSelectedRankingId] = useState<string | null>(null);

  const { data: rankings = [], isLoading: loadingRankings } = useRankings();
  const { data: selectedRanking, isLoading: loadingRanking } = useRanking(selectedRankingId ?? undefined);

  // Show ranking detail view
  if (selectedRankingId) {
    if (loadingRanking) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!selectedRanking) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Ranking no encontrado</p>
          </div>
        </div>
      );
    }

    return (
      <RankingDetail 
        ranking={selectedRanking} 
        onBack={() => setSelectedRankingId(null)} 
      />
    );
  }

  // Show rankings list view
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="h-8 w-8 text-amber-500" />
          Rankings
        </h1>
        <p className="text-muted-foreground">
          Benchmarking competitivo independiente de tus proyectos de social listening
        </p>
      </div>

      {/* Rankings List */}
      <RankingsList 
        rankings={rankings}
        isLoading={loadingRankings}
        onSelectRanking={setSelectedRankingId}
      />
    </div>
  );
};

export default RankingsPage;
