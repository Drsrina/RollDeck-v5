/**
 * Sanitiza código SVG para evitar injeção XSS (remover scripts, iframes, handlers on*).
 */
export function sanitizeSvg(rawSvg: string): string {
  if (!rawSvg || typeof rawSvg !== 'string') return '';

  let sanitized = rawSvg.trim();

  // Remove tags de script
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

  // Remove iframes, objects, embeds, applets
  sanitized = sanitized.replace(/<\/?(iframe|object|embed|applet)\b[^>]*>/gi, '');

  // Remove handlers inline de eventos (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s+on[a-z]+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '');

  // Remove esquemas javascript: ou vbscript: em hrefs ou links
  sanitized = sanitized.replace(/(href|xlink:href)\s*=\s*(?:'javascript:[^']*'|"javascript:[^"]*"|javascript:[^\s>]+)/gi, '');

  return sanitized;
}
