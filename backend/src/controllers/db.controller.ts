import { Request, Response } from "express";
import prisma from "../config/prisma";
import fs from "fs";
import path from "path";

// Map PostgreSQL table names to Prisma model delegates
const TABLE_MODEL_MAP: Record<string, string> = {
  users: "user",
  profiles: "profile",
  user_roles: "userRole",
  clients: "client",
  projects: "project",
  entities: "entity",
  mentions: "mention",
  alert_configs: "alertConfig",
  alert_notifications: "alertNotification",
  access_requests: "accessRequest",
  thematic_cards: "thematicCard",
  social_scrape_jobs: "socialScrapeJob",
  social_results: "socialResult",
  post_comments: "postComment",
  fk_profiles: "fkProfile",
  fk_profile_kpis: "fkProfileKpi",
  fk_daily_top_posts: "fkDailyTopPost",
  fk_posts: "fkPost",
  rankings: "ranking",
  project_search_schedules: "projectSearchSchedule",
  auto_save_configs: "autoSaveConfig",
  shared_reports: "sharedReport",
  smart_report_jobs: "smartReportJob",
  client_access: "clientAccess",
  client_efemeride_decisions: "clientEfemerideDecision",
  client_portal_dependencias: "clientPortalDependencia",
  client_portal_benchmark_competitors: "clientPortalBenchmarkCompetitor",
  client_portal_benchmark_periods: "clientPortalBenchmarkPeriod",
  client_portal_benchmark_metrics: "clientPortalBenchmarkMetric",
  client_portal_benchmark_posts: "clientPortalBenchmarkPost",
  client_portal_benchmark_follower_daily: "clientPortalBenchmarkFollowerDaily",
  client_portal_benchmark_narratives: "clientPortalBenchmarkNarrative",
  client_portal_benchmark_uploads: "clientPortalBenchmarkUpload",
  client_portal_listening_entries: "clientPortalListeningEntry",
  client_portal_listening_analyses: "clientPortalListeningAnalysis",
  client_portal_listening_analysis_jobs: "clientPortalListeningAnalysisJob",
  client_portal_dep_recommendations: "clientPortalDepRecommendation",
  client_portal_strategy_reports: "clientPortalStrategyReport",
  client_portal_social_metrics: "clientPortalSocialMetric",
  client_portal_web_analytics: "clientPortalWebAnalytics",
  client_portal_ads_metrics: "clientPortalAdsMetric",
  client_portal_reports: "clientPortalReport",
  client_portal_attachments: "clientPortalAttachment",
  client_portal_assets: "clientPortalAsset",
  client_portal_credentials: "clientPortalCredential",
  client_portal_datasets: "clientPortalDataset",
  client_portal_updates: "clientPortalUpdate",
  client_portal_user_prefs: "clientPortalUserPref",
  client_portal_weekly_recommendations: "clientPortalWeeklyRecommendation",
  notion_parrilla_sources: "notionParrillaSource",
  notion_parrilla_items: "notionParrillaItem",
  client_ga4_properties: "clientGa4Property",
  client_google_ads_accounts: "clientGoogleAdsAccount",
};

// Map PostgREST relation names to Prisma relation field names
const RELATION_NAME_MAP: Record<string, Record<string, string>> = {
  mentions: { entities: "entity", post_comments: "postComments", projects: "project" },
  fk_profile_kpis: { fk_profiles: "profile" },
  fk_daily_top_posts: { fk_profiles: "profile" },
  fk_posts: { fk_profiles: "profile" },
  fk_profiles: {
    fk_profile_kpis: "kpis",
    fk_daily_top_posts: "dailyTopPosts",
    fk_posts: "posts",
    clients: "client",
    projects: "project",
    rankings: "ranking",
  },
  social_results: { social_scrape_jobs: "job", post_comments: "postComments" },
  alert_notifications: { alert_configs: "alertConfig" },
};

