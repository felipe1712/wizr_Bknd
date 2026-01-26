import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import wizrLogo from "@/assets/wizr-logo.png";
import { Loader2, ArrowLeft, User, Mail, FileText, CheckCircle, Shield } from "lucide-react";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md space-y-8"
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <Link to="/">
            <img src={wizrLogo} alt="Wizr" className="h-16 w-auto transition-transform hover:scale-105" />
          </Link>
          <div className="space-y-2 text-center">
            <h1 className="text-xl font-semibold text-foreground">Solicitar acceso</h1>
            <p className="text-sm text-muted-foreground max-w-xs">
              Wizr es una plataforma de acceso controlado. Completa el formulario y un administrador revisará tu solicitud.
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
                  className="bg-card pl-10"
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
                  className="bg-card pl-10"
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
                  className="bg-card pl-10 min-h-[80px] resize-none"
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

          <Button type="submit" className="w-full" disabled={loading}>
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

        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Inicia sesión
            </Link>
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Un producto de <span className="text-primary font-medium">Kimedia</span>
        </p>
      </motion.div>
    </div>
  );
};

export default SolicitarAcceso;
