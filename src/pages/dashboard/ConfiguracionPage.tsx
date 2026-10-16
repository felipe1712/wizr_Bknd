import { NoProjectState } from "@/components/layout/NoProjectState";
import { useState, useEffect } from "react";
import { Settings, Plus, User, Building2, Briefcase, Filter, Save, Target, Trash2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useProject } from "@/contexts/ProjectContext";
import { useEntities, EntityType } from "@/hooks/useEntities";
import { EntityForm } from "@/components/entities/EntityForm";
import { EntityList, Entity } from "@/components/entities/EntityList";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

const ConfiguracionPage = () => {
  const { selectedProject, refreshProjects } = useProject();
  const { toast } = useToast();
  const navigate = useNavigate();
  const {
    entities,
    isLoading,
    createEntity,
    updateEntity,
    deleteEntity,
    isCreating,
    isUpdating,
    isDeleting,
  } = useEntities(selectedProject?.id);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [filterType, setFilterType] = useState<"all" | EntityType>("all");
  const [strategicContext, setStrategicContext] = useState(selectedProject?.contexto_estrategico || "");
  const [isSavingContext, setIsSavingContext] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [isDeletingProject, setIsDeletingProject] = useState(false);

  useEffect(() => {
    setStrategicContext(selectedProject?.contexto_estrategico || "");
  }, [selectedProject?.id]);

  const handleSaveStrategicContext = async () => {
    if (!selectedProject) return;
    setIsSavingContext(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ contexto_estrategico: strategicContext.trim() || null })
        .eq("id", selectedProject.id);
      if (error) throw error;
      await refreshProjects();
      toast({ title: "Guardado", description: "Contexto estratégico actualizado" });
    } catch {
      toast({ title: "Error", description: "No se pudo guardar", variant: "destructive" });
    } finally {
      setIsSavingContext(false);
    }
  };
  const handleDeleteProject = async () => {
    if (!selectedProject || deleteConfirmName !== selectedProject.nombre) return;
    setIsDeletingProject(true);
    try {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", selectedProject.id);
      if (error) throw error;
      toast({ title: "Proyecto eliminado", description: `"${selectedProject.nombre}" ha sido eliminado permanentemente.` });
      await refreshProjects();
      navigate("/dashboard/proyectos");
    } catch {
      toast({ title: "Error", description: "No se pudo eliminar el proyecto", variant: "destructive" });
    } finally {
      setIsDeletingProject(false);
      setDeleteConfirmName("");
    }
  };

  const handleCreateEntity = (data: {
    nombre: string;
    tipo: EntityType;
    descripcion?: string;
    palabras_clave: string[];
    aliases: string[];
    platform_keywords: Record<string, string[]>;
  }) => {
    if (!selectedProject) return;
    
    createEntity({
      project_id: selectedProject.id,
      ...data,
    }, {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleUpdateEntity = (data: {
    nombre: string;
    tipo: EntityType;
    descripcion?: string;
    palabras_clave: string[];
    aliases: string[];
    platform_keywords: Record<string, string[]>;
  }) => {
    if (!editingEntity) return;
    
    updateEntity({
      id: editingEntity.id,
      ...data,
    }, {
      onSuccess: () => setEditingEntity(null),
    });
  };

  const handleEditClick = (entity: Entity) => {
    setEditingEntity(entity);
  };

  const handleDeleteEntity = (id: string) => {
    deleteEntity(id);
  };

  const filteredEntities = entities.filter((entity) => {
    if (filterType === "all") return true;
    return entity.tipo === filterType;
  });

  const entityCounts = {
    all: entities.length,
    persona: entities.filter((e) => e.tipo === "persona").length,
    marca: entities.filter((e) => e.tipo === "marca").length,
    institucion: entities.filter((e) => e.tipo === "institucion").length,
  };

  if (!selectedProject) {
    return <NoProjectState action="configurar entidades y palabras clave" />;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="h-6 w-6" />
            Configuración
          </h1>
          <p className="text-muted-foreground">
            Gestiona las entidades y configuración de {selectedProject.nombre}
          </p>
        </div>
      </div>

      <Tabs defaultValue="entities" className="space-y-4">
        <TabsList>
          <TabsTrigger value="entities">Entidades</TabsTrigger>
          <TabsTrigger value="preferences">Preferencias</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-4">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{entityCounts.all}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{entityCounts.persona}</p>
                    <p className="text-xs text-muted-foreground">Personas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-emerald-200 bg-emerald-50/50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <Briefcase className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{entityCounts.marca}</p>
                    <p className="text-xs text-muted-foreground">Marcas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{entityCounts.institucion}</p>
                    <p className="text-xs text-muted-foreground">Instituciones</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Entity Management */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle>Entidades a Monitorear</CardTitle>
                  <CardDescription>
                    Personas, marcas e instituciones que serán monitoreadas en este proyecto
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={filterType}
                    onValueChange={(value) => setFilterType(value as typeof filterType)}
                  >
                    <SelectTrigger className="w-[150px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos ({entityCounts.all})</SelectItem>
                      <SelectItem value="persona">Personas ({entityCounts.persona})</SelectItem>
                      <SelectItem value="marca">Marcas ({entityCounts.marca})</SelectItem>
                      <SelectItem value="institucion">Instituciones ({entityCounts.institucion})</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={() => setFormOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Entidad
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <EntityList
                  entities={filteredEntities}
                  onEdit={handleEditClick}
                  onDelete={handleDeleteEntity}
                  isDeleting={isDeleting}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preferences" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Contexto Estratégico
              </CardTitle>
              <CardDescription>
                Define el contexto estratégico del proyecto. Esta información se usará automáticamente 
                en todos los reportes para orientar el análisis de IA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={strategicContext}
                onChange={(e) => setStrategicContext(e.target.value)}
                placeholder="Ej: Actinver está en un litigio activo con Rafael Zaga Tawil por fraude millonario al Infonavit. Todo el monitoreo debe evaluarse desde el impacto reputacional para Actinver y su posición en el caso legal."
                className="min-h-[120px]"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground max-w-md">
                  Este contexto se incluye automáticamente en cada reporte generado. 
                  Además, al generar un reporte puedes agregar un enfoque específico adicional.
                </p>
                <Button onClick={handleSaveStrategicContext} disabled={isSavingContext} size="sm">
                  <Save className="h-4 w-4 mr-2" />
                  {isSavingContext ? "Guardando..." : "Guardar"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferencias Generales</CardTitle>
              <CardDescription>
                Configuración general del proyecto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Próximamente: Configuración de alertas, notificaciones y más.
              </p>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Zona de Peligro
              </CardTitle>
              <CardDescription>
                Acciones irreversibles para este proyecto
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Eliminar proyecto</p>
                  <p className="text-sm text-muted-foreground">
                    Se eliminarán permanentemente todas las menciones, entidades, alertas y datos asociados.
                  </p>
                </div>
                <AlertDialog onOpenChange={() => setDeleteConfirmName("")}>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar proyecto
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        ¿Eliminar "{selectedProject.nombre}"?
                      </AlertDialogTitle>
                      <AlertDialogDescription className="space-y-3">
                        <span className="block">
                          Esta acción es <strong>permanente e irreversible</strong>. Se eliminarán:
                        </span>
                        <ul className="list-disc list-inside text-sm space-y-1">
                          <li>Todas las menciones capturadas</li>
                          <li>Todas las entidades configuradas</li>
                          <li>Alertas, fichas temáticas y reportes</li>
                          <li>Búsquedas programadas y configuración</li>
                        </ul>
                        <span className="block mt-3">
                          Escribe <strong>{selectedProject.nombre}</strong> para confirmar:
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <Input
                      value={deleteConfirmName}
                      onChange={(e) => setDeleteConfirmName(e.target.value)}
                      placeholder={selectedProject.nombre}
                      className="mt-2"
                    />
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteProject}
                        disabled={deleteConfirmName !== selectedProject.nombre || isDeletingProject}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeletingProject ? "Eliminando..." : "Eliminar permanentemente"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Entity Dialog */}
      <EntityForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreateEntity}
        isLoading={isCreating}
      />

      {/* Edit Entity Dialog */}
      {editingEntity && (
        <EntityForm
          open={!!editingEntity}
          onOpenChange={(open) => !open && setEditingEntity(null)}
          onSubmit={handleUpdateEntity}
          initialData={{
            nombre: editingEntity.nombre,
            tipo: editingEntity.tipo,
            descripcion: editingEntity.descripcion || undefined,
            palabras_clave: editingEntity.palabras_clave,
            aliases: editingEntity.aliases,
            platform_keywords: editingEntity.platform_keywords || {},
          }}
          isLoading={isUpdating}
        />
      )}
    </div>
  );
};

export default ConfiguracionPage;
