import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Loader2, X, Info } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { FKNetwork, getNetworkLabel } from "@/hooks/useFanpageKarma";

interface FKCSVImporterProps {
  rankingId: string;
}

interface ParsedProfile {
  profileId: string;
  displayName: string;
  network: FKNetwork;
  followers: number | null;
  engagementRate: number | null;
  postsPerDay: number | null;
  pagePerformanceIndex: number | null;
  followerGrowthPercent: number | null;
  selected: boolean;
}

// Map FK CSV column names to our fields — FK exports vary by language
const COLUMN_MAP: Record<string, string> = {
  // English
  "profile": "profileId",
  "page": "profileId",
  "name": "displayName",
  "profile name": "displayName",
  "page name": "displayName",
  "fans": "followers",
  "followers": "followers",
  "subscribers": "followers",
  "engagement": "engagementRate",
  "engagement rate": "engagementRate",
  "engagement (%)": "engagementRate",
  "posts per day": "postsPerDay",
  "posts/day": "postsPerDay",
  "ppi": "pagePerformanceIndex",
  "page performance index": "pagePerformanceIndex",
  "page performance": "pagePerformanceIndex",
  "growth": "followerGrowthPercent",
  "fan growth": "followerGrowthPercent",
  "follower growth": "followerGrowthPercent",
  "growth (%)": "followerGrowthPercent",
  // Spanish
  "perfil": "profileId",
  "página": "profileId",
  "nombre": "displayName",
  "nombre del perfil": "displayName",
  "seguidores": "followers",
  "suscriptores": "followers",
  "tasa de engagement": "engagementRate",
  "interacción": "engagementRate",
  "publicaciones por día": "postsPerDay",
  "publicaciones/día": "postsPerDay",
  "rendimiento de página": "pagePerformanceIndex",
  "crecimiento": "followerGrowthPercent",
  "crecimiento de seguidores": "followerGrowthPercent",
  // German (FK is a German tool)
  "seitenname": "displayName",
  "beiträge pro tag": "postsPerDay",
  "wachstum": "followerGrowthPercent",
};

const NETWORK_DETECT: Record<string, FKNetwork> = {
  "facebook": "facebook",
  "fb": "facebook",
  "instagram": "instagram",
  "ig": "instagram",
  "youtube": "youtube",
  "yt": "youtube",
  "twitter": "twitter",
  "x": "twitter",
  "tiktok": "tiktok",
  "linkedin": "linkedin",
  "threads": "threads",
};

function detectNetwork(row: Record<string, any>, sheetName?: string): FKNetwork {
  // Check if there's a network/platform column
  for (const key of Object.keys(row)) {
    const k = key.toLowerCase().trim();
    if (k === "network" || k === "platform" || k === "red" || k === "red social" || k === "plattform") {
      const val = String(row[key]).toLowerCase().trim();
      if (NETWORK_DETECT[val]) return NETWORK_DETECT[val];
    }
  }
  // Try sheet name
  if (sheetName) {
    const sn = sheetName.toLowerCase();
    for (const [pattern, net] of Object.entries(NETWORK_DETECT)) {
      if (sn.includes(pattern)) return net;
    }
  }
  return "facebook"; // default
}

