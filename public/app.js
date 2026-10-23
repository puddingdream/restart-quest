const reasonLabels = Object.freeze({
  time: "시간이 부족했어요",
  energy: "에너지가 부족했어요",
  too_hard: "할 일이 너무 어려웠어요",
  unclear: "무엇을 할지 명확하지 않았어요",
  other: "다른 이유가 있어요",
});

const statusLabels = Object.freeze({ pending: "다음 행동", completed: "완료", failed: "실패 기록" });
const summaryKeys = ["total", "pending", "completed", "failed", "redesigned"];
const form = document.getElementById("createQuestForm");
const main = document.getElementById("mainContent");
const errorBanner = document.getElementById("errorBanner");
const errorMessage = document.getElementById("errorMessage");
const nextActions = document.getElementById("nextActions");
const historyList = document.getElementById("historyList");
let busy = false;

function element(tag, className, value) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (value !== undefined) result.textContent = value;
  return result;
}

function button(label, className, onClick) {
  const result = element("button", className, label);
  result.type = "button";
  result.addEventListener("click", onClick);
  return result;
}

function setBusy(value) {
  busy = value;
  main.setAttribute("aria-busy", String(value));
  document.querySelectorAll("button, input, select, textarea").forEach((control) => {
    control.disabled = value;
  });
}

function showError(message) {
  errorMessage.textContent = message;
  errorBanner.hidden = false;
}

function clearError() {
  errorMessage.textContent = "";
  errorBanner.hidden = true;
}

function errorText(error) {
  return error instanceof Error ? error.message : "요청을 처리하지 못했습니다. 다시 시도해 주세요.";
}

async function api(path, body) {
  let response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error("서버에 연결할 수 없습니다. 연결을 확인하고 다시 시도해 주세요.");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message;
    throw new Error(typeof message === "string" && message ? message : "요청을 처리하지 못했습니다. 기록을 다시 확인해 주세요.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("서버 응답을 읽을 수 없습니다. 기록을 다시 불러와 주세요.");
  }
  return payload;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isQuest(value) {
  return isRecord(value)
    && typeof value.id === "string"
    && typeof value.rootId === "string"
    && (value.parentId === null || typeof value.parentId === "string")
    && typeof value.createdAt === "string"
    && Object.hasOwn(statusLabels, value.status)
    && Number.isInteger(value.availableMinutes) && value.availableMinutes >= 5 && value.availableMinutes <= 120
    && ["ready", "low_energy", "overwhelmed"].includes(value.currentState)
    && typeof value.title === "string"
    && typeof value.instruction === "string"
    && Number.isInteger(value.minutes) && value.minutes > 0
    && Number.isInteger(value.level) && value.level >= 0 && value.level <= 3
    && (value.parentId === null ? value.rootId === value.id && value.redesignReason === null
      : Object.hasOwn(reasonLabels, value.redesignReason))
    && (value.status === "completed" ? typeof value.completedAt === "string" : value.completedAt === null)
    && (value.status === "failed" ? typeof value.failedAt === "string" : value.failedAt === null)
    && (value.status === "failed" ? isRecord(value.failureReason)
      && Object.hasOwn(reasonLabels, value.failureReason.code)
      && typeof value.failureReason.note === "string" : value.failureReason === null);
}

function isSuggestion(value) {
  return isRecord(value)
    && typeof value.parentId === "string"
    && Number.isInteger(value.level) && value.level >= 0 && value.level <= 2
    && Number.isInteger(value.minutes) && value.minutes > 0
    && typeof value.title === "string"
    && typeof value.instruction === "string"
    && Object.hasOwn(reasonLabels, value.reasonCode)
    && typeof value.rationale === "string";
}

function assertDashboard(value) {
  if (!isRecord(value) || !isRecord(value.summary)
    || !summaryKeys.every((key) => Number.isSafeInteger(value.summary[key]) && value.summary[key] >= 0)
    || !Array.isArray(value.quests) || !value.quests.every(isQuest)
    || !Array.isArray(value.nextActions) || !value.nextActions.every((quest) => isQuest(quest) && quest.status === "pending")
    || !Array.isArray(value.suggestions) || !value.suggestions.every(isSuggestion)) {
    throw new Error("대시보드 응답 형식이 올바르지 않습니다. 다시 불러와 주세요.");
  }
  return value;
}

function localTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "시간 정보 없음";
  return new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function timeLine(label, value) {
  const line = element("p", "card-date");
  line.append(document.createTextNode(`${label} `));
  const time = element("time", "", localTime(value));
  time.dateTime = value;
  line.append(time);
  return line;
}

function relationship(quest, byId) {
  if (!quest.parentId) return null;
  const parent = byId.get(quest.parentId);
  const box = element("div", "relationship");
  box.append(element("strong", "", "원래 퀘스트 → 새 행동"));
  box.append(element("span", "", `${parent?.title ?? "이전 퀘스트"} → ${quest.title}`));
  if (Object.hasOwn(reasonLabels, quest.redesignReason)) {
    box.append(element("div", "", `다시 설계한 이유: ${reasonLabels[quest.redesignReason]}`));
  }
  return box;
}

function cardHeader(quest) {
  const meta = element("div", "card-meta");
  meta.append(element("span", `status-pill status-${quest.status}`, statusLabels[quest.status]));
  meta.append(element("span", "time-pill", `예상 ${quest.minutes}분`));
  return meta;
}

function failureForm(quest, toggle) {
  const failure = element("form", "failure-form");
  failure.id = `failure-${quest.id}`;
  failure.hidden = true;

  const reasonField = element("div", "field");
  const reasonLabel = element("label", "", "실패 이유");
  reasonLabel.htmlFor = `reason-${quest.id}`;
  const reason = element("select");
  reason.id = reasonLabel.htmlFor;
  reason.name = "reasonCode";
  reason.required = true;
  const placeholder = element("option", "", "이유를 선택해 주세요");
  placeholder.value = "";
  reason.append(placeholder);
  for (const [code, label] of Object.entries(reasonLabels)) {
    const option = element("option", "", label);
    option.value = code;
    reason.append(option);
  }
  reasonField.append(reasonLabel, reason);

  const noteField = element("div", "field");
  const noteLabel = element("label", "", "메모 (선택)");
  noteLabel.htmlFor = `note-${quest.id}`;
  const note = element("textarea");
  note.id = noteLabel.htmlFor;
  note.name = "reasonNote";
  note.placeholder = "예: 예상보다 오래 걸렸어요";
  noteField.append(noteLabel, note, element("p", "field-hint", "앞뒤 공백을 제외하고 최대 200자까지 적을 수 있어요."));

  const actions = element("div", "form-actions");
  const submit = element("button", "secondary-button", "실패 이유 저장하기");
  submit.type = "submit";
  const cancel = button("취소", "outline-button", () => {
    failure.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  });
  actions.append(submit, cancel);
  failure.append(reasonField, noteField, actions);
  failure.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) return;
    const reasonCode = reason.value;
    if (!Object.hasOwn(reasonLabels, reasonCode)) {
      showError("실패 이유를 선택해 주세요.");
      reason.focus();
      return;
    }
    const reasonNote = note.value.trim();
    if ([...reasonNote].length > 200) {
      showError("실패 이유 메모는 앞뒤 공백을 제외하고 200자 이하로 적어 주세요.");
      note.focus();
      return;
    }
    mutate(`/api/quests/${encodeURIComponent(quest.id)}/fail`, {
      reasonCode,
      reasonNote,
    }, (result) => `suggestion-${result.quest.id}`, `history-${quest.id}`);
  });
  return failure;
}

