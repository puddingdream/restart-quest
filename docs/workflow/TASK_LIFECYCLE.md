# Task Lifecycle

## States

```text
REQUESTED -> TRIAGED -> PLANNED -> ASSIGNED -> IN_REVIEW -> DONE
```

Blocked work may stop at any state when required context, repository access, or executable scaffolding is missing.

## Worker Responsibilities

For each assigned work item, the worker should:

1. Read required context files.
2. Check current git status and diff.
3. Make the smallest scoped change that satisfies acceptance criteria.
4. Run available verification commands.
5. Record local handoff artifacts when external systems are unavailable.
6. Report risks and next QA points.

## Dependency Order

Backend work is usually the first implementation step when API, data, or orchestration contracts are unclear. QA and reviewer work should depend on backend output for the same task unless the plan states otherwise.

## Blocked Reporting

Report a blocker instead of guessing when:

- the required context files are missing and cannot be created from existing repo policy;
- executable code is requested but the repo has no runnable project scaffold;
- a required external integration is unavailable in the provider environment;
- acceptance criteria are contradictory.