function parseFilterCondition(f: any): Record<string, any> {
  const col = f.column;
  switch (f.type) {
    case "eq":
      return { [col]: f.value };
    case "neq":
      return { [col]: { not: f.value } };
    case "in":
      return { [col]: { in: Array.isArray(f.value) ? f.value : [] } };
    case "gte":
      return { [col]: { gte: f.value } };
    case "lte":
      return { [col]: { lte: f.value } };
    case "gt":
      return { [col]: { gt: f.value } };
    case "lt":
      return { [col]: { lt: f.value } };
    case "ilike": {
      const clean = String(f.value || "").replace(/^%|%$/g, "");
      return { [col]: { contains: clean, mode: "insensitive" } };
    }
    case "is":
      return { [col]: f.value === null ? null : f.value };
    case "contains":
      return { [col]: { hasSome: Array.isArray(f.value) ? f.value : [f.value] } };
    case "not":
      if (f.operator === "is") return { [col]: { not: f.value } };
      if (f.operator === "in") {
        const list = String(f.value || "")
          .replace(/^\(|\)$/g, "")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        return { [col]: { notIn: list } };
      }
      return { [col]: { not: f.value } };
    case "or": {
      // Parse simple PostgREST OR strings like "project_id.eq.123,is_own_profile.eq.true"
      const parts = String(f.value || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const orClauses: any[] = [];
      for (const part of parts) {
        const m = part.match(/^([a-zA-Z0-9_]+)\.(eq|neq|ilike|gt|gte|lt|lte|is)\.(.+)$/);
        if (m) {
          const [, c, op, rawVal] = m;
          const val =
            rawVal === "null"
              ? null
              : rawVal === "true"
              ? true
              : rawVal === "false"
              ? false
              : rawVal;
          orClauses.push(parseFilterCondition({ type: op, column: c, value: val }));
        }
      }
      return orClauses.length > 0 ? { OR: orClauses } : {};
    }
    default:
      return {};
  }
}

function buildWhere(filters: any[] = []): Record<string, any> {
  if (!filters || filters.length === 0) return {};
  const andList = filters.map(parseFilterCondition).filter((c) => Object.keys(c).length > 0);
  if (andList.length === 0) return {};
  if (andList.length === 1) return andList[0];
  return { AND: andList };
}

function buildInclude(table: string, selectStr = "*"): { include?: Record<string, boolean>; remap: Record<string, string> } {
  const remap: Record<string, string> = {};
  if (!selectStr || selectStr === "*") return { remap };

  const relRegex = /([a-zA-Z0-9_]+)\s*(?:![a-zA-Z0-9_]+)?\s*\([^)]*\)/g;
  const include: Record<string, boolean> = {};
  let match: RegExpExecArray | null;
  while ((match = relRegex.exec(selectStr)) !== null) {
    const rawRel = match[1];
    const prismaRel = RELATION_NAME_MAP[table]?.[rawRel] || rawRel;
    include[prismaRel] = true;
    if (prismaRel !== rawRel) {
      remap[prismaRel] = rawRel;
    }
  }
  return Object.keys(include).length > 0 ? { include, remap } : { remap };
}

function remapRelations(row: any, remap: Record<string, string>): any {
  if (!row || typeof row !== "object" || Object.keys(remap).length === 0) return row;
  const copy = { ...row };
  for (const [prismaKey, postgrestKey] of Object.entries(remap)) {
    if (prismaKey in copy) {
      copy[postgrestKey] = copy[prismaKey];
    }
  }
  return copy;
}

export const handleTableQuery = async (req: Request, res: Response) => {
  const table = String(req.params.table || "");
  const modelName = TABLE_MODEL_MAP[table];

  if (!modelName || !(prisma as any)[modelName]) {
    return res.status(400).json({ data: null, error: { message: `Tabla no registrada: ${table}` } });
  }

  const delegate = (prisma as any)[modelName];
  const {
    operation = "select",
    select = "*",
    selectOptions = {},
    payload,
    filters = [],
    orders = [],
    range = null,
    limit = null,
    singleMode = null,
  } = req.body || {};

  try {
    const where = buildWhere(filters);
    const { include, remap } = buildInclude(table, select);

    if (operation === "select") {
      if (selectOptions?.head && selectOptions?.count) {
        const count = await delegate.count({ where });
        return res.json({ data: null, count, error: null });
      }

      const orderBy = (orders || []).map((o: any) => ({
        [o.column]: o.ascending === false ? "desc" : "asc",
      }));

      let skip: number | undefined;
      let take: number | undefined;
      if (range && typeof range.from === "number" && typeof range.to === "number") {
        skip = range.from;
        take = Math.max(1, range.to - range.from + 1);
      } else if (typeof limit === "number") {
        take = limit;
      }

      const [rows, count] = await Promise.all([
        delegate.findMany({
          where,
          ...(include ? { include } : {}),
          ...(orderBy.length > 0 ? { orderBy } : {}),
          ...(skip !== undefined ? { skip } : {}),
          ...(take !== undefined ? { take } : {}),
        }),
        selectOptions?.count ? delegate.count({ where }) : Promise.resolve(undefined),
      ]);

      const mapped = rows.map((r: any) => remapRelations(r, remap));

      if (singleMode === "single") {
        if (mapped.length === 0) {
          return res.status(404).json({ data: null, error: { message: "Registro no encontrado" } });
        }
        return res.json({ data: mapped[0], count, error: null });
      }
      if (singleMode === "maybeSingle") {
        return res.json({ data: mapped[0] ?? null, count, error: null });
      }

      return res.json({ data: mapped, count, error: null });
    }

    if (operation === "insert") {
      const items = Array.isArray(payload) ? payload : [payload];
      const created: any[] = [];
      for (const item of items) {
        const row = await delegate.create({
          data: item,
          ...(include ? { include } : {}),
        });
        created.push(remapRelations(row, remap));
      }
      const data = singleMode ? created[0] ?? null : Array.isArray(payload) ? created : created;
      return res.json({ data, count: created.length, error: null });
    }

    if (operation === "upsert") {
      const items = Array.isArray(payload) ? payload : [payload];
      const results: any[] = [];
      for (const item of items) {
        if (item.id) {
          const row = await delegate.upsert({
            where: { id: item.id },
            update: item,
            create: item,
          });
          results.push(remapRelations(row, remap));
        } else {
          // Try create or fallback to update matching unique fields
          try {
            const row = await delegate.create({ data: item });
            results.push(remapRelations(row, remap));
          } catch {
            results.push(item);
          }
        }
      }
      const data = singleMode ? results[0] ?? null : results;
      return res.json({ data, count: results.length, error: null });
    }

    if (operation === "update") {
      if (singleMode) {
        const target = await delegate.findFirst({ where });
        if (!target) {
          return res.json({ data: null, error: null });
        }
        const updated = await delegate.update({
          where: { id: target.id },
          data: payload,
          ...(include ? { include } : {}),
        });
        return res.json({ data: remapRelations(updated, remap), error: null });
      } else {
        const matching = await delegate.findMany({ where, select: { id: true } });
        const updatedRows: any[] = [];
        for (const m of matching) {
          const u = await delegate.update({
            where: { id: m.id },
            data: payload,
            ...(include ? { include } : {}),
          });
          updatedRows.push(remapRelations(u, remap));
        }
        return res.json({ data: updatedRows, count: updatedRows.length, error: null });
      }
    }

    if (operation === "delete") {
      const resDel = await delegate.deleteMany({ where });
      return res.json({ data: [], count: resDel.count, error: null });
    }

    return res.status(400).json({ data: null, error: { message: `Operación inválida: ${operation}` } });
  } catch (error: any) {
    console.error(`[DB Controller Error] table=${table} op=${operation}:`, error.message);
    return res.status(500).json({
      data: null,
      error: { message: error.message || "Error en consulta de base de datos" },
    });
  }
};