function actionCard(quest, byId) {
  const card = element("article", "quest-card action-card");
  card.id = `action-${quest.id}`;
  card.dataset.questId = quest.id;
  card.tabIndex = -1;
  card.append(cardHeader(quest), element("h3", "", quest.title), element("p", "quest-instruction", quest.instruction));
  const relation = relationship(quest, byId);
  if (relation) card.append(relation);
  card.append(timeLine("만든 시간", quest.createdAt));

  const actions = element("div", "card-actions");
  actions.append(button("완료하기", "secondary-button", () => {
    mutate(`/api/quests/${encodeURIComponent(quest.id)}/complete`, {}, (result) => `history-${result.quest.id}`);
  }));
  const failButton = button("실패 기록", "outline-button", () => {
    const expanded = failButton.getAttribute("aria-expanded") === "true";
    failButton.setAttribute("aria-expanded", String(!expanded));
    failure.hidden = expanded;
    if (!expanded) failure.querySelector("select").focus();
  });
  failButton.setAttribute("aria-expanded", "false");
  failButton.setAttribute("aria-controls", `failure-${quest.id}`);
  actions.append(failButton);
  const failure = failureForm(quest, failButton);
  card.append(actions, failure);
  return card;
}

function suggestionPanel(suggestion) {
  const panel = element("div", "suggestion-panel");
  panel.id = `suggestion-${suggestion.parentId}`;
  panel.tabIndex = -1;
  panel.append(element("p", "eyebrow", "더 작은 다음 단계"));
  panel.append(element("h4", "", `${suggestion.title} · ${suggestion.minutes}분`));
  panel.append(element("p", "", suggestion.instruction));
  panel.append(element("p", "", suggestion.rationale));
  panel.append(button("더 쉬운 퀘스트 만들기", "secondary-button", () => {
    mutate(`/api/quests/${encodeURIComponent(suggestion.parentId)}/redesign`, {}, (result) => `action-${result.quest.id}`);
  }));
  return panel;
}

