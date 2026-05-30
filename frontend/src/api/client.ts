import axios from "axios";
import type {
  Source,
  Notice,
  Stats,
  Settings,
  TestResult,
  CrawlResult,
  PaginatedList,
} from "../types";

const baseURL = import.meta.env.VITE_API_BASE || "/api";

function getToken(): string {
  const key = "wt_admin_token";
  let t = localStorage.getItem(key);
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(key, t); }
  return t;
}

export function getAdminToken(): string { return getToken(); }

// 所有请求带上 workspace ID + token
function api(wsId: string) {
  const token = getToken();
  return axios.create({
    baseURL: `${baseURL}/${wsId}`,
    params: { token },
  });
}

// ====== 工作空间 ======

export async function createWorkspace(id?: string, name?: string, webhook?: string) {
  const a = axios.create({ baseURL });
  const { data } = await a.post("/workspaces", { id, name, default_webhook: webhook });
  return data;
}

// ====== 爬取源 ======

export interface SourceFormData {
  name: string;
  url: string;
  list_selector: string;
  title_selector: string;
  link_selector: string;
  time_selector?: string;
  webhook_url?: string;
  crawl_interval: number;
  is_active: boolean;
}

export async function fetchSources(wsId: string, skip = 0, limit = 50): Promise<PaginatedList<Source>> {
  const { data } = await api(wsId).get("/sources", { params: { skip, limit } });
  return data;
}

export async function createSource(wsId: string, form: SourceFormData): Promise<Source> {
  const { data } = await api(wsId).post("/sources", form);
  return data;
}

export async function updateSource(wsId: string, id: string, form: Partial<SourceFormData>): Promise<Source> {
  const { data } = await api(wsId).put(`/sources/${id}`, form);
  return data;
}

export async function deleteSource(wsId: string, id: string): Promise<void> {
  await api(wsId).delete(`/sources/${id}`);
}

export async function testSource(wsId: string, id: string): Promise<TestResult> {
  const { data } = await api(wsId).post(`/sources/${id}/test`);
  return data;
}

export async function manualCrawl(wsId: string, id: string): Promise<CrawlResult> {
  const { data } = await api(wsId).post(`/sources/${id}/crawl`);
  return data;
}

// ====== 通知 ======

export async function fetchNotices(wsId: string, skip = 0, limit = 20, sourceId?: string): Promise<PaginatedList<Notice>> {
  const { data } = await api(wsId).get("/notices", { params: { skip, limit, source_id: sourceId } });
  return data;
}

// ====== 统计 ======

export async function fetchStats(wsId: string): Promise<Stats> {
  const { data } = await api(wsId).get("/stats");
  return data;
}

// ====== 个人 Webhook ======

export async function fetchMyWebhooks(wsId: string, token: string) {
  const a = axios.create({ baseURL });
  const { data } = await a.get(`/${wsId}/webhooks`, { params: { token } });
  return data.items;
}

export async function addMyWebhook(wsId: string, token: string, webhook_url: string, label?: string) {
  const a = axios.create({ baseURL });
  const { data } = await a.post(`/${wsId}/webhooks`, { webhook_url, label }, { params: { token } });
  return data;
}

export async function deleteMyWebhook(wsId: string, token: string, hookId: string) {
  const a = axios.create({ baseURL });
  await a.delete(`/${wsId}/webhooks/${hookId}`, { params: { token } });
}

export async function fetchSettings(wsId: string): Promise<Settings> {
  const { data } = await api(wsId).get("/settings");
  return data;
}

export async function updateSettings(wsId: string, form: Partial<Settings>): Promise<Settings> {
  const { data } = await api(wsId).put("/settings", form);
  return data;
}
