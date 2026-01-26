import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import wizrLogoFull from "@/assets/wizr-logo-full.png";
import { Eye, EyeOff, Loader2, Mail, Lock, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (error.message === "Invalid login credentials") {
        setError("Credenciales incorrectas. Verifica tu correo y contraseña.");
      } else {
        setError(error.message);
      }
      setLoading(false);
    } else {
      navigate("/dashboard");
    }
  };

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
                Inteligencia Estratégica
              </span>
            </div>
            
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight">
              Convierte la conversación pública en{" "}
              <span className="text-accent">conocimiento</span> utilizable
            </h1>
            
            <p className="text-lg text-white/80 max-w-md">
              Metodología académica + Magia analítica + Producto operativo
            </p>

            <div className="flex items-center gap-4 pt-6">
              <div className="h-1 w-16 bg-accent rounded-full" />
              <span className="text-sm text-white/60">
                Wizard → Wise → Structure + Insight
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="w-full max-w-sm space-y-8"
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
              <h2 className="text-xl font-semibold text-foreground">Bienvenido de nuevo</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Ingresa tus credenciales para continuar
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-4">
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
                    placeholder="tu@email.com"
                    required
                    autoComplete="email"
                    className="bg-card pl-10 h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium">
                    Contraseña
                  </Label>
                  <Link
                    to="/recuperar-contrasena"
                    className="text-xs text-primary hover:underline"
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="bg-card pl-10 pr-10 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
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
                  Iniciando sesión...
                </>
              ) : (
                "Iniciar sesión"
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
                  ¿No tienes acceso?
                </span>
              </div>
            </div>

            <Link to="/solicitar-acceso" className="block">
              <Button variant="outline" className="w-full">
                Solicitar acceso
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

export default Login;
