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
		disableConsoleOutput: false,
		identifierNamesGenerator: "hexadecimal",
		renameGlobals: false,
		selfDefending: false,
		simplify: true,
		stringArray: true,
		stringArrayEncoding: ["base64"],
		stringArrayThreshold: 0.6,
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

		// Other files stay untouched.
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
