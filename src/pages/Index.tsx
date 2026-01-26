import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import wizrLogoFull from "@/assets/wizr-logo-full.png";
import wizrHeroLogo from "@/assets/wizr-logo-full-transparent.png";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, BarChart3, Bell, TrendingUp, Shield, Zap } from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: BarChart3,
    title: "Análisis Semántico",
    description: "Extrae insights profundos del contenido con análisis de sentimiento y temas.",
  },
  {
    icon: Bell,
    title: "Alertas Inteligentes",
    description: "Recibe notificaciones en tiempo real sobre cambios críticos.",
  },
  {
    icon: TrendingUp,
    title: "Tendencias",
    description: "Identifica patrones emergentes antes que tu competencia.",
  },
  {
    icon: Shield,
    title: "Gestión de Crisis",
    description: "Detecta y responde rápidamente a situaciones de riesgo.",
  },
];

const Index = () => {
  const { user, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-lg">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link to="/" className="flex items-center">
            <img src={wizrLogoFull} alt="Wizr" className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4">
            {!loading && user ? (
              <Link to="/dashboard">
                <Button size="sm" className="gap-2">
                  Dashboard
                  <ArrowRight size={16} />
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Iniciar sesión
                  </Button>
                </Link>
                <Link to="/solicitar-acceso">
                  <Button size="sm">Solicitar acceso</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-8"
          >
            {/* Large Brand Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="inline-block"
            >
              <img 
                src={wizrHeroLogo} 
                alt="Wizr - Análisis Estratégico" 
                className="h-32 sm:h-40 lg:h-48 w-auto mx-auto" 
              />
            </motion.div>

            {/* Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm text-primary">
              <Sparkles size={16} />
              <span className="font-medium">Inteligencia Estratégica</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
              Convierte la conversación pública en{" "}
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                conocimiento utilizable
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Sistema de lectura estratégica diseñado para transformar menciones, 
              tendencias y sentimiento en decisiones informadas.
            </p>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              {!loading && user ? (
                <Link to="/dashboard">
                  <Button size="lg" className="gap-2 px-8">
                    Ir al Dashboard
                    <ArrowRight size={18} />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/solicitar-acceso">
                    <Button size="lg" className="gap-2 px-8">
                      Solicitar acceso
                      <ArrowRight size={18} />
                    </Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="outline" size="lg" className="px-8">
                      Ya tengo cuenta
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Philosophy */}
            <div className="flex items-center justify-center gap-3 pt-8 text-sm text-muted-foreground">
              <Zap size={14} className="text-accent" />
              <span>Metodología Académica</span>
              <span className="text-border">•</span>
              <span>Magia Analítica</span>
              <span className="text-border">•</span>
              <span>Producto Operativo</span>
            </div>
          </motion.div>
        </div>

        {/* Decorative gradient */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-r from-primary/20 via-accent/10 to-primary/20 blur-3xl opacity-30 pointer-events-none" />
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 relative">
        <div className="container mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Todo lo que necesitas para monitorear tu marca
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Herramientas poderosas diseñadas para equipos que necesitan 
              entender y actuar sobre la conversación pública.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="group relative rounded-2xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <feature.icon size={24} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="relative rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-10 sm:p-14 text-center text-white overflow-hidden"
          >
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

            <div className="relative z-10 space-y-6">
              <h2 className="text-3xl sm:text-4xl font-bold">
                ¿Listo para transformar tu estrategia?
              </h2>
              <p className="text-white/80 max-w-xl mx-auto">
                Únete a los equipos que ya utilizan Wizr para tomar decisiones 
                basadas en inteligencia estratégica.
              </p>
              {!loading && !user && (
                <Link to="/solicitar-acceso">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="bg-white text-primary hover:bg-white/90 gap-2"
                  >
                    Solicitar acceso ahora
                    <ArrowRight size={18} />
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={wizrLogoFull} alt="Wizr" className="h-6 w-auto opacity-70" />
          </div>
          <p className="text-sm text-muted-foreground">
            Un producto de{" "}
            <a 
              href="https://kimedia.mx/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary font-medium hover:underline transition-colors"
            >
              KiMedia
            </a>{" "}
            • {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
