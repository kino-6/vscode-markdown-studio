const TLS_CERTIFICATE_ERROR_PATTERNS = [
  "UNABLE_TO_GET_ISSUER_CERT_LOCALLY",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "CERT_HAS_EXPIRED",
  "ERR_TLS_CERT_ALTNAME_INVALID",
  "UNABLE TO VERIFY THE FIRST CERTIFICATE",
  "UNABLE TO GET LOCAL ISSUER CERTIFICATE",
  "SELF-SIGNED CERTIFICATE",
  "CERTIFICATE HAS EXPIRED",
  "HOSTNAME/IP DOES NOT MATCH CERTIFICATE'S ALTNAMES",
];

export const TLS_CERTIFICATE_SETTINGS_HINT =
  'If your network uses a corporate proxy or SSL inspection, configure VS Code "http.proxy", set "http.proxyStrictSSL": false, or add your corporate CA certificate path to "markdownStudio.network.caCertificates".';

function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    return `${code ?? ""} ${error.message}`.trim();
  }
  return String(error);
}

export function isTlsCertificateError(error: unknown): boolean {
  const text = stringifyError(error).toUpperCase();
  return TLS_CERTIFICATE_ERROR_PATTERNS.some((pattern) => text.includes(pattern));
}

export function appendTlsCertificateSettingsHint(message: string): string {
  if (message.includes("http.proxyStrictSSL") || message.includes("markdownStudio.network.caCertificates")) {
    return message;
  }
  return `${message} ${TLS_CERTIFICATE_SETTINGS_HINT}`;
}

export async function withNodeTlsRejectUnauthorizedDisabled<T>(
  operation: () => Promise<T>
): Promise<T> {
  const saved = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  try {
    return await operation();
  } finally {
    if (saved === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = saved;
    }
  }
}
