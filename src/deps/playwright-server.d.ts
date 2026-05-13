declare module "playwright-core/lib/server" {
  export function installBrowsersForNpmInstall(
    browsers: string[]
  ): Promise<void>;
}
