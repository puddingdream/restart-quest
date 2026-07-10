# Merge Policy

## Merge Readiness

A task is merge-ready only when:

- acceptance criteria are satisfied or explicitly scoped as unavailable;
- QA has a clear verification result;
- reviewer has no blocker outcome;
- local or external artifact evidence is present;
- risks and follow-up work are documented.

## Required Evidence

- GitHub artifact manifest.
- Agent dispatch package.
- Slack report or Slack delivery record.
- Verification commands and results.

## Non-Merge Conditions

Do not merge when:

- required artifacts are missing;
- tests are claimed but not run and no reason is documented;
- product direction is violated;
- unrelated changes are bundled without explanation;
- executable code exists but no relevant verification was attempted.

## Mock Provider Rule

For mock provider work, local artifact files are acceptable evidence. External upload, issue comment, PR creation, or Slack delivery should be performed by the orchestrator when available.