function historyCard(quest, byId, byParent, suggestionByParent) {
  const card = element("article", "quest-card history-card");
  card.id = `history-${quest.id}`;
  card.dataset.questId = quest.id;
  card.tabIndex = -1;
  card.append(cardHeader(quest), element("h3", "", quest.title), element("p", "quest-instruction", quest.instruction));
  const relation = relationship(quest, byId);
  if (relation) card.append(relation);
  card.append(timeLine("만든 시간", quest.createdAt));
  if (quest.status === "completed" && quest.completedAt) card.append(timeLine("완료한 시간", quest.completedAt));
  if (quest.status === "failed") {
    if (quest.failedAt) card.append(timeLine("실패를 기록한 시간", quest.failedAt));
    const label = reasonLabels[quest.failureReason?.code] ?? "기록된 이유";
    const note = quest.failureReason?.note;
    card.append(element("p", "reason-detail", `실패 이유: ${label}${note ? ` · ${note}` : ""}`));
    if (byParent.has(quest.id)) {
      card.append(element("p", "minimum-note", "더 쉬운 퀘스트를 만들었습니다. 새 행동은 다음 행동과 실행 기록에서 확인할 수 있어요."));
    } else if (suggestionByParent.has(quest.id)) {
      card.append(suggestionPanel(suggestionByParent.get(quest.id)));
    } else if (quest.level === 0) {
      card.append(element("p", "minimum-note", "이미 가장 작은 단계입니다. 새 퀘스트를 만들어 보세요."));
    } else {
      card.append(element("p", "minimum-note", "제안을 불러오지 못했습니다. 기록을 다시 불러와 주세요."));
    }
  }
  return card;
}

function emptyState(message) {
  return element("p", "empty-state", message);
}

function renderUnavailable() {
  for (const key of summaryKeys) {
    document.getElementById(`summary${key[0].toUpperCase()}${key.slice(1)}`).textContent = "—";
  }
  nextActions.replaceChildren(emptyState("다음 행동을 불러오지 못했습니다. 기록 다시 불러오기를 눌러 주세요."));
  historyList.replaceChildren(emptyState("실행 기록을 불러오지 못했습니다. 기록 다시 불러오기를 눌러 주세요."));
}

function renderDashboard(dashboard) {
  for (const key of summaryKeys) {
    document.getElementById(`summary${key[0].toUpperCase()}${key.slice(1)}`).textContent = String(dashboard.summary[key]);
  }

  const byId = new Map(dashboard.quests.map((quest) => [quest.id, quest]));
  const byParent = new Map(dashboard.quests.filter((quest) => quest.parentId).map((quest) => [quest.parentId, quest]));
  const suggestionByParent = new Map(dashboard.suggestions.map((suggestion) => [suggestion.parentId, suggestion]));
  nextActions.replaceChildren(...(dashboard.nextActions.length
    ? dashboard.nextActions.map((quest) => actionCard(quest, byId))
    : [emptyState("아직 다음 행동이 없어요. 위에서 새 퀘스트를 만들어 보세요.")]));
  historyList.replaceChildren(...(dashboard.quests.length
    ? dashboard.quests.map((quest) => historyCard(quest, byId, byParent, suggestionByParent))
    : [emptyState("아직 실행 기록이 없어요. 첫 퀘스트를 만들어 보세요.")]));
}

function focusCard(id, fallbackId) {
  const target = document.getElementById(id) ?? (fallbackId && document.getElementById(fallbackId));
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function refreshDashboard() {
  if (busy) return;
  setBusy(true);
  clearError();
  try {
    renderDashboard(assertDashboard(await api("/api/dashboard")));
  } catch (error) {
    renderUnavailable();
    showError(errorText(error));
  } finally {
    setBusy(false);
  }
}

async function mutate(path, body, focusId, fallbackId) {
  if (busy) return;
  setBusy(true);
  clearError();
  let requestSucceeded = false;
  let targetId;
  try {
    const result = await api(path, body);
    requestSucceeded = true;
    if (!isQuest(result.quest)) throw new Error("서버 응답을 읽을 수 없습니다. 기록을 다시 불러와 주세요.");
    renderDashboard(assertDashboard(await api("/api/dashboard")));
    targetId = typeof focusId === "function" ? focusId(result) : focusId;
  } catch (error) {
    if (requestSucceeded) {
      renderUnavailable();
      showError(`기록 갱신에 실패했습니다. 저장 결과를 확인하려면 기록을 다시 불러와 주세요. ${errorText(error)}`);
    } else {
      showError(errorText(error));
    }
  } finally {
    setBusy(false);
  }
  if (targetId) focusCard(targetId, fallbackId);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (busy) return;
  const minutes = Number(document.getElementById("availableMinutes").value);
  const currentState = document.getElementById("currentState").value;
  if (!Number.isInteger(minutes) || minutes < 5 || minutes > 120) {
    showError("사용 가능한 시간은 5~120분 사이의 정수로 입력해 주세요.");
    document.getElementById("availableMinutes").focus();
    return;
  }
  if (!["ready", "low_energy", "overwhelmed"].includes(currentState)) {
    showError("지금 상태를 선택해 주세요.");
    document.getElementById("currentState").focus();
    return;
  }
  mutate("/api/quests", { availableMinutes: minutes, currentState }, (result) => `action-${result.quest.id}`);
});

document.getElementById("retryDashboard").addEventListener("click", refreshDashboard);
refreshDashboard();
