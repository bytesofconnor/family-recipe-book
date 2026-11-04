/* global Buffer, process */
import { pathToFileURL } from "node:url";

/**
 * @typedef {"OPEN" | "CLOSED" | "MERGED"} PullStateName
 *
 * @typedef {{
 *   headRepo: string,
 *   baseRepo: string,
 *   baseRef: string,
 *   draft: boolean
 * }} MergeSnapshot
 *
 * @typedef {{ merge: boolean, reason: string }} MergeDecision
 *
 * @typedef {{
 *   state: PullStateName,
 *   mergedAt: string | null,
 *   mergeCommitOid: string | null,
 *   mergedBy: string | null
 * }} PullState
 *
 * @typedef {{
 *   eventName: "pull_request" | "workflow_run",
 *   before: PullState,
 *   after: PullState,
 *   checksUpdatedAt: string | null
 * }} DeploySnapshot
 *
 * @typedef {{ sha: string }} DeployDecision
 */

const TWO_MINUTES_MS = 2 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

/** GitHub records the Actions app under either of these logins. */
const ACTIONS_MERGE_ACTORS = new Set([
  "github-actions[bot]",
  "app/github-actions",
]);

/**
 * Same-repository pull requests to main merge. Forks stay open.
 * Drafts stay open until GitHub will accept auto-merge.
 * @param {MergeSnapshot} snapshot
 * @returns {MergeDecision}
 */
export function decideMerge(snapshot) {
  if (snapshot.baseRef !== "main") {
    return { merge: false, reason: "base is not main" };
  }
  if (snapshot.headRepo !== snapshot.baseRepo) {
    return { merge: false, reason: "fork" };
  }
  if (snapshot.draft) {
    return { merge: false, reason: "draft" };
  }
  return { merge: true, reason: "same repository" };
}

/**
 * @param {DeploySnapshot} snapshot
 * @returns {DeployDecision}
 */
export function decideDeploy(snapshot) {
  const sha = snapshot.after.mergeCommitOid ?? "";
  const mergedByActions =
    snapshot.after.state === "MERGED" &&
    ACTIONS_MERGE_ACTORS.has(snapshot.after.mergedBy ?? "") &&
    sha !== "";
  if (!mergedByActions) {
    return { sha: "" };
  }
  if (snapshot.before.state !== "MERGED") {
    return { sha };
  }
  if (
    snapshot.eventName === "workflow_run" &&
    mergedAfterChecks(snapshot.after.mergedAt, snapshot.checksUpdatedAt)
  ) {
    return { sha };
  }
  return { sha: "" };
}

/**
 * @param {string | null} mergedAt
 * @param {string | null} checksUpdatedAt
 * @returns {boolean}
 */
function mergedAfterChecks(mergedAt, checksUpdatedAt) {
  if (!mergedAt || !checksUpdatedAt) {
    return false;
  }
  const merged = Date.parse(mergedAt);
  const checks = Date.parse(checksUpdatedAt);
  if (Number.isNaN(merged) || Number.isNaN(checks)) {
    return false;
  }
  return (
    merged >= checks - TWO_MINUTES_MS && merged <= checks + FIFTEEN_MINUTES_MS
  );
}

const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  const command = process.argv[2];
  const raw = await readStdin();
  const input = JSON.parse(raw);
  if (command === "merge") {
    process.stdout.write(JSON.stringify(decideMerge(input)));
  } else if (command === "deploy") {
    process.stdout.write(JSON.stringify(decideDeploy(input)));
  } else {
    process.stderr.write("usage: auto-merge-decision.mjs merge|deploy\n");
    process.exit(2);
  }
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}
