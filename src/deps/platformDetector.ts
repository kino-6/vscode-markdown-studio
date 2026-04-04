import type { PlatformInfo } from "./types";

const supported: Record<string, string[]> = {
  darwin: ["x64", "arm64"],
  linux: ["x64"],
  win32: ["x64"],
};

/**
 * Detects the current OS and architecture, returning a PlatformInfo
 * for selecting the correct download artifact.
 *
 * @param os  Override for process.platform (useful for testing)
 * @param arch Override for process.arch (useful for testing)
 * @throws Error when the OS/arch combination is not supported
 */
export function detectPlatform(
  os: string = process.platform,
  arch: string = process.arch
): PlatformInfo {
  if (!Object.hasOwn(supported, os) || !supported[os].includes(arch)) {
    const all = Object.entries(supported)
      .flatMap(([o, archs]) => archs.map((a) => `${o}-${a}`))
      .join(", ");
    throw new Error(
      `Unsupported platform: ${os}-${arch}. Supported: ${all}`
    );
  }

  return {
    os: os as PlatformInfo["os"],
    arch: arch as PlatformInfo["arch"],
    archiveExt: os === "win32" ? "zip" : "tar.gz",
  };
}
