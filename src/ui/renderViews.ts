import { buildDashboardSummary } from "../features/dashboard/dashboardModel.js";
import { createDemoProfile, energyLabels } from "../features/onboarding/onboardingModel.js";
import {
  failureReasonHints,
  failureReasonLabels,
  todayKey
} from "../features/quests/questFlow.js";
import type { AppState, FailureReason, Quest } from "../shared/types.js";
import { escapeHtml, labelCategory, option, renderQuestCard } from "./viewHelpers.js";

export function renderAppShell(state: AppState, route: string): string {
  const page = route.startsWith("/quests/") && route.endsWith("/fail")
    ? renderFailurePage(state, route.split("/")[2])
    : renderRoute(state, route);

  return `
    <header class="topbar">
      <a class="brand" href="#/today" aria-label="Re:Start Quest 홈">
        <span class="brand-mark">R</span>
        <span>Re:Start Quest</span>
      </a>
      <nav class="nav" aria-label="주요 화면">
        <a href="#/onboarding">온보딩</a>
        <a href="#/today">오늘</a>
        <a href="#/dashboard">대시보드</a>
      </nav>
    </header>
    <main>${page}</main>
  `;
}

function renderRoute(state: AppState, route: string): string {
  if (route === "/login") return renderLoginPage();
  if (route === "/onboarding") return renderOnboardingPage(state);
  if (route === "/dashboard") return renderDashboardPage(state);
  return renderTodayPage(state);
}

function renderLoginPage(): string {
  return `
    <section class="screen intro-screen">
      <div class="intro-copy">
        <p class="eyebrow">구직 행동 재진입 엔진</p>
        <h1>오늘 다시 시작할 수 있는 작은 행동부터 정합니다.</h1>
        <p class="lead">취업 준비 전체를 한 번에 해결하려 하지 않고, 오늘 가능한 에너지에 맞춰 10~30분 퀘스트로 나눕니다.</p>
      </div>
      <form class="panel login-panel" data-form="login">
        <label>
          이메일
          <input type="email" value="demo@restart.quest" aria-label="이메일" />
        </label>
        <label>
          비밀번호
          <input type="password" value="password" aria-label="비밀번호" />
        </label>
        <button class="primary" type="submit">개발용으로 시작</button>
      </form>
    </section>
  `;
}

function renderOnboardingPage(state: AppState): string {
  const profile = state.profile ?? createDemoProfile();

  return `
    <section class="screen">
      <div class="section-head">
        <p class="eyebrow">온보딩</p>
        <h1>퀘스트 난이도를 맞추기 위한 정보만 입력합니다.</h1>
      </div>
      <form class="form-grid" data-form="onboarding">
        <label>거주 지역<input name="region" value="${escapeHtml(profile.region)}" required /></label>
        <label>희망 직무<input name="desiredJob" value="${escapeHtml(profile.desiredJob)}" required /></label>
        <label>
          희망 근무 형태
          <select name="desiredWorkType">
            ${option("정규직", profile.desiredWorkType)}
            ${option("계약직", profile.desiredWorkType)}
            ${option("인턴", profile.desiredWorkType)}
            ${option("원격", profile.desiredWorkType)}
          </select>
        </label>
        <label>취업 공백 기간<input name="careerGapMonths" type="number" min="0" value="${profile.careerGapMonths}" /></label>
        <label>
          이력서 보유 여부
          <select name="hasResume">
            <option value="true" ${profile.hasResume ? "selected" : ""}>있음</option>
            <option value="false" ${!profile.hasResume ? "selected" : ""}>아직 없음</option>
          </select>
        </label>
        <label>
          면접 경험
          <select name="interviewExperienceLevel">
            ${option("NONE", profile.interviewExperienceLevel, "없음")}
            ${option("LOW", profile.interviewExperienceLevel, "적음")}
            ${option("MEDIUM", profile.interviewExperienceLevel, "보통")}
          </select>
        </label>
        <label class="span-2">관심 분야<input name="interests" value="${escapeHtml(profile.interests.join(", "))}" required /></label>
        <fieldset class="span-2 segmented">
          <legend>오늘 가능한 에너지</legend>
          ${(["LOW", "MEDIUM", "HIGH"] as const)
            .map((level) => `
              <label>
                <input type="radio" name="defaultEnergyLevel" value="${level}" ${profile.defaultEnergyLevel === level ? "checked" : ""} />
                <span>${energyLabels[level]}</span>
              </label>
            `)
            .join("")}
        </fieldset>
        <div class="form-actions span-2">
          <button class="secondary" type="button" data-action="fill-demo">데모 값 입력</button>
          <button class="primary" type="submit">저장하고 오늘 퀘스트 보기</button>
        </div>
        <div class="form-errors span-2" role="alert" aria-live="polite"></div>
      </form>
    </section>
  `;
}

