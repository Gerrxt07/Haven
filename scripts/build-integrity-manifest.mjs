import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDirs = [
	path.resolve(__dirname, "../dist-electron"),
	path.resolve(__dirname, "../dist"),
];
const manifestPath = path.resolve(__dirname, "../dist-electron/integrity.json");

const manifest = {};

async function generateHashes(dir) {
	if (!existsSync(dir)) return;
	const files = readdirSync(dir, { withFileTypes: true });
	for (const file of files) {
		const fullPath = path.join(dir, file.name);
		if (file.isDirectory()) {
			await generateHashes(fullPath);
		} else if (fullPath !== manifestPath) {
			try {
				const fileBuffer = await Bun.file(fullPath).arrayBuffer();
				const hashSum = new Bun.CryptoHasher("sha256");
				hashSum.update(fileBuffer);
				const hex = hashSum.digest("hex");

				// Use relative path as key
				const relativePath = path
					.relative(path.resolve(__dirname, ".."), fullPath)
					.replaceAll("\\", "/");
				manifest[relativePath] = hex;
			} catch (error) {
				console.warn(`[Integrity] Skipping ${fullPath}: ${error.message}`);
			}
		}
	}
}

async function main() {
	for (const dir of targetDirs) {
		await generateHashes(dir);
	}
	await Bun.write(manifestPath, JSON.stringify(manifest, null, 2));
	console.log(
		`Integrity manifest generated with ${Object.keys(manifest).length} entries at ${manifestPath}.`,
	);
}

main().catch(console.error);
