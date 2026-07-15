import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const requiredFiles = [
  "package.json",
  "index.html",
  "src/App.tsx",
  "src/features/onboarding/OnboardingPage.tsx",
  "src/features/onboarding/hooks/useOnboardingForm.ts",
  "src/features/quests/TodayQuestPage.tsx",
  "src/features/quests/components/FailureReasonPanel.tsx",
  "src/features/quests/services/mockQuestService.ts",
  "src/features/dashboard/DashboardPage.tsx",
  "src/features/dashboard/dashboardModel.ts",
  "src/styles.css",
];

for (const file of requiredFiles) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Missing required file: ${file}`);
  }
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (!packageJson.scripts?.smoke || !packageJson.scripts?.build) {
  throw new Error("package.json must expose smoke and build scripts.");
}

const sourceText = requiredFiles
  .filter((file) => file.endsWith(".tsx") || file.endsWith(".ts") || file.endsWith(".css"))
  .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");

const expectedTerms = [
  "generateDailyQuests",
  "redesignQuest",
  "FailureReasonPanel",
  "buildDashboardSummary",
  "NOT_SURE_WHAT_TO_WRITE",
  "LOW_ENERGY",
];

for (const term of expectedTerms) {
  if (!sourceText.includes(term)) {
    throw new Error(`Expected Slice 1 term was not found: ${term}`);
  }
}

const blockedCopy = ["의지 점수", "위험 점수", "치료", "상담"];
for (const copy of blockedCopy) {
  if (sourceText.includes(copy)) {
    throw new Error(`Blocked user-facing copy found: ${copy}`);
  }
}

console.log("smoke ok: Slice 1 frontend files and core flow terms are present.");
