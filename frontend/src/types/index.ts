/** 爬取源 */
export interface Source {
  id: string;
  workspace_id: string;
  name: string;
  url: string;
  list_selector: string;
  title_selector: string;
  link_selector: string;
  time_selector: string | null;
  webhook_url?: string;
  crawl_interval: number;
  is_active: boolean | number;
  last_crawled_at: string | null;
  created_at: string;
  updated_at: string;
  notice_count: number;
}

/** 通知 */
export interface Notice {
  id: string;
  source_id: string;
  source_name: string;
  title: string;
  url: string;
  published_at: string | null;
  first_seen_at: string;
}

/** 统计数据 */
export interface Stats {
  source_count: number;
  active_source_count: number;
  notice_total: number;
  today_new: number;
  push_success_rate: number;
  workspace_name?: string;
  default_webhook?: string;
}

/** 系统设置 */
export interface Settings {
  default_webhook?: string;
  workspace_name?: string;
  default_crawl_interval: number;
}

/** 测试结果 */
export interface TestResult {
  status: string;
  message: string;
  items: Array<{ title: string; url: string; time: string | null }>;
  item_count: number;
}

/** 爬取结果 */
export interface CrawlResult {
  status: string;
  new_count: number;
  notified: number;
  items: Array<{ id: string; title: string; url: string }>;
}

/** 分页列表 */
export interface PaginatedList<T> {
  items: T[];
  total: number;
}
