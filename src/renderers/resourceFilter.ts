/**
 * Domain matching utilities and HTML filtering for external resources.
 *
 * Provides functions to extract domains from URLs, check them
 * against an allowed-domains list (case-insensitive exact match),
 * and filter external resources in HTML based on policy mode.
 */

import type { ExternalResourceConfig } from '../types/models';

/**
 * Extract the hostname from a URL string, lowercased.
 *
 * Uses the `URL` constructor for safe parsing.
 * Returns `null` for any input that cannot be parsed as a valid URL.
 */
export function extractDomain(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check whether the domain of `url` appears in `allowedDomains`.
 *
 * Comparison is case-insensitive exact match on the hostname.
 * Returns `false` for invalid URLs (safe fallback).
 */
export function isDomainAllowed(
  url: string,
  allowedDomains: string[],
): boolean {
  const domain = extractDomain(url);
  if (domain === null) {
    return false;
  }
  return allowedDomains.some((allowed) => {
    // If the allowed entry looks like a URL (contains "://"), extract its hostname.
    // This handles cases where users specify "https://github.com" instead of "github.com".
    const normalised = extractDomain(allowed) ?? allowed.toLowerCase();
    return domain === normalised;
  });
}

/**
 * Determine whether a URL is a local/internal resource that should never be filtered.
 *
 * Local resources include `vscode-resource://`, `file://`, relative paths,
 * data URIs, and fragment-only references.
 */
function isLocalResource(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.startsWith('vscode-resource://') ||
    lower.startsWith('file://') ||
    lower.startsWith('data:') ||
    lower.startsWith('#') ||
    // Relative paths: no protocol present
    !(/^[a-z][a-z0-9+\-.]*:/i.test(url))
  );
}

/**
 * Decide whether a given URL should be blocked based on the config mode.
 *
 * Returns `true` when the resource should be replaced with a blocked placeholder.
 * Local resources are never blocked.
 */
function shouldBlock(url: string, config: ExternalResourceConfig): boolean {
  if (isLocalResource(url)) {
    return false;
  }
  if (config.mode === 'block-all') {
    return true;
  }
  // whitelist mode – block unless the domain is allowed
  return !isDomainAllowed(url, config.allowedDomains);
}

/**
 * Filter external resources in an HTML string according to the given policy.
 *
 * - `allow-all`: returns `htmlBody` unchanged.
 * - `block-all`: replaces every external `<a>` and `<img>` with blocked placeholders.
 * - `whitelist`: keeps resources whose domain appears in `config.allowedDomains`,
 *   replaces the rest with blocked placeholders.
 *
 * Local resources (`vscode-resource://`, `file://`, relative paths, data URIs)
 * are never filtered regardless of mode.
 */
export function filterExternalResources(
  htmlBody: string,
  config: ExternalResourceConfig,
): string {
  if (config.mode === 'allow-all') {
    return htmlBody;
  }

  let result = htmlBody;

  // --- External links ---
  // We need to replace both the opening <a> tag and its closing </a> when blocked.
  // Strategy: process each <a>…</a> pair. For links whose href is blocked,
  // replace the opening tag with <span …> and the closing </a> with </span>.
  // For allowed links, leave them untouched.
  result = result.replace(
    /<a\s+([^>]*?)href="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/gi,
    (_match, before, url, after, content) => {
      if (shouldBlock(url, config)) {
        return `<span class="ms-link-blocked" title="External link blocked">${content}</span>`;
      }
      return _match;
    },
  );

  // --- External images ---
  result = result.replace(
    /<img\s+([^>]*?)src="([^"]*)"([^>]*?)\/?\s*>/gi,
    (match, _before, url) => {
      if (shouldBlock(url, config)) {
        return '<div class="ms-error">External image blocked by policy.</div>';
      }
      return match;
    },
  );

  return result;
}
