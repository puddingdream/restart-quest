import assert from "node:assert/strict";
import { buildDashboardSummary } from "../dist/features/dashboard/dashboardModel.js";
import { createDemoProfile, validateProfile } from "../dist/features/onboarding/onboardingModel.js";
import {
  completeQuest,
  failAndRedesignQuest,
  generateTodayQuests,
  saveProfile,
  startSession
} from "../dist/features/quests/questFlow.js";

const now = new Date("2026-07-14T01:00:00.000Z");
let state = startSession({ sessionStarted: false, quests: [], failures: [] });
const profile = createDemoProfile();

assert.deepEqual(validateProfile(profile), []);

state = saveProfile(state, profile);
state = generateTodayQuests(state, now);

assert.equal(state.quests.filter((quest) => !quest.parentQuestId).length, 3);
assert.equal(state.quests.every((quest) => quest.estimatedMinutes >= 5 && quest.estimatedMinutes <= 30), true);

const resumeQuest = state.quests.find((quest) => quest.category === "RESUME");
assert.ok(resumeQuest);

state = failAndRedesignQuest(
  state,
  resumeQuest.id,
  "UNCLEAR_WHAT_TO_WRITE",
  "지원동기에 어떤 경험을 넣어야 할지 모르겠음",
  now
);

const redesigned = state.quests.filter((quest) => quest.parentQuestId === resumeQuest.id);
assert.equal(state.failures.length, 1);
assert.equal(redesigned.length, 2);
assert.equal(redesigned.every((quest) => quest.difficulty === "TINY"), true);
assert.equal(redesigned.every((quest) => quest.estimatedMinutes <= resumeQuest.estimatedMinutes), true);

const nextQuest = redesigned[0];
state = completeQuest(state, nextQuest.id, now);

const dashboard = buildDashboardSummary(state, now);
assert.equal(dashboard.failedQuests, 1);
assert.equal(dashboard.redesignedQuests, 2);
assert.equal(dashboard.doneQuests, 1);
assert.ok(dashboard.nextQuest);

console.log("smoke passed: onboarding -> quests -> failure redesign -> dashboard");
