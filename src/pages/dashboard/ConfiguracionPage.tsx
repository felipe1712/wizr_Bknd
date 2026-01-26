import { useState } from "react";
import { Settings, Plus, User, Building2, Briefcase, Filter } from "lucide-react";
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
import { useProject } from "@/contexts/ProjectContext";
import { useEntities, EntityType } from "@/hooks/useEntities";
import { EntityForm } from "@/components/entities/EntityForm";
import { EntityList, Entity } from "@/components/entities/EntityList";

const ConfiguracionPage = () => {
  const { selectedProject } = useProject();
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

  const handleCreateEntity = (data: {
    nombre: string;
    tipo: EntityType;
    descripcion?: string;
    palabras_clave: string[];
    aliases: string[];
  }) => {
    if (!selectedProject) return;
    
    createEntity({
      project_id: selectedProject.id,
      ...data,
    });
    setFormOpen(false);
  };

  const handleUpdateEntity = (data: {
    nombre: string;
    tipo: EntityType;
    descripcion?: string;
    palabras_clave: string[];
    aliases: string[];
  }) => {
    if (!editingEntity) return;
    
    updateEntity({
      id: editingEntity.id,
      ...data,
    });
    setEditingEntity(null);
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
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h2 className="text-xl font-semibold mb-2">Sin proyecto seleccionado</h2>
          <p className="text-muted-foreground">
            Selecciona un proyecto para configurar sus entidades.
          </p>
        </div>
      </div>
    );
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

        <TabsContent value="preferences">
          <Card>
            <CardHeader>
              <CardTitle>Preferencias</CardTitle>
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
          }}
          isLoading={isUpdating}
        />
      )}
    </div>
  );
};

export default ConfiguracionPage;
