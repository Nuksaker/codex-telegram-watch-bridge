const secretPatterns = [
  /\b\d{6,10}:[A-Za-z0-9_-]{30,}\b/g,
  /\b(?:sk|sk-proj)-[A-Za-z0-9_-]{16,}\b/g,
  /(?:password|secret|token|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi,
];

export function redact(input: string): string {
  return secretPatterns.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), input);
}

export function safeExcerpt(input: string, maxChars: number): string {
  const text = redact(input).replace(/\s+/g, ' ').trim();
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

export function shortId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 6)}…${id.slice(-4)}`;
}
