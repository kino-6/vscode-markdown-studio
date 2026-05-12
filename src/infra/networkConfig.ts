import * as vscode from 'vscode';
import { CONFIG_DEFAULTS, CONFIG_KEYS, CONFIG_SECTION } from './configurationRegistry';

export interface NetworkConfig {
  /** HTTPS proxy URL, for example "http://proxy.corp.example.com:8080". */
  proxyUrl?: string;
  /** Custom CA certificate file paths. */
  caCertPaths: string[];
  /** Whether SSL certificate verification is strict. Defaults to true. */
  strictSSL: boolean;
}

/**
 * Resolves network settings from VS Code settings, extension settings, and
 * environment variables. Priority: VS Code settings > environment variables.
 */
export function resolveNetworkConfig(
  env: Record<string, string | undefined> = process.env
): NetworkConfig {
  const httpCfg = vscode.workspace.getConfiguration('http');
  const msCfg = vscode.workspace.getConfiguration(CONFIG_SECTION);

  // Proxy URL: VS Code http.proxy > HTTPS_PROXY > HTTP_PROXY
  const vscodeProxy = httpCfg.get<string>('proxy', '') || undefined;
  const envProxy =
    env.HTTPS_PROXY || env.HTTP_PROXY || env.https_proxy || env.http_proxy || undefined;
  const proxyUrl = vscodeProxy || envProxy;

  // strictSSL: VS Code http.proxyStrictSSL (default true)
  const strictSSL = httpCfg.get<boolean>('proxyStrictSSL', true);

  // CA cert paths: extension setting + NODE_EXTRA_CA_CERTS (deduplicated)
  const configPaths = msCfg.get<string[]>(CONFIG_KEYS.networkCaCertificates, CONFIG_DEFAULTS.networkCaCertificates);
  const caCertPaths = [...configPaths];

  const envCaCert = env.NODE_EXTRA_CA_CERTS;
  if (envCaCert && !caCertPaths.includes(envCaCert)) {
    caCertPaths.push(envCaCert);
  }

  return { proxyUrl, caCertPaths, strictSSL };
}
