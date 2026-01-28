import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2, Trophy } from "lucide-react";
import { useCreateRanking } from "@/hooks/useRankings";

interface CreateRankingDialogProps {
  onSuccess?: (rankingId: string) => void;
}

export function CreateRankingDialog({ onSuccess }: CreateRankingDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const createRanking = useCreateRanking();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = await createRanking.mutateAsync({ name, description });
    
    setName("");
    setDescription("");
    setOpen(false);
    onSuccess?.(result.id);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2">
          <Plus className="h-5 w-5" />
          Crear Nuevo Ranking
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-background sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <DialogTitle>Crear Ranking</DialogTitle>
                <DialogDescription>
                  Configura un nuevo ranking competitivo
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre del ranking</Label>
              <Input
                id="name"
                placeholder="Ej: Bancos Mexicanos - Facebook"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Describe el propósito de este ranking..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!name.trim() || createRanking.isPending}>
              {createRanking.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear Ranking"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
