// Copyright (c) 2026 Haven contributors. Use of this source code is governed by the Haven Source Available License (Haven-SAL) v1.0.
// Compile obfuscated main.js to V8 bytecode using Bytenode
// Preload.js is kept as obfuscated JS only (Bytenode causes context bridge issues)

import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distElectronPath = path.resolve(__dirname, "../dist-electron");
const mainJsPath = path.join(distElectronPath, "main.js");
const mainObfPath = path.join(distElectronPath, "main.obf.js");
const mainJscPath = path.join(distElectronPath, "main.jsc");
const preloadPath = path.join(distElectronPath, "preload.js");

/**
 * Compile JavaScript to V8 bytecode using Bytenode
 */
async function _compileWithBytenode(inputPath, _outputPath) {
	return new Promise((resolve, reject) => {
		const bytenodeCli = path.resolve(
			__dirname,
			"../node_modules/.bin/bytenode",
		);

		// Use bytenode CLI to compile
		// --compile flag creates .jsc file
		const _args = ["--compile", inputPath];

		const child = spawn(
			process.platform === "win32" ? "bun" : "npx",
			[
				process.platform === "win32"
					? bytenodeCli.replace(/\\/g, "/")
					: bytenodeCli.replace(".bin/bytenode", ".bin/bytenode"),
				"--compile",
				inputPath,
			],
			{
				cwd: distElectronPath,
				stdio: ["ignore", "pipe", "pipe"],
				shell: process.platform === "win32",
			},
		);

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (code) => {
			if (code !== 0) {
				reject(new Error(`Bytenode compilation failed: ${stderr || stdout}`));
			} else {
				resolve();
			}
		});

		child.on("error", (err) => {
			reject(new Error(`Failed to spawn bytenode: ${err.message}`));
		});
	});
}

/**
 * Alternative: Use Node.js API to compile
 */
async function _compileWithBytenodeApi(inputPath, outputPath) {
	// We'll use a child process to require bytenode and compile
	const compileScript = `
		const bytenode = require('bytenode');
		const fs = require('fs');
		const path = require('path');
		
		const inputPath = '${inputPath.replace(/\\/g, "\\")}';
		const outputPath = '${outputPath.replace(/\\/g, "\\")}';
		
		try {
			// Read the source
			const code = fs.readFileSync(inputPath, 'utf8');
			
			// Compile to bytecode
			bytenode.compileFile(inputPath);
			
			console.log('Compilation successful');
			process.exit(0);
		} catch (err) {
			console.error('Compilation failed:', err.message);
			process.exit(1);
		}
	`;

	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["-e", compileScript], {
			stdio: ["ignore", "pipe", "pipe"],
		});

		let stdout = "";
		let stderr = "";

		child.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		child.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		child.on("close", (code) => {
			if (code !== 0) {
				reject(
					new Error(`Bytenode API compilation failed: ${stderr || stdout}`),
				);
			} else {
				resolve();
			}
		});
	});
}

/**
 * Create a loader script that loads the bytecode
 */
function createLoaderScript() {
	// This loader requires bytenode and then loads the .jsc file
	// Note: bytenode 1.x auto-initializes, no init() call needed
	return `'use strict';
// Haven Bytecode Loader
// This file loads the compiled V8 bytecode of the main process
// The actual obfuscated source is in main.obf.js (kept for reference)
// The compiled bytecode is in main.jsc

// Require bytenode (auto-initializes module system hooks)
require('bytenode');

// Load and execute the bytecode
require('./main.jsc');
`;
}

