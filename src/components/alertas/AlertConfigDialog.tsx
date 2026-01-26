import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import type { AlertType, AlertConfig } from "@/hooks/useAlerts";
import type { Entity } from "@/hooks/useEntities";

const alertSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  description: z.string().max(500).optional(),
  alert_type: z.enum(["sentiment_negative", "mention_spike", "keyword_match"]),
  threshold_percent: z.number().min(1).max(100).optional().nullable(),
  keywords: z.array(z.string()).optional(),
  entity_ids: z.array(z.string()).optional(),
});

type AlertFormData = z.infer<typeof alertSchema>;

interface AlertConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: AlertFormData) => void;
  entities: Entity[];
  editingConfig?: AlertConfig | null;
  isSubmitting?: boolean;
}

const alertTypeLabels: Record<AlertType, string> = {
  sentiment_negative: "Sentimiento Negativo",
  mention_spike: "Pico de Menciones",
  keyword_match: "Palabra Clave",
};

const alertTypeDescriptions: Record<AlertType, string> = {
  sentiment_negative: "Alerta cuando el % de menciones negativas supera el umbral",
  mention_spike: "Alerta cuando las menciones aumentan repentinamente",
  keyword_match: "Alerta cuando se detectan palabras clave específicas",
};

export function AlertConfigDialog({
  open,
  onOpenChange,
  onSubmit,
  entities,
  editingConfig,
  isSubmitting,
}: AlertConfigDialogProps) {
  const [keywordInput, setKeywordInput] = useState("");

  const form = useForm<AlertFormData>({
    resolver: zodResolver(alertSchema),
    defaultValues: editingConfig
      ? {
          name: editingConfig.name,
          description: editingConfig.description || "",
          alert_type: editingConfig.alert_type,
          threshold_percent: editingConfig.threshold_percent,
          keywords: editingConfig.keywords || [],
          entity_ids: editingConfig.entity_ids || [],
        }
      : {
          name: "",
          description: "",
          alert_type: "sentiment_negative",
          threshold_percent: 30,
          keywords: [],
          entity_ids: [],
        },
  });

  const watchAlertType = form.watch("alert_type");
  const watchKeywords = form.watch("keywords") || [];

  const handleAddKeyword = () => {
    const trimmed = keywordInput.trim();
    if (trimmed && !watchKeywords.includes(trimmed)) {
      form.setValue("keywords", [...watchKeywords, trimmed]);
      setKeywordInput("");
    }
  };

  const handleRemoveKeyword = (keyword: string) => {
    form.setValue(
      "keywords",
      watchKeywords.filter((k) => k !== keyword)
    );
  };

  const handleSubmit = (data: AlertFormData) => {
    onSubmit(data);
    form.reset();
    setKeywordInput("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingConfig ? "Editar Alerta" : "Nueva Alerta"}
          </DialogTitle>
          <DialogDescription>
            Configura las condiciones que activarán esta alerta
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Alerta de crisis" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="alert_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Alerta</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-popover">
                      {Object.entries(alertTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {alertTypeDescriptions[field.value as AlertType]}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(watchAlertType === "sentiment_negative" ||
              watchAlertType === "mention_spike") && (
              <FormField
                control={form.control}
                name="threshold_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {watchAlertType === "sentiment_negative"
                        ? "Umbral de Negatividad (%)"
                        : "Umbral de Incremento (%)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={100}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? Number(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      {watchAlertType === "sentiment_negative"
                        ? "Alertar cuando más del X% de menciones sean negativas"
                        : "Alertar cuando las menciones aumenten más del X%"}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {watchAlertType === "keyword_match" && (
              <FormItem>
                <FormLabel>Palabras Clave</FormLabel>
                <div className="flex gap-2">
                  <Input
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    placeholder="Añadir palabra clave"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                  />
                  <Button type="button" variant="outline" onClick={handleAddKeyword}>
                    Añadir
                  </Button>
                </div>
                {watchKeywords.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {watchKeywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary">
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
                <FormDescription>
                  Alertar cuando se detecten estas palabras en nuevas menciones
                </FormDescription>
              </FormItem>
            )}

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Notas adicionales sobre esta alerta..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Guardando..."
                  : editingConfig
                  ? "Guardar Cambios"
                  : "Crear Alerta"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
