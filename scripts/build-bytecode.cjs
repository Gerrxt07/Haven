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
		controlFlowFlattening: true,
		controlFlowFlatteningThreshold: 0.75,
		deadCodeInjection: true,
		deadCodeInjectionThreshold: 0.4,
		disableConsoleOutput: true,
		identifierNamesGenerator: "hexadecimal",
		numbersToExpressions: true,
		renameGlobals: false,
		selfDefending: true,
		simplify: true,
		splitStrings: true,
		splitStringsChunkLength: 10,
		stringArray: true,
		stringArrayCallsTransform: true,
		stringArrayCallsTransformThreshold: 0.5,
		stringArrayEncoding: ["base64", "rc4"],
		stringArrayIndexShift: true,
		stringArrayRotate: true,
		stringArrayShuffle: true,
		stringArrayWrappersCount: 1,
		stringArrayWrappersChainedCalls: true,
		stringArrayWrappersParametersMaxCount: 2,
		stringArrayWrappersType: "variable",
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
	const obfuscateOnlyTargets = new Set(["preload.js"]); // Add preload.js for obfuscation only

	for (const file of files) {
		if (!file.endsWith(".js")) {
			continue;
		}

		const filePath = path.join(mainDir, file);
		const sourceCode = fs.readFileSync(filePath, "utf8");

		if (bytecodeTargets.has(file)) {
			console.log(`Obfuscating ${file} vor der Kompilierung...`);
			const obfuscatedCode = obfuscateJavaScript(sourceCode);
			fs.writeFileSync(filePath, obfuscatedCode);

			console.log(`Compiling ${file} to bytecode...`);
			const outputJsc = filePath.replace(/\.js$/, ".jsc");
			await bytenode.compileFile({
				filename: filePath,
				output: outputJsc,
				compileAsModule: true,
			});

			// Verbesserter Loader mit absoluter Pfadauflösung (verhindert .asar Bugs)
			const jscFileName = file.replace(/\.js$/, ".jsc");
			const loaderCode = `require('bytenode');\nrequire(require('node:path').resolve(__dirname, './${jscFileName}'));\n`;
			fs.writeFileSync(filePath, loaderCode);
		} else if (obfuscateOnlyTargets.has(file)) {
			console.log(`Obfuscating ${file}...`);
			const obfuscatedCode = obfuscateJavaScript(sourceCode);
			fs.writeFileSync(filePath, obfuscatedCode);
		} else {
			console.log(`Skipping ${file}.`);
		}
	}

	console.log("Schutzmaßnahmen und Bytecode-Kompilierung abgeschlossen.");
	process.exit(0);
}

buildBytecode().catch((error) => {
	console.error("Bytecode compilation failed:", error);
	process.exitCode = 1;
});
