import * as vscode from 'vscode';

export interface NetworkConfig {
  /** HTTPSプロキシURL (例: "http://proxy.corp.example.com:8080") */
  proxyUrl?: string;
  /** カスタムCA証明書のファイルパス配列 */
  caCertPaths: string[];
  /** SSL証明書検証を厳密に行うか (デフォルト: true) */
  strictSSL: boolean;
}

/**
 * VS Code設定、拡張機能設定、環境変数からネットワーク設定を解決する。
 * 優先順位: VS Code設定 > 環境変数
 */
export function resolveNetworkConfig(
  env: Record<string, string | undefined> = process.env
): NetworkConfig {
  const httpCfg = vscode.workspace.getConfiguration('http');
  const msCfg = vscode.workspace.getConfiguration('markdownStudio');

  // Proxy URL: VS Code http.proxy > HTTPS_PROXY > HTTP_PROXY
  const vscodeProxy = httpCfg.get<string>('proxy', '') || undefined;
  const envProxy =
    env.HTTPS_PROXY || env.HTTP_PROXY || env.https_proxy || env.http_proxy || undefined;
  const proxyUrl = vscodeProxy || envProxy;

  // strictSSL: VS Code http.proxyStrictSSL (default true)
  const strictSSL = httpCfg.get<boolean>('proxyStrictSSL', true);

  // CA cert paths: extension setting + NODE_EXTRA_CA_CERTS (deduplicated)
  const configPaths = msCfg.get<string[]>('network.caCertificates', []);
  const caCertPaths = [...configPaths];

  const envCaCert = env.NODE_EXTRA_CA_CERTS;
  if (envCaCert && !caCertPaths.includes(envCaCert)) {
    caCertPaths.push(envCaCert);
  }

  return { proxyUrl, caCertPaths, strictSSL };
}
