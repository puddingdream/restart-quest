import type { Quest } from "../shared/types.js";

export function renderQuestCard(quest: Quest, compact = false): string {
  const done = quest.status === "DONE";
  const failed = quest.status === "FAILED";
  const redesigned = Boolean(quest.parentQuestId);

  return `
    <article class="quest-card ${compact ? "compact" : ""} ${done ? "is-done" : ""} ${failed ? "is-failed" : ""}">
      <div class="card-meta">
        <span class="badge">${labelCategory(quest.category)}</span>
        <span>${quest.estimatedMinutes}분</span>
        ${redesigned ? "<span>더 쉬운 단계</span>" : ""}
      </div>
      <h2>${escapeHtml(quest.title)}</h2>
      <p>${escapeHtml(quest.description)}</p>
      <p class="criteria">${escapeHtml(quest.completionCriteria)}</p>
      <div class="card-actions">
        <button class="secondary" data-action="complete" data-quest-id="${escapeHtml(quest.id)}" ${done || failed ? "disabled" : ""}>완료</button>
        <a class="text-link" href="#/quests/${encodeURIComponent(quest.id)}/fail" aria-disabled="${done || failed}">실패 이유</a>
      </div>
    </article>
  `;
}

export function labelCategory(category: Quest["category"]): string {
  const labels: Record<Quest["category"], string> = {
    RESUME: "이력서",
    JOB_SEARCH: "공고",
    INTERVIEW: "면접",
    LEARNING: "학습",
    POLICY: "정책",
    ROUTINE: "루틴"
  };
  return labels[category];
}

export function option(value: string, selectedValue: string, label = value): string {
  return `<option value="${escapeHtml(value)}" ${selectedValue === value ? "selected" : ""}>${escapeHtml(label)}</option>`;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
