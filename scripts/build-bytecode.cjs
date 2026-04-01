const fs = require("node:fs");
const path = require("node:path");
const bytenode = require("bytenode");
const v8 = require("node:v8");

v8.setFlagsFromString("--no-lazy");

const mainDir = path.resolve(__dirname, "../dist-electron");

async function buildBytecode() {
	if (!fs.existsSync(mainDir)) {
		console.log(
			"Main build directory not found. Please run the build script first.",
		);
		return;
	}

	const files = fs.readdirSync(mainDir);
	const bytecodeTargets = new Set(["main.js"]);

	for (const file of files) {
		if (!file.endsWith(".js")) {
			continue;
		}

		if (!bytecodeTargets.has(file)) {
			console.log(
				`Skipping ${file} (kept as plain JS for runtime compatibility).`,
			);
			const staleJscPath = path.join(mainDir, file.replace(/\.js$/, ".jsc"));
			if (fs.existsSync(staleJscPath)) {
				fs.unlinkSync(staleJscPath);
			}
			continue;
		}

		const filePath = path.join(mainDir, file);
		const outputJsc = filePath.replace(/\.js$/, ".jsc");

		console.log(`Compiling ${file} to bytecode...`);
		await bytenode.compileFile({
			filename: filePath,
			output: outputJsc,
			compileAsModule: true,
			electron: true,
		});

		const loaderCode = `require('bytenode');\nrequire('./${file.replace(/\.js$/, ".jsc")}');\n`;
		fs.writeFileSync(filePath, loaderCode);
	}

	console.log("Bytecode compilation complete.");
}

buildBytecode().catch((error) => {
	console.error("Bytecode compilation failed:", error);
	process.exitCode = 1;
});
