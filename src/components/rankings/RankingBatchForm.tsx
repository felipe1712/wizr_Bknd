import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
import { FKNetwork, getNetworkLabel, useAddFKProfilesToRanking } from "@/hooks/useFanpageKarma";

const NETWORKS: FKNetwork[] = ["facebook", "instagram", "youtube", "linkedin", "tiktok", "twitter", "threads"];

interface RankingBatchFormProps {
  rankingId: string;
  onSuccess?: () => void;
}

export function RankingBatchForm({ rankingId, onSuccess }: RankingBatchFormProps) {
  const [network, setNetwork] = useState<FKNetwork>("facebook");
  const [profiles, setProfiles] = useState("");

  const addProfiles = useAddFKProfilesToRanking();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await addProfiles.mutateAsync({
      rankingId,
      batch: { network, profiles },
    });

    setProfiles("");
    onSuccess?.();
  };

  const profileCount = profiles
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlusCircle className="h-5 w-5" />
          Agregar Perfiles
        </CardTitle>
        <CardDescription>
          Pega los usernames de Fanpage Karma (uno por línea)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="network">Red Social</Label>
            <Select value={network} onValueChange={(v) => setNetwork(v as FKNetwork)}>
              <SelectTrigger id="network" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {NETWORKS.map((n) => (
                  <SelectItem key={n} value={n}>
                    {getNetworkLabel(n)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="profiles">
              Perfiles ({profileCount} detectados)
            </Label>
            <Textarea
              id="profiles"
              placeholder={`actinver\nbanamex\nbanorte\nbbva.mexico\nsantandermx`}
              value={profiles}
              onChange={(e) => setProfiles(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Ingresa el username o Page ID tal como aparece en Fanpage Karma, sin @
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={profileCount === 0 || addProfiles.isPending}
          >
            {addProfiles.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Agregando...
              </>
            ) : (
              <>
                <PlusCircle className="mr-2 h-4 w-4" />
                Agregar {profileCount} Perfiles
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
