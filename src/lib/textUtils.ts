/**
 * 清理职位描述中的常见噪音，如 CSS 类、简单 HTML 标签、特定关键词和不可见字符。
 * @param description 原始职位描述字符串或 null
 * @returns 清理后的字符串或 '未提供'
 */
export function cleanJobDescription(description: string | null): string {
  if (!description) return '未提供';
  
  let cleaned = description;
  // 移除类似 .RskCthJffMJ{...} 的 CSS 类定义块
  cleaned = cleaned.replace(/\.\w+\{[^}]*\}/g, '');
  // 移除类似 <span...>xxx</span> 的标签 (简单匹配，可能不完美)
  cleaned = cleaned.replace(/<span[^>]*>[^<]*<\/span>/gi, '');
  // 移除特定关键词
  cleaned = cleaned.replace(/BOSS直聘/g, '');
  cleaned = cleaned.replace(/kanzhun/g, '');
  // 移除可能残留的不可见字符或特殊标记（示例，可能需要根据实际情况调整）
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, ''); 
  // 移除多余空格
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
} 