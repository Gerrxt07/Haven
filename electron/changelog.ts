const GITHUB_API_BASE = "https://api.github.com/repos/Gerrxt07/Haven";
const GITHUB_COMMITS_URL = "https://github.com/Gerrxt07/Haven/commits/master";
const GITHUB_API_HEADERS = {
	Accept: "application/vnd.github+json",
	"User-Agent": "Haven-Updater",
	"X-GitHub-Api-Version": "2022-11-28",
} as const;

export interface ChangelogEntry {
	sha: string;
	summary: string;
	details: string;
	url: string;
}

export interface ChangelogData {
	entries: ChangelogEntry[];
	source: "compare" | "latest";
	fallbackUrl: string;
}

interface GitHubCommit {
	sha?: string;
	html_url?: string;
	commit?: {
		message?: string;
	};
}

interface CompareResponse {
	commits?: GitHubCommit[];
}

function normalizeVersion(value: string): string {
	return value.trim().replace(/^v/i, "");
}

function buildComparePairs(fromVersion: string, toVersion: string) {
	const from = normalizeVersion(fromVersion);
	const to = normalizeVersion(toVersion);

	const candidates = [
		[`v${from}`, `v${to}`],
		[from, to],
		[`v${from}`, to],
		[from, `v${to}`],
	];

	const seen = new Set<string>();
	const uniquePairs: Array<[string, string]> = [];

	for (const [candidateFrom, candidateTo] of candidates) {
		const key = `${candidateFrom}...${candidateTo}`;
		if (seen.has(key)) {
			continue;
		}

		seen.add(key);
		uniquePairs.push([candidateFrom, candidateTo]);
	}

	return uniquePairs;
}

function splitCommitMessage(message: string): {
	summary: string;
	details: string;
} {
	const lines = message.trim().split("\n");
	const summary = (lines[0] || "").trim();
	const details = lines.slice(1).join("\n").trim();
	return { summary, details };
}

function toEntry(commit: GitHubCommit): ChangelogEntry | null {
	const sha = typeof commit.sha === "string" ? commit.sha : "";
	const url = typeof commit.html_url === "string" ? commit.html_url : "";
	const message =
		typeof commit.commit?.message === "string" ? commit.commit.message : "";

	if (!sha || !url || !message.trim()) {
		return null;
	}

	const parsed = splitCommitMessage(message);
	return {
		sha,
		summary: parsed.summary || sha.slice(0, 7),
		details: parsed.details,
		url,
	};
}

function buildCompareUrl(fromRef: string, toRef: string): string {
	return `https://github.com/Gerrxt07/Haven/compare/${encodeURIComponent(fromRef)}...${encodeURIComponent(toRef)}`;
}

async function fetchCompareEntries(
	fromRef: string,
	toRef: string,
): Promise<ChangelogEntry[] | null> {
	const endpoint = `${GITHUB_API_BASE}/compare/${encodeURIComponent(fromRef)}...${encodeURIComponent(toRef)}`;
	const response = await fetch(endpoint, {
		headers: GITHUB_API_HEADERS,
	});

	if (response.status === 404) {
		return null;
	}

	if (!response.ok) {
		throw new Error(`compare request failed: ${response.status}`);
	}

	const payload = (await response.json()) as CompareResponse;
	const commits = Array.isArray(payload.commits) ? payload.commits : [];

	return commits
		.map((commit) => toEntry(commit))
		.filter((entry): entry is ChangelogEntry => entry !== null);
}

async function fetchLatestEntries(limit = 12): Promise<ChangelogEntry[]> {
	const endpoint = `${GITHUB_API_BASE}/commits?per_page=${limit}`;
	const response = await fetch(endpoint, {
		headers: GITHUB_API_HEADERS,
	});

	if (!response.ok) {
		throw new Error(`latest commits request failed: ${response.status}`);
	}

	const payload = (await response.json()) as GitHubCommit[];
	const commits = Array.isArray(payload) ? payload : [];
	return commits
		.map((commit) => toEntry(commit))
		.filter((entry): entry is ChangelogEntry => entry !== null);
}

export async function loadChangelog(
	fromVersion: string,
	toVersion: string,
): Promise<ChangelogData> {
	let compareFallbackUrl = GITHUB_COMMITS_URL;

	for (const [fromRef, toRef] of buildComparePairs(fromVersion, toVersion)) {
		compareFallbackUrl = buildCompareUrl(fromRef, toRef);
		const entries = await fetchCompareEntries(fromRef, toRef);
		if (entries) {
			return {
				entries,
				source: "compare",
				fallbackUrl: compareFallbackUrl,
			};
		}
	}

	const latestEntries = await fetchLatestEntries();
	return {
		entries: latestEntries,
		source: "latest",
		fallbackUrl: compareFallbackUrl,
	};
}

export function getChangelogFallbackUrl(
	fromVersion: string,
	toVersion: string,
): string {
	for (const [fromRef, toRef] of buildComparePairs(fromVersion, toVersion)) {
		return buildCompareUrl(fromRef, toRef);
	}

	return GITHUB_COMMITS_URL;
}
