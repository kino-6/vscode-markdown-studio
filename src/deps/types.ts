export interface PlatformInfo {
  os: "darwin" | "linux" | "win32";
  arch: "x64" | "arm64";
  archiveExt: "tar.gz" | "zip";
}

export interface InstallerResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export interface DependencyManifest {
  version: number;
  corretto?: {
    installedAt: string;
    javaPath: string;
    correttoVersion: string;
    platform: string;
  };
  chromium?: {
    installedAt: string;
    browserPath: string;
    playwrightVersion: string;
  };
}

export interface DependencyStatus {
  allReady: boolean;
  javaPath?: string;
  browserPath?: string;
  errors: string[];
}
