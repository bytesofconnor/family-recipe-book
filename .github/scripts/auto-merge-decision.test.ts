// @vitest-environment node

import { describe, expect, it } from "vitest";
import { decideDeploy, decideMerge } from "./auto-merge-decision.mjs";

const repo = "bytesofconnor/baking-addiction";

function mergeSnapshot(
  overrides: Partial<{
    headRepo: string;
    baseRepo: string;
    baseRef: string;
    draft: boolean;
  }> = {},
) {
  return {
    headRepo: repo,
    baseRepo: repo,
    baseRef: "main",
    draft: false,
    ...overrides,
  };
}

function pull(overrides: Partial<{
  state: "OPEN" | "CLOSED" | "MERGED";
  mergedAt: string | null;
  mergeCommitOid: string | null;
  mergedBy: string | null;
}> = {}) {
  return {
    state: "OPEN" as const,
    mergedAt: null,
    mergeCommitOid: null,
    mergedBy: null,
    ...overrides,
  };
}

describe("decideMerge", () => {
  it("merges a same-repo pull request", () => {
    expect(decideMerge(mergeSnapshot())).toEqual({
      merge: true,
      reason: "same repository",
    });
  });

  it("skips a fork", () => {
    expect(
      decideMerge(mergeSnapshot({ headRepo: "other/baking-addiction" })),
    ).toEqual({ merge: false, reason: "fork" });
  });

  it("skips a draft", () => {
    expect(decideMerge(mergeSnapshot({ draft: true }))).toEqual({
      merge: false,
      reason: "draft",
    });
  });

  it("skips a pull request whose base is not main", () => {
    expect(decideMerge(mergeSnapshot({ baseRef: "develop" }))).toEqual({
      merge: false,
      reason: "base is not main",
    });
  });
});

describe("decideDeploy", () => {
  const oid = "abc123";
  const checksUpdatedAt = "2026-10-23T15:00:00.000Z";

  it("deploys the merge commit when this run merged the pull request", () => {
    expect(
      decideDeploy({
        eventName: "pull_request",
        before: pull(),
        after: pull({
          state: "MERGED",
          mergedAt: "2026-10-23T15:01:00.000Z",
          mergeCommitOid: oid,
          mergedBy: "github-actions[bot]",
        }),
        checksUpdatedAt: null,
      }),
    ).toEqual({ sha: oid });
  });

  it("deploys when the merge is recorded as app/github-actions", () => {
    expect(
      decideDeploy({
        eventName: "pull_request",
        before: pull(),
        after: pull({
          state: "MERGED",
          mergedAt: "2026-10-23T15:01:00.000Z",
          mergeCommitOid: oid,
          mergedBy: "app/github-actions",
        }),
        checksUpdatedAt: null,
      }),
    ).toEqual({ sha: oid });

    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T15:01:00.000Z",
      mergeCommitOid: oid,
      mergedBy: "app/github-actions",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt,
      }),
    ).toEqual({ sha: oid });
  });

  it("deploys when workflow_run finds a token merge inside the checks window", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T15:01:00.000Z",
      mergeCommitOid: oid,
      mergedBy: "github-actions[bot]",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt,
      }),
    ).toEqual({ sha: oid });
  });

  it("deploys when the token merge is ninety seconds before checksUpdatedAt", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T14:58:30.000Z",
      mergeCommitOid: oid,
      mergedBy: "github-actions[bot]",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt,
      }),
    ).toEqual({ sha: oid });
  });

  it("does not deploy an already merged token commit from the pull_request event", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T15:01:00.000Z",
      mergeCommitOid: oid,
      mergedBy: "github-actions[bot]",
    });
    expect(
      decideDeploy({
        eventName: "pull_request",
        before: merged,
        after: merged,
        checksUpdatedAt,
      }),
    ).toEqual({ sha: "" });
  });

  it("does not deploy when a person already merged inside the checks window", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T15:01:00.000Z",
      mergeCommitOid: oid,
      mergedBy: "octocat",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt,
      }),
    ).toEqual({ sha: "" });
  });

  it("does not deploy a merge performed by a person", () => {
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: pull(),
        after: pull({
          state: "MERGED",
          mergedAt: "2026-10-23T15:01:00.000Z",
          mergeCommitOid: oid,
          mergedBy: "octocat",
        }),
        checksUpdatedAt,
      }),
    ).toEqual({ sha: "" });
  });

  it("does not deploy a token merge twenty minutes after checksUpdatedAt", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T15:20:00.000Z",
      mergeCommitOid: oid,
      mergedBy: "github-actions[bot]",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt,
      }),
    ).toEqual({ sha: "" });
  });

  it("does not deploy when checksUpdatedAt is missing for an already merged token commit", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T15:01:00.000Z",
      mergeCommitOid: oid,
      mergedBy: "github-actions[bot]",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt: null,
      }),
    ).toEqual({ sha: "" });
  });

  it("does not deploy when mergedAt is missing for an already merged token commit", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: null,
      mergeCommitOid: oid,
      mergedBy: "github-actions[bot]",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt,
      }),
    ).toEqual({ sha: "" });
  });

  it("does not deploy a token merge from a later re-run of PR Checks", () => {
    const merged = pull({
      state: "MERGED",
      mergedAt: "2026-10-23T15:01:00.000Z",
      mergeCommitOid: oid,
      mergedBy: "github-actions[bot]",
    });
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: merged,
        after: merged,
        checksUpdatedAt: "2026-10-23T16:00:00.000Z",
      }),
    ).toEqual({ sha: "" });
  });

  it("does not deploy while the pull request is still open", () => {
    expect(
      decideDeploy({
        eventName: "workflow_run",
        before: pull(),
        after: pull(),
        checksUpdatedAt,
      }),
    ).toEqual({ sha: "" });
  });
});
