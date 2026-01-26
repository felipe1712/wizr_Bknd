import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import wizrLogoFull from "@/assets/wizr-logo-full.png";
import { Loader2, ArrowLeft, User, Mail, FileText, CheckCircle, Shield, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const SolicitarAcceso = () => {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase
      .from("access_requests")
      .insert({
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        reason: reason.trim() || null,
      });

    if (error) {
      if (error.code === "23505") {
        setError("Ya existe una solicitud con este correo electrónico");
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm space-y-8 text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <CheckCircle className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-3">
            <h1 className="text-2xl font-bold text-foreground">Solicitud enviada</h1>
            <p className="text-sm text-muted-foreground">
              Hemos recibido tu solicitud de acceso. Un administrador la revisará y te notificará por correo cuando sea aprobada.
            </p>
          </div>
          <Link to="/login">
            <Button variant="outline" className="w-full gap-2">
              <ArrowLeft size={16} />
              Volver al inicio
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary via-primary to-primary/80 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-accent/30 blur-3xl" />
        </div>
        
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20 text-white">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="space-y-8"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-accent" />
              <span className="text-sm font-medium uppercase tracking-widest text-white/70">
                Acceso Controlado
              </span>
            </div>
            
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Únete a la plataforma de{" "}
              <span className="text-accent">inteligencia</span> estratégica
            </h1>
            
            <p className="text-lg text-white/80 max-w-md">
              Wizr es una herramienta exclusiva para equipos que necesitan 
              entender y actuar sobre la conversación pública.
            </p>

            <div className="flex items-center gap-4 pt-6">
              <div className="h-1 w-16 bg-accent rounded-full" />
              <span className="text-sm text-white/60">
                Solicita acceso y un administrador revisará tu petición
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Logo */}
          <div className="flex flex-col items-center gap-4">
            <Link to="/">
              <img
                src={wizrLogoFull}
                alt="Wizr"
                className="h-16 w-auto transition-transform hover:scale-105"
              />
            </Link>
            <div className="text-center">
              <h2 className="text-xl font-semibold text-foreground">Solicitar acceso</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Completa el formulario para solicitar acceso a la plataforma
              </p>
            </div>
          </div>

          {/* Security badge */}
          <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
            <Shield size={14} className="text-primary" />
            <span>Acceso restringido - Requiere aprobación de administrador</span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName" className="text-sm font-medium">
                  Nombre completo
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Tu nombre completo"
                    required
                    autoComplete="name"
                    className="bg-card pl-10 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Correo electrónico
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@empresa.com"
                    required
                    autoComplete="email"
                    className="bg-card pl-10 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reason" className="text-sm font-medium">
                  Motivo de la solicitud <span className="text-muted-foreground">(opcional)</span>
                </Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="¿Por qué necesitas acceso a Wizr?"
                    className="bg-card pl-10 min-h-[100px] resize-none"
                  />
                </div>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
              >
                {error}
              </motion.div>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando solicitud...
                </>
              ) : (
                "Enviar solicitud"
              )}
            </Button>
          </form>

          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">
                  ¿Ya tienes cuenta?
                </span>
              </div>
            </div>

            <Link to="/login" className="block">
              <Button variant="outline" className="w-full">
                Iniciar sesión
              </Button>
            </Link>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Un producto de <span className="text-primary font-medium">Kimedia</span>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default SolicitarAcceso;
