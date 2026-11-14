import fs from "node:fs/promises";
import { performance } from "node:perf_hooks";

const baseUrl = (process.env.SEARCH_WORKER_URL || "https://baheth-masr-api.tii822190.workers.dev/").replace(/\/?$/, "/");
const casesPath = new URL("./arabic-search-cases.json", import.meta.url);
const outputJson = process.env.BENCHMARK_OUTPUT || "artifacts/arabic-search-baseline.json";
const outputMarkdown = process.env.BENCHMARK_REPORT || "artifacts/arabic-search-baseline.md";
const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 20000);
const delayMs = Number(process.env.REQUEST_DELAY_MS || 150);

function valueOf(value) {
  if (value && typeof value === "object" && "value" in value) return value.value;
  return value;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactResult(item) {
  return {
    id: item?.id || "",
    result_type: item?.result_type || "",
    title: item?.title || "",
    url: item?.url || "",
    description: item?.description || "",
    category: item?.category || "",
    relevance: item?.relevance ?? null,
    title_match: item?.title_match ?? null,
  };
}

function markdownTable(rows) {
  const header = "| ID | المجموعة | الاستعلام | HTTP | الحالة | ms | النتائج | الصفحات | الاستعلام المطبّع | أول نتيجة |\n|---|---|---|---:|---|---:|---:|---:|---|---|";
  const body = rows.map((row) => {
    const first = row.first_result?.title || "—";
    return `| ${row.id} | ${row.group} | ${row.query || "∅"} | ${row.http_status ?? "—"} | ${row.ok ? "نجح" : "فشل"} | ${row.duration_ms} | ${row.total ?? "—"} | ${row.total_pages ?? "—"} | ${row.normalized_query || "—"} | ${first.replaceAll("|", "\\|")} |`;
  }).join("\n");
  return `${header}\n${body}`;
}

const cases = JSON.parse(await fs.readFile(casesPath, "utf8"));
const startedAt = new Date().toISOString();
const results = [];

for (const testCase of cases) {
  const url = new URL(baseUrl);
  if (testCase.query) url.searchParams.set("q", testCase.query);
  if (testCase.page != null) url.searchParams.set("page", String(testCase.page));
  if (testCase.page_size != null) url.searchParams.set("page_size", String(testCase.page_size));

  const started = performance.now();
  let record = {
    id: testCase.id,
    group: testCase.group,
    query: testCase.query,
    page_requested: testCase.page ?? 1,
    page_size_requested: testCase.page_size ?? 10,
    expected: testCase.expected,
    request_url: url.toString(),
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    clearTimeout(timer);
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { success: false, error: "Invalid JSON response", raw_preview: raw.slice(0, 300) };
    }
    const duration = Math.round((performance.now() - started) * 100) / 100;
    record = {
      ...record,
      ok: response.ok && data.success === true,
      http_status: response.status,
      duration_ms: duration,
      success: data.success ?? false,
      error: data.error || null,
      normalized_query: data.normalizedQuery || "",
      page_returned: data.page ?? null,
      page_size_returned: data.page_size ?? null,
      total: data.total ?? null,
      total_pages: data.total_pages ?? null,
      result_count: Array.isArray(data.results) ? data.results.length : 0,
      first_result: Array.isArray(data.results) && data.results[0] ? compactResult(data.results[0]) : null,
      top_results: Array.isArray(data.results) ? data.results.slice(0, 5).map(compactResult) : [],
    };
  } catch (error) {
    record = {
      ...record,
      ok: false,
      http_status: null,
      duration_ms: Math.round((performance.now() - started) * 100) / 100,
      success: false,
      error: error.name === "AbortError" ? `Timeout after ${timeoutMs}ms` : String(error),
      normalized_query: "",
      page_returned: null,
      page_size_returned: null,
      total: null,
      total_pages: null,
      result_count: 0,
      first_result: null,
      top_results: [],
    };
  }

  results.push(record);
  console.log(`${record.ok ? "PASS" : "FAIL"} ${record.id} ${record.duration_ms}ms total=${record.total ?? "—"}`);
  if (delayMs > 0) await sleep(delayMs);
}

const successful = results.filter((item) => item.ok);
const durations = successful.map((item) => item.duration_ms).sort((a, b) => a - b);
const percentile = (p) => durations.length ? durations[Math.min(durations.length - 1, Math.floor((p / 100) * durations.length))] : null;
const summary = {
  started_at: startedAt,
  finished_at: new Date().toISOString(),
  worker_url: baseUrl,
  test_count: results.length,
  passed_count: successful.length,
  failed_count: results.length - successful.length,
  success_rate: results.length ? Number((successful.length / results.length).toFixed(4)) : 0,
  latency_ms: {
    min: durations[0] ?? null,
    p50: percentile(50),
    p95: percentile(95),
    max: durations.at(-1) ?? null,
  },
  groups: Object.fromEntries([...new Set(results.map((item) => item.group))].map((group) => {
    const items = results.filter((item) => item.group === group);
    return [group, { count: items.length, passed: items.filter((item) => item.ok).length }];
  })),
};

const report = { summary, cases: results };
await fs.mkdir(new URL("./", new URL(`file://${process.cwd()}/`)), { recursive: true }).catch(() => {});
await fs.mkdir("artifacts", { recursive: true });
await fs.writeFile(outputJson, JSON.stringify(report, null, 2) + "\n");
const markdown = `# خط أساس البحث العربي\n\n- **تاريخ البدء:** ${summary.started_at}\n- **Worker:** ${summary.worker_url}\n- **عدد الاختبارات:** ${summary.test_count}\n- **الناجح:** ${summary.passed_count}\n- **الفاشل:** ${summary.failed_count}\n- **نسبة نجاح HTTP/contract:** ${(summary.success_rate * 100).toFixed(1)}%\n- **الزمن الأدنى / الوسيط التقريبي / P95 / الأقصى:** ${summary.latency_ms.min ?? "—"} / ${summary.latency_ms.p50 ?? "—"} / ${summary.latency_ms.p95 ?? "—"} / ${summary.latency_ms.max ?? "—"} ms\n\n> هذا التقرير يقيس سلوك النسخة الحالية فقط. لا يقرر وحده أن النتيجة مناسبة لغويًا؛ تقييم الصلة الدلالية يحتاج مراجعة بشرية قبل وبعد التحسين.\n\n## النتائج\n\n${markdownTable(results)}\n\n## ملاحظات القياس\n\nتم حفظ أول خمس نتائج مختصرة لكل استعلام في ملف JSON، مع الاستعلام الأصلي والاستعلام المطبّع والعدد والصفحة والزمن. لا تحتوي الأداة على حكم آلي على جودة النتائج لأن ذلك يتطلب مجموعة أحكام بشرية (relevance judgments).\n`;
await fs.writeFile(outputMarkdown, markdown);
console.log(`Wrote ${outputJson}`);
console.log(`Wrote ${outputMarkdown}`);
