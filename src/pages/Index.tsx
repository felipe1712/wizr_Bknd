import wizrLogo from "@/assets/wizr-logo.png";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8">
      <div className="flex flex-col items-center gap-8 text-center">
        {/* Logo */}
        <img 
          src={wizrLogo} 
          alt="Wizr - Análisis Estratégico" 
          className="h-32 w-auto"
        />
        
        {/* Tagline */}
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Metodología Académica + Magia Analítica + Producto Operativo
          </p>
          <p className="text-sm text-accent">
            Wizard → Wise → Structure + Insight
          </p>
        </div>

        {/* Description */}
        <p className="max-w-xl text-lg text-foreground/80">
          Sistema de lectura estratégica diseñado para convertir conversación pública en conocimiento utilizable.
        </p>

        {/* CTA */}
        <div className="flex gap-4">
          <button className="rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90">
            Comenzar
          </button>
          <button className="rounded-lg border border-border bg-card px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted">
            Ver Demo
          </button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-muted-foreground">
          Un producto de <span className="text-accent font-medium">Kimedia</span>
        </p>
      </div>
    </div>
  );
};

export default Index;
