import {
  createDemoProfile,
  normalizeInterests,
  validateProfile
} from "./features/onboarding/onboardingModel.js";
import {
  completeQuest,
  failAndRedesignQuest,
  generateTodayQuests,
  saveProfile,
  startSession
} from "./features/quests/questFlow.js";
import { clearState, loadState, storeState } from "./shared/storage.js";
import type { AppState, FailureReason, OnboardingProfile } from "./shared/types.js";
import { renderAppShell } from "./ui/renderViews.js";

const appElement = document.querySelector<HTMLDivElement>("#app");

if (!appElement) {
  throw new Error("App root is missing");
}

const appRoot: HTMLDivElement = appElement;
let state = loadState();

window.addEventListener("hashchange", render);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    state = clearState();
    navigate("/login");
  }
});

render();

function render(): void {
  const route = currentRoute();

  if (!state.sessionStarted && route !== "/login") {
    navigate("/login");
    return;
  }

  if (state.sessionStarted && !state.profile && route !== "/onboarding") {
    navigate("/onboarding");
    return;
  }

  appRoot.innerHTML = renderAppShell(state, route);
  bindEvents(route);
}

function bindEvents(route: string): void {
  appRoot.querySelector<HTMLFormElement>('[data-form="login"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    state = startSession(state);
    persistAndNavigate(state.profile ? "/today" : "/onboarding");
  });

  appRoot.querySelector<HTMLButtonElement>('[data-action="fill-demo"]')?.addEventListener("click", () => {
    state = saveProfile(startSession(state), createDemoProfile());
    persistAndNavigate("/onboarding");
  });

  appRoot.querySelector<HTMLFormElement>('[data-form="onboarding"]')?.addEventListener("submit", submitOnboarding);
  appRoot.querySelector<HTMLButtonElement>('[data-action="generate"]')?.addEventListener("click", () => {
    state = generateTodayQuests(state);
    persistAndNavigate("/today");
  });

  appRoot.querySelectorAll<HTMLButtonElement>('[data-action="complete"]').forEach((button) => {
    button.addEventListener("click", () => {
      state = completeQuest(state, button.dataset.questId ?? "");
      persistAndNavigate(route);
    });
  });

  appRoot.querySelector<HTMLFormElement>('[data-form="failure"]')?.addEventListener("submit", submitFailure);
}

function submitOnboarding(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const profile = profileFromForm(new FormData(form));
  const errors = validateProfile(profile);
  const errorBox = form.querySelector<HTMLDivElement>(".form-errors");

  if (errors.length > 0) {
    if (errorBox) errorBox.textContent = errors.join(" ");
    return;
  }

  state = generateTodayQuests(saveProfile(startSession(state), profile));
  persistAndNavigate("/today");
}

function submitFailure(event: SubmitEvent): void {
  event.preventDefault();
  const form = event.currentTarget as HTMLFormElement;
  const data = new FormData(form);
  const questId = form.dataset.questId ?? "";
  const reason = data.get("reason") as FailureReason;
  const memo = String(data.get("memo") ?? "");

  state = failAndRedesignQuest(state, questId, reason, memo);
  persistAndNavigate("/dashboard");
}

function profileFromForm(data: FormData): OnboardingProfile {
  return {
    region: String(data.get("region") ?? "").trim(),
    desiredJob: String(data.get("desiredJob") ?? "").trim(),
    desiredWorkType: String(data.get("desiredWorkType") ?? "").trim(),
    careerGapMonths: Number(data.get("careerGapMonths") ?? 0),
    hasResume: data.get("hasResume") === "true",
    interviewExperienceLevel: data.get("interviewExperienceLevel") as OnboardingProfile["interviewExperienceLevel"],
    interests: normalizeInterests(String(data.get("interests") ?? "")),
    defaultEnergyLevel: data.get("defaultEnergyLevel") as OnboardingProfile["defaultEnergyLevel"]
  };
}

function persistAndNavigate(route: string): void {
  storeState(state);
  navigate(route);
}

function navigate(route: string): void {
  window.location.hash = route;
  render();
}

function currentRoute(): string {
  return window.location.hash.replace(/^#/, "") || "/login";
}
