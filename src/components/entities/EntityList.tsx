import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Pencil, Trash2, User, Building2, Briefcase, Tag, Calendar } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export interface Entity {
  id: string;
  nombre: string;
  tipo: "persona" | "marca" | "institucion" | "tema" | "evento";
  descripcion: string | null;
  palabras_clave: string[];
  aliases: string[];
  activo: boolean;
  created_at: string;
}

interface EntityListProps {
  entities: Entity[];
  onEdit: (entity: Entity) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

const tipoConfig = {
  persona: {
    label: "Persona",
    icon: User,
    variant: "default" as const,
  },
  marca: {
    label: "Marca",
    icon: Briefcase,
    variant: "secondary" as const,
  },
  institucion: {
    label: "Institución",
    icon: Building2,
    variant: "outline" as const,
  },
  tema: {
    label: "Tema",
    icon: Tag,
    variant: "secondary" as const,
  },
  evento: {
    label: "Evento",
    icon: Calendar,
    variant: "outline" as const,
  },
};

export function EntityList({ entities, onEdit, onDelete, isDeleting }: EntityListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [entityToDelete, setEntityToDelete] = useState<Entity | null>(null);

  const handleDeleteClick = (entity: Entity) => {
    setEntityToDelete(entity);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (entityToDelete) {
      onDelete(entityToDelete.id);
      setDeleteDialogOpen(false);
      setEntityToDelete(null);
    }
  };

  if (entities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No hay entidades configuradas para este proyecto.</p>
        <p className="text-sm">Crea una nueva entidad para comenzar el monitoreo.</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="hidden md:table-cell">Palabras Clave</TableHead>
            <TableHead className="hidden lg:table-cell">Creado</TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entities.map((entity) => {
            const config = tipoConfig[entity.tipo];
            const Icon = config.icon;

            return (
              <TableRow key={entity.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{entity.nombre}</p>
                    {entity.descripcion && (
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {entity.descripcion}
                      </p>
                    )}
                    {entity.aliases.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        También: {entity.aliases.slice(0, 2).join(", ")}
                        {entity.aliases.length > 2 && ` +${entity.aliases.length - 2}`}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={config.variant} className="gap-1">
                    <Icon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {entity.palabras_clave.slice(0, 3).map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                    {entity.palabras_clave.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{entity.palabras_clave.length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                  {formatDistanceToNow(new Date(entity.created_at), {
                    addSuffix: true,
                    locale: es,
                  })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(entity)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(entity)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entidad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente "{entityToDelete?.nombre}" y todos sus datos asociados.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
