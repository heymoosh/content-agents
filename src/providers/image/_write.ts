import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Shared by the image adapters: write bytes to disk (creating parent dirs) or download a URL.

export function writeImageFile(outPath: string, buf: Buffer): string {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
  return outPath;
}

export async function downloadImage(url: string, outPath: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`image download failed: ${res.status} ${url}`);
  return writeImageFile(outPath, Buffer.from(await res.arrayBuffer()));
}
