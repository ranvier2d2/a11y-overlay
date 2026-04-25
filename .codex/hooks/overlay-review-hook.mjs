import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

const MAX_ENTRIES_TO_REPORT = 3;

function readStdinJson() {
  try {
    const raw = readFileSync(0, "utf8").trim();
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function findRepoRoot(cwd) {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return cwd;
  }
}

function readJsonFile(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function readJsonLines(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function extractDescriptorPathsFromText(text, cwd) {
  const paths = new Set();
  const source = String(text || "");
  const matches = source.matchAll(/(?:^|[\s"'([{])((?:\/|\.{1,2}\/|[A-Za-z0-9_.-]+\/)[^"'()<>{}\s]+-review(?:-review)?\.json)(?=$|[\s"',)\]}])/g);
  for (const match of matches) {
    const candidate = match[1];
    paths.add(isAbsolute(candidate) ? candidate : resolve(cwd, candidate));
  }
  return [...paths];
}

function normalizeEntry(entry, cwd) {
  const descriptorPath = entry?.descriptorPath
    ? (isAbsolute(entry.descriptorPath) ? entry.descriptorPath : resolve(cwd, entry.descriptorPath))
    : null;
  if (!descriptorPath) return null;
  return {
    ...entry,
    descriptorPath,
    inspectionTargetPath: entry.inspectionTargetPath
      ? (isAbsolute(entry.inspectionTargetPath) ? entry.inspectionTargetPath : resolve(dirname(descriptorPath), entry.inspectionTargetPath))
      : null
  };
}

function descriptorEntry(path) {
  const descriptor = readJsonFile(path, null);
  if (!descriptor?.requiresVisualReview) return null;
  return normalizeEntry({
    ...descriptor,
    descriptorPath: path
  }, dirname(path));
}

function reviewArtifactsExist(entry) {
  if (!entry?.descriptorPath || !existsSync(entry.descriptorPath)) return false;
  const inspectionTargetPath = entry.inspectionTargetPath || entry.previewArtifacts?.previewImagePath;
  return !inspectionTargetPath || existsSync(inspectionTargetPath);
}

function reviewEntryKey(entry) {
  const generation = entry.generatedAt || entry.enqueuedAt || (() => {
    try {
      return String(statSync(entry.descriptorPath).mtimeMs);
    } catch {
      return "unknown";
    }
  })();
  return `${entry.descriptorPath}::${generation}`;
}

function collectPendingReviews({ cwd, repoRoot, payload, state }) {
  const queuePath = process.env.CODEX_OVERLAY_REVIEW_QUEUE_PATH || join(repoRoot, ".codex", "state", "overlay-review-queue.jsonl");
  const queueEntries = readJsonLines(queuePath)
    .map((entry) => normalizeEntry(entry, cwd))
    .filter(reviewArtifactsExist);

  const responseText = [
    payload?.tool_input?.command,
    typeof payload?.tool_response === "string" ? payload.tool_response : JSON.stringify(payload?.tool_response || "")
  ].join("\n");
  const descriptorEntries = extractDescriptorPathsFromText(responseText, cwd)
    .map((path) => descriptorEntry(path))
    .filter(reviewArtifactsExist);

  const byDescriptor = new Map();
  for (const entry of [...queueEntries, ...descriptorEntries]) {
    if (entry.requiresVisualReview !== true) continue;
    const key = reviewEntryKey(entry);
    if (state.notifiedDescriptorKeys?.includes(key)) continue;
    byDescriptor.set(key, entry);
  }
  return [...byDescriptor.values()];
}

function writeState(path, state) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function formatReviewMessage(entries) {
  const visible = entries.slice(0, MAX_ENTRIES_TO_REPORT);
  const primary = visible[0];
  const lines = [
    "Overlay visual review is required before applying the planned annotation placement.",
    "",
    `Open this image with the local image viewer: ${primary.inspectionTargetPath || primary.previewArtifacts?.previewImagePath}`,
    `Review descriptor: ${primary.descriptorPath}`,
    `Confidence: ${primary.confidence || "unknown"}`,
    `Suggested next action: ${primary.suggestedNextAction || "inspect-preview"}`,
    "",
    "After inspecting the image, choose one of: accept the plan, retry/reflow placement, or downgrade to a safer renderer."
  ];

  if (visible.length > 1) {
    lines.push("", "Additional pending overlay reviews:");
    for (const entry of visible.slice(1)) {
      lines.push(`- ${entry.inspectionTargetPath || entry.previewArtifacts?.previewImagePath} (${entry.confidence || "unknown"})`);
    }
  }

  if (entries.length > visible.length) {
    lines.push(`- ${entries.length - visible.length} more pending review(s) are queued.`);
  }

  return lines.join("\n");
}

const payload = readStdinJson();
const cwd = payload.cwd || process.cwd();
const repoRoot = findRepoRoot(cwd);
const statePath = join(repoRoot, ".codex", "state", "overlay-review-hook-state.json");
const state = readJsonFile(statePath, { notifiedDescriptorKeys: [] });
state.notifiedDescriptorKeys = Array.isArray(state.notifiedDescriptorKeys)
  ? state.notifiedDescriptorKeys
  : (Array.isArray(state.notifiedDescriptorPaths) ? state.notifiedDescriptorPaths : []);
const pending = collectPendingReviews({ cwd, repoRoot, payload, state });

if (!pending.length) {
  process.exit(0);
}

const message = formatReviewMessage(pending);
const notifiedDescriptorKeys = [
  ...new Set([
    ...(state.notifiedDescriptorKeys || []),
    ...pending.map((entry) => reviewEntryKey(entry))
  ])
];

writeState(statePath, {
  ...state,
  notifiedDescriptorKeys,
  lastNotificationAt: new Date().toISOString()
});

process.stdout.write(`${JSON.stringify({
  decision: "block",
  reason: message,
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: message
  }
})}\n`);
