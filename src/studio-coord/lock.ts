import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

export function withCoordinatorFileLock<T>(lockPath: string, action: () => T): T {
  let descriptor: number;
  try {
    descriptor = openSync(lockPath, "wx", 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    let owner = "unknown";
    try {
      owner = readFileSync(lockPath, "utf8").trim() || "unknown";
    } catch {
      // The owner may be releasing the lock; fail closed and let the caller retry.
    }
    throw new Error(`another coordinator mutation holds ${lockPath} (owner ${owner})`);
  }

  try {
    writeFileSync(descriptor, `${process.pid}\n`);
    return action();
  } finally {
    closeSync(descriptor);
    unlinkSync(lockPath);
  }
}
