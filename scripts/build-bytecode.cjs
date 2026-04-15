const fs = require("node:fs");
const path = require("node:path");
const bytenode = require("bytenode");
const JavaScriptObfuscator = require("javascript-obfuscator");
const v8 = require("node:v8");

v8.setFlagsFromString("--no-lazy");

const mainDir = path.resolve(__dirname, "../dist-electron");

// 1. Viel stärkere Obfuscation-Parameter
function obfuscateJavaScript(inputCode) {
	const result = JavaScriptObfuscator.obfuscate(inputCode, {
		compact: true,
		controlFlowFlattening: true,
		controlFlowFlatteningThreshold: 0.75,
		deadCodeInjection: true,
		deadCodeInjectionThreshold: 0.4,
		disableConsoleOutput: true,
		identifierNamesGenerator: "hexadecimal",
		renameGlobals: false,
		selfDefending: true,
		simplify: true,
		splitStrings: true,
		splitStringsChunkLength: 10,
		stringArray: true,
		stringArrayEncoding: ["base64", "rc4"],
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

	// 2. Aufteilung in Bytecode-Ziele und Obfuscation-Only-Ziele
	const bytecodeTargets = new Set(["main.js"]);
	const obfuscateOnlyTargets = new Set(["preload.js"]); // Preload wird "nur" verschleiert

	for (const file of files) {
		if (!file.endsWith(".js")) {
			continue;
		}

		const filePath = path.join(mainDir, file);
		const sourceCode = fs.readFileSync(filePath, "utf8");

		// Fall A: Kompilierung zu Bytecode (main.js)
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
				// electron: true <- DIESE ZEILE KOMPLETT LÖSCHEN
			});

			// 3. Verbesserter Loader mit absoluter Pfadauflösung (verhindert .asar Bugs)
			const jscFileName = file.replace(/\.js$/, ".jsc");
			const loaderCode = `require('bytenode');\nrequire(require('node:path').resolve(__dirname, './${jscFileName}'));\n`;
			fs.writeFileSync(filePath, loaderCode);
		}

		// Fall B: Nur Obfuscation (preload.js)
		else if (obfuscateOnlyTargets.has(file)) {
			console.log(
				`Obfuscating ${file} (bleibt als .js für Sandbox-Kompatibilität)...`,
			);
			const obfuscatedCode = obfuscateJavaScript(sourceCode);
			fs.writeFileSync(filePath, obfuscatedCode);

			// Lösche eventuelle alte .jsc Dateien, falls vorhanden
			const staleJscPath = path.join(mainDir, file.replace(/\.js$/, ".jsc"));
			if (fs.existsSync(staleJscPath)) {
				fs.unlinkSync(staleJscPath);
			}
		}

		// Fall C: Wird komplett ignoriert
		else {
			console.log(`Skipping ${file}.`);
		}
	}

	console.log("Schutzmaßnahmen und Bytecode-Kompilierung abgeschlossen.");
	process.exit(0); // Beendet den Electron-Runner sauber
}

buildBytecode().catch((error) => {
	console.error("Bytecode compilation failed:", error);
	process.exitCode = 1;
});
