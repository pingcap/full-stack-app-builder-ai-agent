import { spawnSync } from "node:child_process";

export function sh(exec, ...args) {
  return spawnSync(exec, args).stdout.toString().trim();
}
