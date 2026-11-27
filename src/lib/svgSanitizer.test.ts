import { describe, expect, it } from 'vitest';
import { sanitizeSvg } from './svgSanitizer';

describe('svgSanitizer — Proteção contra XSS em Heráldica e Brasões', () => {
  it('permite tags SVG legítimas e caminhos vetoriais', () => {
    const validSvg = '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="#f00"/><path d="M10 10 L90 90"/></svg>';
    expect(sanitizeSvg(validSvg)).toBe(validSvg);
  });

  it('remove scripts embutidos dentro do SVG', () => {
    const maliciousSvg = '<svg><script>alert("xss")</script><circle cx="10" cy="10" r="5"/></svg>';
    const cleaned = sanitizeSvg(maliciousSvg);
    expect(cleaned).not.toContain('<script');
    expect(cleaned).not.toContain('alert');
    expect(cleaned).toContain('<circle cx="10" cy="10" r="5"/>');
  });

  it('remove handlers de eventos como onload, onerror, onclick', () => {
    const maliciousSvg = '<svg onload="fetch(\'/steal\')"><image href="x" onerror="alert(1)"/><path onclick="bad()"/></svg>';
    const cleaned = sanitizeSvg(maliciousSvg);
    expect(cleaned).not.toContain('onload');
    expect(cleaned).not.toContain('onerror');
    expect(cleaned).not.toContain('onclick');
    expect(cleaned).not.toContain('fetch');
    expect(cleaned).not.toContain('bad()');
  });

  it('remove tags perigosas como iframe e embed', () => {
    const dangerousSvg = '<svg><iframe>http://evil.com</iframe><embed src="malware.swf"/></svg>';
    const cleaned = sanitizeSvg(dangerousSvg);
    expect(cleaned).not.toContain('<iframe');
    expect(cleaned).not.toContain('<embed');
  });

  it('retorna string vazia para entradas nulas ou inválidas', () => {
    expect(sanitizeSvg('')).toBe('');
    expect(sanitizeSvg(null as any)).toBe('');
    expect(sanitizeSvg(undefined as any)).toBe('');
  });
});
