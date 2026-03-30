import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const targetDirs = [
  path.resolve(__dirname, '../dist-electron'),
  path.resolve(__dirname, '../dist')
];
const manifestPath = path.resolve(__dirname, '../dist-electron/integrity.json');

const manifest = {};

function generateHashes(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir, { withFileTypes: true });
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      generateHashes(fullPath);
    } else if (fullPath !== manifestPath) {
      try {
        const fileBuffer = fs.readFileSync(fullPath);
        const hashSum = crypto.createHash('sha256');
        hashSum.update(fileBuffer);
        const hex = hashSum.digest('hex');
        
        // Use relative path as key
        const relativePath = path.relative(path.resolve(__dirname, '..'), fullPath).replaceAll('\\', '/');
        manifest[relativePath] = hex;
      } catch (error) {
        console.warn(`[Integrity] Skipping ${fullPath}: ${error.message}`);
      }
    }
  }
}

targetDirs.forEach(dir => generateHashes(dir));

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Integrity manifest generated with ${Object.keys(manifest).length} entries at ${manifestPath}.`);
