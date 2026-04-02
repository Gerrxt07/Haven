const { spawn } = require("node:child_process");

const env = {
	...process.env,
	HAVEN_DEV_UPDATER_UI: "1",
};

const child = spawn("bun run dev", [], {
	stdio: "inherit",
	env,
	shell: true,
});

child.on("error", (error) => {
	console.error("Failed to start updater UI dev mode:", error);
	process.exit(1);
});

child.on("exit", (code) => {
	process.exit(code ?? 0);
});
