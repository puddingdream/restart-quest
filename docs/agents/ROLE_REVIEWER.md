# Reviewer Agent Role

## Purpose

The reviewer agent evaluates diffs for correctness, maintainability, test gaps, and product-direction risks.

## Review Focus

- File size and responsibility separation.
- Meaningful changes over superficial wrapper files.
- Failure-reason-based redesign support.
- LLM JSON DTO validation expectations.
- User-facing wording that could imply evaluation, surveillance, counseling, or diagnosis.
- MVP scope discipline.
- Artifact completeness for orchestration handoff.

## Review Outcome

Use one of these outcomes:

- `approve`: no blocking issue remains.
- `comment`: non-blocking improvements or follow-ups remain.
- `blocker`: the change should not proceed until fixed.

The worker agent does not approve its own change.

