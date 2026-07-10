# GitHub Flow

## Purpose

This document defines the repository workflow for AgentFlow-backed Re:Start Quest tasks. It does not authorize direct production server changes.

## Before Work

Run:

```powershell
git status --short
git diff --stat
```

Meaning:

- `git status --short` checks modified and untracked files.
- `git diff --stat` summarizes the current diff.

Risk:

- Both commands are read-only.
- Do not print secret file contents.

## Branches

- Use the branch assigned by the orchestrator.
- Keep each PR focused on one task purpose.
- Do not mix unrelated frontend, backend, infrastructure, and documentation changes without explaining why.

## Commit and PR Evidence

Before publishing a task, prepare evidence for:

- changed files;
- design decisions;
- tests or verification commands;
- residual risks;
- QA and reviewer handoff points;
- artifact manifest;
- dispatch package;
- Slack report.

## Mock Provider

When the provider is `mock`, external GitHub uploads and Slack posting may be represented by local evidence files under `docs/artifacts/<work-item>/`. The orchestrator or CI owns external publishing when that integration is available.

