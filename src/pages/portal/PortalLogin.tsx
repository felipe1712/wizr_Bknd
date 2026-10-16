import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowRight } from "lucide-react";
import type { ClientPortalConfig } from "@/lib/clientPortal";

export default function PortalLogin({ portal }: { portal: ClientPortalConfig }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isForgot, setIsForgot] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Revisa tu correo para restablecer tu contraseña");
        setIsForgot(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Error de autenticación");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-mesh opacity-40" />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass-strong rounded-2xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="w-16 h-16 rounded-2xl bg-gradient-coral mx-auto flex items-center justify-center mb-4"
            >
              <Lock className="w-8 h-8 text-primary-foreground" />
            </motion.div>
            <h1 className="text-2xl font-display font-bold text-foreground">
              {portal.displayName}
            </h1>
            <p className="text-muted-foreground text-sm">
              {portal.tagline ?? "Portal privado"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Correo</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@correo.com"
                  className="pl-10 bg-secondary border-border"
                  required
                />
              </div>
            </div>
            {!isForgot && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground">Contraseña</Label>
                  <button
                    type="button"
                    onClick={() => setIsForgot(true)}
                    className="text-xs text-muted-foreground hover:text-coral transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-secondary border-border"
                  required
                  minLength={6}
                />
              </div>
            )}
            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-coral hover:opacity-90 text-primary-foreground font-semibold group"
            >
              {loading ? "Cargando..." : isForgot ? "Enviar enlace" : "Entrar"}
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>

          {isForgot && (
            <div className="text-center">
              <button
                onClick={() => setIsForgot(false)}
                className="text-sm text-muted-foreground hover:text-coral transition-colors"
              >
                ← Volver al inicio de sesión
              </button>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground/60 pt-2">
            powered by KiMedia
          </p>
        </div>
      </motion.div>
    </div>
  );
}