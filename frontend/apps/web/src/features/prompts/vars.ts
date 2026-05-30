const VAR_RE = /\{\{\s*(\w+)\s*\}\}/g

/** 抽取 {{变量}} 名(去重) */
export function extractVars(text: string): string[] {
  return [...new Set([...text.matchAll(VAR_RE)].map((m) => m[1]))]
}

/** 用变量值渲染模板;未提供值的变量保留占位 */
export function renderPrompt(text: string, vals: Record<string, string>): string {
  return text.replace(VAR_RE, (_, k: string) => vals[k] || `{{${k}}}`)
}
