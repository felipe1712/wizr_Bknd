import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";

const entitySchema = z.object({
  nombre: z.string().min(1, "El nombre es requerido").max(100),
  tipo: z.enum(["persona", "marca", "institucion", "tema", "evento"]),
  descripcion: z.string().max(500).optional(),
});

type EntityFormData = z.infer<typeof entitySchema>;

interface EntityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: EntityFormData & { palabras_clave: string[]; aliases: string[] }) => void;
  initialData?: {
    nombre: string;
    tipo: "persona" | "marca" | "institucion" | "tema" | "evento";
    descripcion?: string;
    palabras_clave: string[];
    aliases: string[];
  };
  isLoading?: boolean;
}

export function EntityForm({ 
  open, 
  onOpenChange, 
  onSubmit, 
  initialData,
  isLoading 
}: EntityFormProps) {
  const [palabrasClave, setPalabrasClave] = useState<string[]>(initialData?.palabras_clave || []);
  const [aliases, setAliases] = useState<string[]>(initialData?.aliases || []);
  const [newKeyword, setNewKeyword] = useState("");
  const [newAlias, setNewAlias] = useState("");

  const form = useForm<EntityFormData>({
    resolver: zodResolver(entitySchema),
    defaultValues: {
      nombre: initialData?.nombre || "",
      tipo: initialData?.tipo || "persona",
      descripcion: initialData?.descripcion || "",
    },
  });

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !palabrasClave.includes(newKeyword.trim())) {
      setPalabrasClave([...palabrasClave, newKeyword.trim()]);
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    setPalabrasClave(palabrasClave.filter((k) => k !== keyword));
  };

  const handleAddAlias = () => {
    if (newAlias.trim() && !aliases.includes(newAlias.trim())) {
      setAliases([...aliases, newAlias.trim()]);
      setNewAlias("");
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleSubmit = (data: EntityFormData) => {
    onSubmit({
      ...data,
      palabras_clave: palabrasClave,
      aliases: aliases,
    });
  };

  const tipoLabels = {
    persona: "Persona",
    marca: "Marca",
    institucion: "Institución",
    tema: "Tema / Asunto",
    evento: "Evento",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Editar Entidad" : "Nueva Entidad"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              placeholder="Nombre de la entidad"
              {...form.register("nombre")}
            />
            {form.formState.errors.nombre && (
              <p className="text-sm text-destructive">
                {form.formState.errors.nombre.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={form.watch("tipo")}
              onValueChange={(value: "persona" | "marca" | "institucion" | "tema" | "evento") =>
                form.setValue("tipo", value)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un tipo" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(tipoLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descripcion">Descripción</Label>
            <Textarea
              id="descripcion"
              placeholder="Descripción opcional de la entidad"
              {...form.register("descripcion")}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Palabras Clave</Label>
            <div className="flex gap-2">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Añadir palabra clave"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddKeyword();
                  }
                }}
              />
              <Button type="button" size="icon" onClick={handleAddKeyword}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {palabrasClave.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {palabrasClave.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(keyword)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Aliases / Nombres Alternativos</Label>
            <div className="flex gap-2">
              <Input
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                placeholder="Añadir alias"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddAlias();
                  }
                }}
              />
              <Button type="button" size="icon" onClick={handleAddAlias}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {aliases.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {aliases.map((alias) => (
                  <Badge key={alias} variant="outline" className="gap-1">
                    {alias}
                    <button
                      type="button"
                      onClick={() => handleRemoveAlias(alias)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Guardando..." : initialData ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
