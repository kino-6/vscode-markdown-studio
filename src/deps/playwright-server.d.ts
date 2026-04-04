declare module "playwright-core/lib/server" {
  export function installBrowsersForNpmPackages(
    packages: string[]
  ): Promise<void>;
}
