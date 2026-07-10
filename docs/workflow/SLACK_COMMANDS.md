# Slack Commands Workflow

## Purpose

Slack commands can create AgentFlow tasks. The command text may be brief or ambiguous, so the worker must preserve the original text and document the inferred scope.

## Required Handling

For each Slack-originated task:

- keep the original channel and command text in the task or artifact evidence;
- use linked task, issue, branch, PR, and thread metadata when available;
- do not infer product behavior beyond the available context;
- document ambiguity as a risk when the command does not specify a concrete feature;
- produce a Slack report file when direct posting is unavailable.

## Report Contents

A Slack report should include:

- status;
- work item;
- summary;
- changed files;
- verification result;
- known risks;
- next QA/reviewer action.

## Current Limitation

In mock provider runs, local `slack-report.md` evidence stands in for external Slack delivery. The orchestrator or CI is responsible for posting it to the linked thread if Slack integration is enabled.

