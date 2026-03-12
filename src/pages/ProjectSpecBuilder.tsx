import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { ArrowLeft, ArrowRight, Check, FileText, Loader2 } from "lucide-react";
import wizrLogo from "@/assets/wizr-logo.png";

import StepBasicInfo from "@/components/project-spec/StepBasicInfo";
import StepTypeObjective from "@/components/project-spec/StepTypeObjective";
import StepAudienceSensitivity from "@/components/project-spec/StepAudienceSensitivity";
import StepScope from "@/components/project-spec/StepScope";
import StepReview from "@/components/project-spec/StepReview";

const projectSchema = z.object({
  nombre: z.string().min(3, "El nombre debe tener al menos 3 caracteres").max(100, "Máximo 100 caracteres"),
  descripcion: z.string().max(500, "Máximo 500 caracteres").optional(),
  tipo: z.enum(["monitoreo", "investigacion", "crisis", "benchmark"], {
    required_error: "Selecciona un tipo de proyecto",
  }),
  objetivo: z.string().min(10, "El objetivo debe tener al menos 10 caracteres").max(500, "Máximo 500 caracteres"),
  audiencia: z.string().min(5, "La audiencia debe tener al menos 5 caracteres").max(300, "Máximo 300 caracteres"),
  sensibilidad: z.enum(["bajo", "medio", "alto", "critico"], {
    required_error: "Selecciona un nivel de sensibilidad",
  }),
  alcance_temporal: z.enum(["tiempo_real", "diario", "semanal", "mensual", "historico"], {
    required_error: "Selecciona un alcance temporal",
  }),
  alcance_geografico: z.array(z.string()).min(1, "Selecciona al menos una región"),
});

export type ProjectFormData = z.infer<typeof projectSchema>;

const STEPS = [
  { id: 1, title: "Información Básica", description: "Nombre y descripción del proyecto" },
  { id: 2, title: "Tipo y Objetivo", description: "Define el propósito del análisis" },
  { id: 3, title: "Audiencia y Sensibilidad", description: "¿Para quién y qué tan crítico?" },
  { id: 4, title: "Alcance", description: "Temporal y geográfico" },
  { id: 5, title: "Revisión", description: "Confirma los detalles" },
];

const ProjectSpecBuilder = () => {
  const { id: projectId } = useParams<{ id: string }>();
  const isEditMode = Boolean(projectId);
  
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditMode);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const form = useForm<ProjectFormData>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      tipo: undefined,
      objetivo: "",
      audiencia: "",
      sensibilidad: undefined,
      alcance_temporal: undefined,
      alcance_geografico: [],
    },
    mode: "onChange",
  });

  // Load project data in edit mode
  useEffect(() => {
    if (isEditMode && projectId) {
      loadProject(projectId);
    }
  }, [projectId, isEditMode]);

  const loadProject = async (id: string) => {
    setIsLoading(true);
    try {
      const { data } = await api.get(`/projects/${id}`);
      
      if (!data) {
        toast({
          title: "Proyecto no encontrado",
          description: "El proyecto que intentas editar no existe",
          variant: "destructive",
        });
        navigate("/dashboard/proyectos");
        return;
      }

      // Populate form with existing data
      form.reset({
        nombre: data.nombre,
        descripcion: data.descripcion || "",
        tipo: data.tipo as ProjectFormData["tipo"],
        objetivo: data.objetivo,
        audiencia: data.audiencia,
        sensibilidad: data.sensibilidad as ProjectFormData["sensibilidad"],
        alcance_temporal: data.alcance_temporal as ProjectFormData["alcance_temporal"],
        alcance_geografico: data.alcance_geografico || [],
      });
    } catch (error: any) {
      toast({
        title: "Error al cargar proyecto",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
      navigate("/dashboard/proyectos");
    } finally {
      setIsLoading(false);
    }
  };

  const validateCurrentStep = async (): Promise<boolean> => {
    let fieldsToValidate: (keyof ProjectFormData)[] = [];

    switch (currentStep) {
      case 1:
        fieldsToValidate = ["nombre", "descripcion"];
        break;
      case 2:
        fieldsToValidate = ["tipo", "objetivo"];
        break;
      case 3:
        fieldsToValidate = ["audiencia", "sensibilidad"];
        break;
      case 4:
        fieldsToValidate = ["alcance_temporal", "alcance_geografico"];
        break;
      default:
        return true;
    }

    const result = await form.trigger(fieldsToValidate);
    return result;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid && currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: ProjectFormData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "Debes iniciar sesión para guardar el proyecto",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (isEditMode && projectId) {
        // Update existing project
        await api.patch(`/projects/${projectId}`, {
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          tipo: data.tipo,
          objetivo: data.objetivo,
          audiencia: data.audiencia,
          sensibilidad: data.sensibilidad,
          alcance_temporal: data.alcance_temporal,
          alcance_geografico: data.alcance_geografico,
        });

        toast({
          title: "¡Proyecto actualizado!",
          description: "Los cambios han sido guardados exitosamente",
        });
      } else {
        // Create new project
        await api.post("/projects", {
          nombre: data.nombre,
          descripcion: data.descripcion || null,
          tipo: data.tipo,
          objetivo: data.objetivo,
          audiencia: data.audiencia,
          sensibilidad: data.sensibilidad,
          alcance_temporal: data.alcance_temporal,
          alcance_geografico: data.alcance_geografico,
        });

        toast({
          title: "¡Proyecto creado!",
          description: "Tu proyecto ha sido creado exitosamente",
        });
      }

      navigate("/dashboard/proyectos");
    } catch (error: any) {
      toast({
        title: isEditMode ? "Error al actualizar proyecto" : "Error al crear proyecto",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={wizrLogo} alt="Wizr" className="h-8 w-auto" />
            <span className="text-lg font-semibold">
              {isEditMode ? "Editar Proyecto" : "Project Spec Builder"}
            </span>
          </div>
          <Button variant="ghost" onClick={() => navigate("/dashboard/proyectos")}>
            Cancelar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors ${
                      currentStep > step.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : currentStep === step.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {currentStep > step.id ? (
                      <Check className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{step.id}</span>
                    )}
                  </div>
                  <span
                    className={`mt-2 hidden text-xs md:block ${
                      currentStep >= step.id ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div
                    className={`mx-2 h-0.5 w-8 md:w-16 lg:w-24 ${
                      currentStep > step.id ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Form Card */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
                <CardDescription>{STEPS[currentStep - 1].description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {currentStep === 1 && <StepBasicInfo form={form} />}
                {currentStep === 2 && <StepTypeObjective form={form} />}
                {currentStep === 3 && <StepAudienceSensitivity form={form} />}
                {currentStep === 4 && <StepScope form={form} />}
                {currentStep === 5 && <StepReview form={form} />}

                {/* Navigation Buttons */}
                <div className="flex justify-between pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handlePrevious}
                    disabled={currentStep === 1}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Anterior
                  </Button>

                  {currentStep < STEPS.length ? (
                    <Button type="button" onClick={handleNext}>
                      Siguiente
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? "Guardando..." : isEditMode ? "Guardar Cambios" : "Crear Proyecto"}
                      <Check className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ProjectSpecBuilder;
