export const toolIframeAllow = "clipboard-read; clipboard-write";

export const toolIframeSandbox = "allow-downloads allow-forms allow-modals allow-scripts";

export const toolDocumentPolicy = [
  "default-src 'none'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob: data:",
  "style-src 'unsafe-inline'",
  "script-src 'unsafe-inline' blob:",
  "worker-src blob:",
  "frame-src 'self' blob: data:",
  "connect-src 'none'",
  "font-src data:",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");
