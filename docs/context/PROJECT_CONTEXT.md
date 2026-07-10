# Project Context

## Purpose

Re:Start Quest is a job-search action restart engine for people returning to job-search routines after a career gap.

The project should not read as a general recruiting portal, mental-health counseling product, surveillance product, or motivation scoring tool. The MVP focuses on one product loop:

```text
onboarding -> generate today's quests -> record failure reason -> redesign into easier quest -> reflect on dashboard
```

## Current Repository State

This repository is still in a documentation-first stage. The current mainline contains product direction and code quality guardrails, but it does not yet contain a Spring Boot backend module, build file, test runner, database migration, or runtime configuration.

Backend work in this state should either:

- define API, domain, orchestration, and test contracts for the upcoming Spring Boot implementation; or
- explicitly report that executable server changes are blocked by the missing backend scaffold.

## MVP Backend Scope

- Authenticated user identity boundary.
- Onboarding profile save/read.
- Daily quest generation and read.
- Quest complete/fail transitions.
- Failure reason capture.
- Easier quest redesign after failure.
- Dashboard summary based on quest, failure, and redesign history.
- LLM JSON DTO validation and provider error classification.

## Out of Scope

- Real job-board crawling.
- Government policy eligibility decisions.
- Therapist, counselor, admin, or monitoring workflows.
- User willpower, risk, or compliance scoring.
- Secret handling in documentation or reports.

## QA Focus

QA should verify that each change supports the core restart loop and does not introduce wording or behavior that evaluates, monitors, or diagnoses the user.

