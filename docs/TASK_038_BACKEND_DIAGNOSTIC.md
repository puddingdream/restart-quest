# TASK-038 Backend Diagnostic

## Request

Original Slack command:

```text
뭐가문제야?
```

Linked task metadata identifies:

- Task: `TASK-038`
- Work item: `TASK-038-01-backend`
- Issue: `https://github.com/puddingdream/restart-quest/issues/7`
- Compare link: `https://github.com/puddingdream/restart-quest/compare/main...agentflow%2Ftask-038-%EB%AD%90%EA%B0%80%EB%AC%B8%EC%A0%9C%EC%95%BC?expand=1`
- Slack thread: `slack://C0BFADNB6HW/1783679791.046369`

## What Is Wrong

The backend worker found no executable Spring Boot backend in the current mainline. The repository only contains product and quality documents. The task dispatch also references role and workflow context files that are not present in the current branch.

Because of that, a server code change or unit test run is not available yet. The immediate backend/orchestration issue is missing task context and handoff evidence, not a runtime backend defect.

## Backend Scope Implemented

This work item implements the smallest safe backend-side scope:

- adds missing AgentFlow context documents needed by backend, QA, and reviewer agents;
- records the repository constraint that executable backend tests are unavailable until a Spring Boot scaffold exists;
- creates local GitHub artifact, agent dispatch package, and Slack report evidence for `TASK-038-01-backend`;
- keeps the product scope aligned with the Re:Start Quest restart-loop direction.

## QA Points

QA should verify:

- all required context files referenced by the dispatch exist;
- `docs/artifacts/TASK-038-01-backend/` contains the three required evidence files;
- JSON artifact files parse;
- reports clearly state that no executable backend module exists;
- no new wording frames the product as counseling, surveillance, or user evaluation.

## Next Backend Step

The next backend implementation task should scaffold the Spring Boot module before requesting code-level API, DB, or service tests.

