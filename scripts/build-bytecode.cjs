const fs = require("node:fs");
const path = require("node:path");
const bytenode = require("bytenode");
const JavaScriptObfuscator = require("javascript-obfuscator");
const v8 = require("node:v8");

v8.setFlagsFromString("--no-lazy");

const mainDir = path.resolve(__dirname, "../dist-electron");

function obfuscateJavaScript(inputCode) {
	const result = JavaScriptObfuscator.obfuscate(inputCode, {
		compact: true,
		controlFlowFlattening: false,
		deadCodeInjection: false,
		disableConsoleOutput: false,
		identifierNamesGenerator: "hexadecimal",
		renameGlobals: false,
		selfDefending: false,
		simplify: true,
		stringArray: true,
		stringArrayEncoding: ["base64"],
		stringArrayThreshold: 0.75,
		target: "node",
		transformObjectKeys: true,
		unicodeEscapeSequence: false,
	});

	return result.getObfuscatedCode();
}

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
		const sourceCode = fs.readFileSync(filePath, "utf8");

		console.log(`Obfuscating ${file}...`);
		const obfuscatedCode = obfuscateJavaScript(sourceCode);
		fs.writeFileSync(filePath, obfuscatedCode);

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