export const handleRpc = async (req: Request, res: Response) => {
  const fnName = String(req.params.fnName || "");
  const args = req.body || {};

  try {
    if (fnName === "increment_report_view") {
      const token = args._token;
      if (token) {
        await prisma.sharedReport.updateMany({
          where: { public_token: String(token), is_revoked: false },
          data: {
            view_count: { increment: 1 },
            last_viewed_at: new Date(),
          },
        });
      }
      return res.json({ data: null, error: null });
    }

    if (fnName === "normalize_text") {
      const t = String(args._t || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
      return res.json({ data: t, error: null });
    }

    if (fnName === "has_role") {
      const role = await prisma.userRole.findFirst({
        where: { user_id: args._user_id, role: args._role },
      });
      return res.json({ data: !!role, error: null });
    }

    if (fnName === "get_user_roles") {
      const roles = await prisma.userRole.findMany({
        where: { user_id: args._user_id },
      });
      return res.json({ data: roles.map((r) => r.role), error: null });
    }

    return res.json({ data: null, error: null });
  } catch (error: any) {
    return res.status(500).json({ data: null, error: { message: error.message } });
  }
};

const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");

export const handleStorageUpload = async (req: Request, res: Response) => {
  try {
    const bucket = String(req.params.bucket || "default");
    const { path: filePath, contentBase64 } = req.body || {};
    if (!filePath || !contentBase64) {
      return res.status(400).json({ error: "Falta ruta o contenido del archivo" });
    }
    const targetPath = path.join(UPLOAD_ROOT, bucket, filePath);
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    const base64Data = String(contentBase64).replace(/^data:[^;]+;base64,/, "");
    fs.writeFileSync(targetPath, Buffer.from(base64Data, "base64"));
    return res.json({ path: filePath });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const handleStorageRemove = async (req: Request, res: Response) => {
  try {
    const bucket = String(req.params.bucket || "default");
    const { paths = [] } = req.body || {};
    for (const p of paths) {
      const targetPath = path.join(UPLOAD_ROOT, bucket, String(p));
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
    }
    return res.json({ removed: paths });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const handleStorageSignedUrl = async (req: Request, res: Response) => {
  const bucket = String(req.params.bucket || "default");
  const { path: filePath } = req.body || {};
  return res.json({
    signedUrl: `/api/storage/${bucket}/file/${encodeURIComponent(String(filePath || ""))}`,
  });
};

export const handleStorageGetFile = async (req: Request, res: Response) => {
  const bucket = String(req.params.bucket || "default");
  const filePath = decodeURIComponent(String(req.params.filePath || ""));
  const targetPath = path.join(UPLOAD_ROOT, bucket, filePath);
  if (!fs.existsSync(targetPath)) {
    return res.status(404).send("Archivo no encontrado");
  }
  return res.sendFile(targetPath);
};
