import { describe, expect, it } from "vitest";
import { detectPlatform } from "../../src/deps/platformDetector";

describe("detectPlatform", () => {
  describe("supported platforms", () => {
    it("returns darwin-arm64 with tar.gz", () => {
      const info = detectPlatform("darwin", "arm64");
      expect(info).toEqual({ os: "darwin", arch: "arm64", archiveExt: "tar.gz" });
    });

    it("returns darwin-x64 with tar.gz", () => {
      const info = detectPlatform("darwin", "x64");
      expect(info).toEqual({ os: "darwin", arch: "x64", archiveExt: "tar.gz" });
    });

    it("returns linux-x64 with tar.gz", () => {
      const info = detectPlatform("linux", "x64");
      expect(info).toEqual({ os: "linux", arch: "x64", archiveExt: "tar.gz" });
    });

    it("returns win32-x64 with zip", () => {
      const info = detectPlatform("win32", "x64");
      expect(info).toEqual({ os: "win32", arch: "x64", archiveExt: "zip" });
    });
  });

  describe("unsupported platforms", () => {
    it("throws for linux-arm64", () => {
      expect(() => detectPlatform("linux", "arm64")).toThrow(
        /Unsupported platform: linux-arm64/
      );
    });

    it("throws for win32-arm64", () => {
      expect(() => detectPlatform("win32", "arm64")).toThrow(
        /Unsupported platform: win32-arm64/
      );
    });

    it("throws for freebsd-x64", () => {
      expect(() => detectPlatform("freebsd", "x64")).toThrow(
        /Unsupported platform: freebsd-x64/
      );
    });

    it("error message lists all supported platforms", () => {
      try {
        detectPlatform("freebsd", "x64");
      } catch (e: any) {
        expect(e.message).toContain("darwin-x64");
        expect(e.message).toContain("darwin-arm64");
        expect(e.message).toContain("linux-x64");
        expect(e.message).toContain("win32-x64");
      }
    });
  });

  describe("defaults to process values", () => {
    it("returns a valid PlatformInfo when called with no arguments", () => {
      // The current test runner platform should be supported
      const info = detectPlatform();
      expect(["darwin", "linux", "win32"]).toContain(info.os);
      expect(["x64", "arm64"]).toContain(info.arch);
      expect(["tar.gz", "zip"]).toContain(info.archiveExt);
    });
  });
});