function renderTodayPage(state: AppState): string {
  const todayQuests = getTodayQuests(state);
  const summary = buildDashboardSummary(state);

  return `
    <section class="screen">
      <div class="section-head with-action">
        <div>
          <p class="eyebrow">오늘의 퀘스트</p>
          <h1>오늘 할 수 있는 작은 행동 3개</h1>
        </div>
        <button class="primary" data-action="generate">퀘스트 생성</button>
      </div>
      <div class="summary-strip" aria-label="오늘 진행 요약">
        <span>완료 ${summary.doneQuests}/${Math.max(summary.totalQuests, todayQuests.length)}</span>
        <span>재설계 ${summary.redesignedQuests}</span>
        <span>다음 행동 ${summary.nextQuest ? escapeHtml(summary.nextQuest.title) : "생성 후 표시"}</span>
      </div>
      <div class="quest-grid">
        ${todayQuests.length === 0 ? renderEmptyQuestState() : todayQuests.map((quest) => renderQuestCard(quest)).join("")}
      </div>
    </section>
  `;
}

function renderFailurePage(state: AppState, questId: string): string {
  const quest = state.quests.find((item) => item.id === questId);
  if (!quest) return renderNotFound("퀘스트를 찾을 수 없습니다.");

  return `
    <section class="screen narrow">
      <div class="section-head">
        <p class="eyebrow">실패 이유 입력</p>
        <h1>상황에 맞춰 더 쉬운 단계로 다시 나눕니다.</h1>
      </div>
      <article class="quest-card compact">
        <span class="badge">${labelCategory(quest.category)}</span>
        <h2>${escapeHtml(quest.title)}</h2>
        <p>${escapeHtml(quest.description)}</p>
      </article>
      <form class="panel" data-form="failure" data-quest-id="${escapeHtml(quest.id)}">
        <fieldset class="reason-list">
          <legend>오늘 막힌 이유</legend>
          ${Object.entries(failureReasonLabels)
            .map(([reason, label], index) => `
              <label>
                <input type="radio" name="reason" value="${reason}" ${index === 0 ? "checked" : ""} />
                <span>
                  <strong>${label}</strong>
                  <small>${failureReasonHints[reason as FailureReason]}</small>
                </span>
              </label>
            `)
            .join("")}
        </fieldset>
        <label>
          메모 선택 입력
          <textarea name="memo" rows="3" placeholder="예: 지원동기에 어떤 경험을 넣어야 할지 모르겠음"></textarea>
        </label>
        <button class="primary" type="submit">더 쉬운 퀘스트 받기</button>
      </form>
    </section>
  `;
}

function renderDashboardPage(state: AppState): string {
  const summary = buildDashboardSummary(state);

  return `
    <section class="screen">
      <div class="section-head">
        <p class="eyebrow">대시보드</p>
        <h1>오늘 진행 상태와 다음 행동</h1>
      </div>
      <div class="metrics" aria-label="오늘 진행률">
        <div><strong>${summary.doneQuests}</strong><span>완료</span></div>
        <div><strong>${summary.failedQuests}</strong><span>실패 기록</span></div>
        <div><strong>${summary.redesignedQuests}</strong><span>재설계 행동</span></div>
      </div>
      <section class="next-action">
        <p class="eyebrow">다음 행동</p>
        ${summary.nextQuest ? renderQuestCard(summary.nextQuest, true) : "<p>오늘 퀘스트를 생성하면 바로 실행할 행동이 표시됩니다.</p>"}
      </section>
      <section class="timeline">
        <h2>재설계 기록</h2>
        ${summary.recentFailures.length === 0
          ? "<p>아직 재설계 기록이 없습니다.</p>"
          : summary.recentFailures.map((entry) => `
            <article>
              <strong>${escapeHtml(entry.original?.title ?? "이전 퀘스트")}</strong>
              <p>${failureReasonLabels[entry.failure.reason]}</p>
              <ul>${entry.redesigned.map((quest) => `<li>${escapeHtml(quest.title)}</li>`).join("")}</ul>
            </article>
          `).join("")}
      </section>
    </section>
  `;
}

function getTodayQuests(state: AppState): Quest[] {
  const summary = buildDashboardSummary(state);
  const questDate = todayKey();
  const failedIds = new Set(state.failures.map((failure) => failure.questId));

  return state.quests
    .filter((quest) => quest.questDate === questDate)
    .filter((quest) => quest.status !== "FAILED" || failedIds.has(quest.id))
    .sort((left, right) => {
      if (left.status === "TODO" && right.status !== "TODO") return -1;
      if (right.status === "TODO" && left.status !== "TODO") return 1;
      return left.sortOrder - right.sortOrder;
    })
    .slice(0, Math.max(3, summary.totalQuests + summary.redesignedQuests));
}

function renderEmptyQuestState(): string {
  return `
    <div class="empty-state">
      <h2>아직 오늘 퀘스트가 없습니다.</h2>
      <p>온보딩 정보를 기준으로 오늘 가능한 작은 행동 3개를 만듭니다.</p>
    </div>
  `;
}

function renderNotFound(message: string): string {
  return `<section class="screen narrow"><p>${escapeHtml(message)}</p><a class="text-link" href="#/today">오늘 화면으로 이동</a></section>`;
}