async function main() {
	console.log("[Bytenode] Starting bytecode compilation...");

	try {
		// Check if main.js exists
		try {
			await fs.access(mainJsPath);
		} catch {
			console.error(
				"[Bytenode] Error: dist-electron/main.js not found. Run 'bun run build' first.",
			);
			process.exit(1);
		}

		// Check if preload.js exists (we won't touch it)
		try {
			await fs.access(preloadPath);
			console.log(
				"[Bytenode] ✓ preload.js found (will remain as obfuscated JS only)",
			);
		} catch {
			console.warn("[Bytenode] Warning: preload.js not found");
		}

		// Step 1: Rename main.js to main.obf.js (keep obfuscated source)
		console.log("[Bytenode] Step 1: Backing up obfuscated source...");
		await fs.copyFile(mainJsPath, mainObfPath);
		console.log(`[Bytenode] ✓ Copied main.js → main.obf.js`);

		// Step 2: Compile main.obf.js to main.jsc using Electron's Node.js
		// This ensures the bytecode matches the V8 version in the packaged app
		console.log(
			"[Bytenode] Step 2: Compiling to V8 bytecode using Electron...",
		);

		// Find electron executable
		const electronModulePath = path.resolve(
			__dirname,
			"../node_modules/electron",
		);
		const electronPath =
			process.platform === "win32"
				? path.join(electronModulePath, "dist/electron.exe")
				: path.join(electronModulePath, "dist/electron");

		// Use Electron's Node.js to compile (ELECTRON_RUN_AS_NODE=1 makes electron act like node)
		const compileScript = `
const bytenode = require('bytenode');
const path = require('path');

const mainObfPath = '${mainObfPath.replace(/\\/g, "\\\\")}';
const mainJscPath = '${mainJscPath.replace(/\\/g, "\\\\")}';

try {
    // Pass the explicit output path as the second argument
    bytenode.compileFile({ filename: mainObfPath, output: mainJscPath });
    console.log('Compilation successful');
    process.exit(0);
} catch (err) {
    console.error('Compilation failed:', err.message);
    process.exit(1);
}
`;

		await new Promise((resolve, reject) => {
			const child = spawn(electronPath, ["-e", compileScript], {
				stdio: ["ignore", "pipe", "pipe"],
				env: {
					...process.env,
					ELECTRON_RUN_AS_NODE: "1", // Makes Electron behave like Node.js
				},
			});

			let stdout = "";
			let stderr = "";
			child.stdout.on("data", (data) => {
				stdout += data.toString();
			});
			child.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			child.on("close", (code) => {
				if (code !== 0) {
					reject(new Error(stderr || stdout));
				} else {
					resolve();
				}
			});
		});

		console.log(`[Bytenode] ✓ Compiled main.obf.js → main.jsc`);

		// Step 3: Create loader main.js
		console.log("[Bytenode] Step 3: Creating loader script...");
		const loaderCode = createLoaderScript();
		await fs.writeFile(mainJsPath, loaderCode, "utf8");
		console.log(`[Bytenode] ✓ Created loader main.js`);

		// Step 4: Verify files
		console.log("[Bytenode] Step 4: Verifying output...");
		const mainJscStats = await fs.stat(mainJscPath);
		const mainObfStats = await fs.stat(mainObfPath);

		console.log(
			`[Bytenode] ✓ main.jsc: ${(mainJscStats.size / 1024).toFixed(2)} KB`,
		);
		console.log(
			`[Bytenode] ✓ main.obf.js: ${(mainObfStats.size / 1024).toFixed(2)} KB (backup)`,
		);
		console.log(
			`[Bytenode] ✓ main.js: loader script (${(loaderCode.length / 1024).toFixed(2)} KB)`,
		);
		console.log(`[Bytenode] ✓ preload.js: unchanged (obfuscated JS only)`);

		console.log("\n[Bytenode] Bytecode compilation completed successfully!");
		console.log(
			"[Bytenode] The main process is now protected by obfuscation + V8 bytecode.",
		);
		console.log(
			"[Bytenode] The preload script remains obfuscated JS only (no bytecode).",
		);
	} catch (error) {
		console.error(`[Bytenode] Error: ${error.message}`);

		// Cleanup on failure
		try {
			await fs.access(mainObfPath);
			// Restore from backup if compilation failed
			await fs.copyFile(mainObfPath, mainJsPath);
			console.log("[Bytenode] Restored main.js from backup.");
		} catch {
			// No backup exists
		}

		process.exit(1);
	}
}

main();
