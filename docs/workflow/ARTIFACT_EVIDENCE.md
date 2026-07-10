# Artifact Evidence

## Purpose

AgentFlow tasks need handoff evidence even when external GitHub artifact upload or Slack posting is unavailable.

## Local Evidence Location

Use:

```text
docs/artifacts/<work-item>/
```

## Expected Files

- `github-artifact-manifest.json`: files included in the handoff and external publish status.
- `agent-dispatch-package.json`: work item, role, scope, context, and acceptance criteria.
- `slack-report.md`: concise report for the linked Slack thread.

## Validation

At minimum, verify that all expected files exist and that JSON files parse successfully.

