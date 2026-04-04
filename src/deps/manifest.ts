import * as fs from "fs/promises";
import * as path from "path";
import { DependencyManifest } from "./types";

export const MANIFEST_VERSION = 1;

const MANIFEST_FILENAME = "manifest.json";

function emptyManifest(): DependencyManifest {
  return { version: MANIFEST_VERSION };
}

/**
 * Read and parse the dependency manifest from the storage directory.
 * Returns an empty manifest if the file is missing, corrupted, or has a mismatched schema version.
 */
export async function readManifest(storageDir: string): Promise<DependencyManifest> {
  const filePath = path.join(storageDir, MANIFEST_FILENAME);
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch {
    // File missing or unreadable — treat as empty
    return emptyManifest();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Corrupted JSON — treat as empty
    return emptyManifest();
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).version !== "number" ||
    (parsed as Record<string, unknown>).version !== MANIFEST_VERSION
  ) {
    return emptyManifest();
  }

  return parsed as DependencyManifest;
}

/**
 * Write the dependency manifest to the storage directory with proper JSON serialization.
 * Creates the storage directory if it doesn't exist.
 */
export async function writeManifest(storageDir: string, manifest: DependencyManifest): Promise<void> {
  await fs.mkdir(storageDir, { recursive: true });
  const filePath = path.join(storageDir, MANIFEST_FILENAME);
  await fs.writeFile(filePath, JSON.stringify(manifest, null, 2), "utf-8");
}
