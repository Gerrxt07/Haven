import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..");
const releaseDir = resolve(rootDir, "release");

await rm(releaseDir, { recursive: true, force: true });
await mkdir(releaseDir, { recursive: true });

console.log(`Prepared release directory at ${releaseDir}`);