function parseNumeric(val: any): number | null {
  if (val == null || val === "" || val === "-" || val === "N/A") return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const str = String(val).replace(/[,%]/g, "").replace(/\s/g, "").trim();
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

function mapRow(row: Record<string, any>, sheetName?: string): ParsedProfile | null {
  const mapped: Record<string, any> = {};

  for (const [colName, value] of Object.entries(row)) {
    const normalized = colName.toLowerCase().trim();
    const field = COLUMN_MAP[normalized];
    if (field) mapped[field] = value;
  }

  // Need at least a profile ID or display name
  const profileId = String(mapped.profileId || mapped.displayName || "").trim();
  if (!profileId) return null;

  return {
    profileId: profileId.replace(/^@/, ""),
    displayName: String(mapped.displayName || mapped.profileId || profileId).trim(),
    network: detectNetwork(row, sheetName),
    followers: parseNumeric(mapped.followers),
    engagementRate: parseNumeric(mapped.engagementRate),
    postsPerDay: parseNumeric(mapped.postsPerDay),
    pagePerformanceIndex: parseNumeric(mapped.pagePerformanceIndex),
    followerGrowthPercent: parseNumeric(mapped.followerGrowthPercent),
    selected: true,
  };
}

export function FKCSVImporter({ rankingId }: FKCSVImporterProps) {
  const [parsedProfiles, setParsedProfiles] = useState<ParsedProfile[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const queryClient = useQueryClient();

  const processFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        
        const allProfiles: ParsedProfile[] = [];
        
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);
          
          for (const row of rows) {
            const profile = mapRow(row, sheetName);
            if (profile && !allProfiles.some(p => p.profileId === profile.profileId && p.network === profile.network)) {
              allProfiles.push(profile);
            }
          }
        }

        if (allProfiles.length === 0) {
          toast({ title: "No se encontraron perfiles", description: "Verifica que el archivo tenga columnas como Profile, Name, Followers, etc.", variant: "destructive" });
          return;
        }

        setParsedProfiles(allProfiles);
        toast({ title: `${allProfiles.length} perfiles detectados`, description: "Revisa la vista previa y confirma la importación." });
      } catch (err) {
        toast({ title: "Error al leer archivo", description: String(err), variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const toggleProfile = (idx: number) => {
    setParsedProfiles(prev => prev.map((p, i) => i === idx ? { ...p, selected: !p.selected } : p));
  };

  const handleImport = async () => {
    const selected = parsedProfiles.filter(p => p.selected);
    if (selected.length === 0) return;

    setImporting(true);
    try {
      // 1. Insert profiles into fk_profiles
      const profilesToInsert = selected.map(p => ({
        ranking_id: rankingId,
        network: p.network,
        profile_id: p.profileId,
        display_name: p.displayName,
        is_active: true,
      }));

      const { data: insertedProfiles, error: profileError } = await supabase
        .from("fk_profiles")
        .upsert(profilesToInsert, { onConflict: "ranking_id,network,profile_id", ignoreDuplicates: false })
        .select();

      if (profileError) throw profileError;

      // 2. For profiles with KPI data, insert into fk_profile_kpis
      if (insertedProfiles) {
        const today = new Date().toISOString().slice(0, 10);
        const kpisToInsert = insertedProfiles
          .map(ip => {
            const source = selected.find(s => s.profileId === ip.profile_id && s.network === ip.network);
            if (!source || (source.followers == null && source.engagementRate == null)) return null;
            return {
              fk_profile_id: ip.id,
              period_start: today,
              period_end: today,
              followers: source.followers ? Math.round(source.followers) : null,
              engagement_rate: source.engagementRate,
              posts_per_day: source.postsPerDay,
              page_performance_index: source.pagePerformanceIndex,
              follower_growth_percent: source.followerGrowthPercent,
            };
          })
          .filter(Boolean);

        if (kpisToInsert.length > 0) {
          const { error: kpiError } = await supabase
            .from("fk_profile_kpis")
            .upsert(kpisToInsert as any[], { onConflict: "fk_profile_id,period_start,period_end" });
          if (kpiError) console.error("KPI insert warning:", kpiError);
        }
      }

      toast({ title: "Importación exitosa", description: `${selected.length} perfiles importados al ranking.` });
      setParsedProfiles([]);
      setFileName("");
      queryClient.invalidateQueries({ queryKey: ["fk-profiles-ranking"] });
      queryClient.invalidateQueries({ queryKey: ["fk-kpis"] });
    } catch (err: any) {
      toast({ title: "Error al importar", description: err.message || String(err), variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = parsedProfiles.filter(p => p.selected).length;

  // Drop zone + file picker
  if (parsedProfiles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            Importar desde CSV / Excel
          </CardTitle>
          <CardDescription>
            Sube un export de Fanpage Karma (.csv o .xlsx) para cargar perfiles y métricas automáticamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("fk-csv-input")?.click()}
          >
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Arrastra tu archivo aquí o haz clic para seleccionar</p>
            <p className="text-sm text-muted-foreground mt-1">Formatos: .csv, .xlsx, .xls</p>
          </div>
          <input
            id="fk-csv-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileInput}
          />
          <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              El importador detecta automáticamente columnas como <strong>Profile</strong>, <strong>Followers</strong>, <strong>Engagement</strong>, <strong>PPI</strong>, etc. Funciona con exports en inglés, español y alemán.
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Preview table
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Vista previa: {fileName}
            </CardTitle>
            <CardDescription>
              {selectedCount} de {parsedProfiles.length} perfiles seleccionados
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => { setParsedProfiles([]); setFileName(""); }}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={handleImport} disabled={selectedCount === 0 || importing}>
              {importing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Importar {selectedCount} perfiles
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead>Red</TableHead>
              <TableHead className="text-right">Seguidores</TableHead>
              <TableHead className="text-right">Engagement</TableHead>
              <TableHead className="text-right">Posts/día</TableHead>
              <TableHead className="text-right">PPI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {parsedProfiles.map((p, idx) => (
              <TableRow key={idx} className={!p.selected ? "opacity-40" : ""}>
                <TableCell>
                  <input
                    type="checkbox"
                    checked={p.selected}
                    onChange={() => toggleProfile(idx)}
                    className="rounded"
                  />
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{p.displayName}</span>
                    {p.displayName !== p.profileId && (
                      <span className="text-xs text-muted-foreground ml-2">@{p.profileId}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {getNetworkLabel(p.network)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {p.followers != null ? p.followers.toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {p.engagementRate != null ? `${p.engagementRate.toFixed(2)}%` : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {p.postsPerDay != null ? p.postsPerDay.toFixed(1) : "—"}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {p.pagePerformanceIndex != null ? `${(p.pagePerformanceIndex * 100).toFixed(0)}%` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {parsedProfiles.some(p => p.followers == null && p.engagementRate == null) && (
          <div className="mt-3 flex items-start gap-2 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Algunos perfiles no tienen métricas. Se importarán solo como perfiles y podrás sincronizar sus KPIs después vía Fanpage Karma.</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
