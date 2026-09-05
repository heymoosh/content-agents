import { spawn } from "node:child_process";

const seconds = Number(process.argv[2]);
const command = process.argv[3];
const args = process.argv.slice(4);
if (!Number.isInteger(seconds) || seconds < 1 || !command) {
  console.error("usage: node wallclock.mjs SECONDS COMMAND [ARGS...]");
  process.exit(64);
}

const child = spawn(command, args, { detached: true, stdio: "inherit", env: process.env });
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  setTimeout(() => {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
  }, 10_000).unref();
}, seconds * 1000);

child.on("error", (error) => {
  clearTimeout(timer);
  console.error(`failed to start bounded canary: ${error.message}`);
  process.exit(70);
});
child.on("exit", (code, signal) => {
  clearTimeout(timer);
  if (timedOut) process.exit(124);
  if (signal) process.exit(128 + ({ SIGTERM: 15, SIGKILL: 9 }[signal] ?? 1));
  process.exit(code ?? 1);
});
