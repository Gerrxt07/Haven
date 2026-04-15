import { cp, mkdir, readdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

const platform = process.argv[2] || process.platform;
const rootDir = resolve(import.meta.dirname, "..");
const bundleDir = resolve(rootDir, "src-tauri", "target", "release", "bundle");
const releaseDir = resolve(rootDir, "release");

const suffixMap = {
	win32: new Set([".exe", ".msi", ".zip", ".sig", ".msix"]),
	darwin: new Set([".app", ".dmg", ".zip", ".sig"]),
	linux: new Set([".appimage", ".deb", ".rpm", ".tar.gz", ".sig"]),
};

const allowedSuffixes = suffixMap[platform] ?? new Set([".sig"]);

function hasAllowedSuffix(filePath) {
	const lower = filePath.toLowerCase();
	for (const suffix of allowedSuffixes) {
		if (lower.endsWith(suffix)) {
			return true;
		}
	}
	return false;
}

async function walk(dir) {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			if (hasAllowedSuffix(entry.name)) {
				files.push(fullPath);
				continue;
			}
			files.push(...(await walk(fullPath)));
			continue;
		}
		files.push(fullPath);
	}

	return files;
}

function matchesAllowedArtifact(filePath) {
	const lower = filePath.toLowerCase();
	if (lower.endsWith(".tar.gz")) {
		return allowedSuffixes.has(".tar.gz");
	}

	return hasAllowedSuffix(extname(lower)) || hasAllowedSuffix(lower);
}

const files = await walk(bundleDir);
const artifacts = files.filter(matchesAllowedArtifact);

await mkdir(releaseDir, { recursive: true });

for (const artifact of artifacts) {
	const target = join(releaseDir, artifact.split(/[/\\]/).at(-1));
	await cp(artifact, target, { recursive: true, force: true });
	console.log(`Copied ${artifact} -> ${target}`);
}

if (artifacts.length === 0) {
	console.warn(`No Tauri bundle artifacts found for platform ${platform} in ${bundleDir}`);
	process.exitCode = 1;
}
