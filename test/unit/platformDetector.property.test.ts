import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { detectPlatform } from "../../src/deps/platformDetector";

/**
 * Property 5: Unsupported platform detection
 *
 * For any OS/architecture combination not in the supported set
 * (darwin-arm64, darwin-x64, linux-x64, win32-x64),
 * `detectPlatform()` throws an error whose message contains
 * all supported platform names.
 *
 * **Validates: Requirement 4.3**
 */

const SUPPORTED_PLATFORMS = new Set([
  "darwin-arm64",
  "darwin-x64",
  "linux-x64",
  "win32-x64",
]);

const unsupportedOsArch = fc
  .tuple(fc.string({ minLength: 1 }), fc.string({ minLength: 1 }))
  .filter(([os, arch]) => !SUPPORTED_PLATFORMS.has(`${os}-${arch}`));

describe("PlatformDetector property tests", () => {
  it("Property 5: unsupported platform detection — throws with all supported names", () => {
    fc.assert(
      fc.property(unsupportedOsArch, ([os, arch]) => {
        try {
          detectPlatform(os, arch);
          // If it didn't throw, the property is violated
          expect.unreachable("Expected detectPlatform to throw for unsupported platform");
        } catch (err: any) {
          expect(err).toBeInstanceOf(Error);
          const msg: string = err.message;
          for (const platform of SUPPORTED_PLATFORMS) {
            expect(msg).toContain(platform);
          }
        }
      }),
      { numRuns: 200 }
    );
  });
});
