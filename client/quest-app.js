const FIELD_IDS = {
  availableMinutes: ['available-minutes', 'minutes-error'],
  energy: ['energy', 'energy-error'],
};
const FAILURE_REASONS = {
  time_shortage: '시간이 부족했어요',
  low_energy: '지금은 에너지가 부족했어요',
  unclear_start: '어디서 시작할지 막막했어요',
};
const REQUEST_TIMEOUT_MS = 7000;

function element(document, id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing UI element: ${id}`);
  return node;
}

function messageFrom(body, fallback) {
  return typeof body?.error?.message === 'string' && body.error.message.trim()
    ? body.error.message : fallback;
}

async function readResponse(response) {
  let body;
  try {
    body = await response.json();
  } catch {
    const error = new Error('서버 응답을 확인할 수 없습니다. 저장 목록을 확인해 주세요.');
    error.network = true;
    throw error;
  }
  if (!response.ok) {
    const error = new Error(messageFrom(body, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    error.fields = body?.error?.fields ?? {};
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }
  return body;
}

export function createQuestApi(fetchRequest, requestTimeoutMs = REQUEST_TIMEOUT_MS) {
  async function fetchJson(path = '/api/quests', options) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response;
    try {
      try {
        response = await fetchRequest(path, { ...options, signal: controller.signal });
      } catch {
        const error = new Error('서버에 연결할 수 없습니다. 저장 목록을 확인해 주세요.');
        error.network = true;
        throw error;
      }
      return await readResponse(response);
    } catch (error) {
      if (!controller.signal.aborted) throw error;
      const timeout = new Error('서버 응답이 늦어지고 있습니다. 저장 목록을 확인해 주세요.');
      timeout.network = true;
      throw timeout;
    } finally {
      clearTimeout(timer);
    }
  }
  return {
    async list() {
      const body = await fetchJson('/api/quests', { headers: { Accept: 'application/json' } });
      if (!Array.isArray(body?.quests)) throw new Error('저장 목록의 형식을 확인할 수 없습니다.');
      return body.quests;
    },
    async create(input) {
      const body = await fetchJson('/api/quests', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!body?.quest || typeof body.quest.id !== 'string') {
        throw new Error('생성 결과의 형식을 확인할 수 없습니다.');
      }
      return body.quest;
    },
    async transition(id, action, input = {}) {
      const body = await fetchJson(`/api/quests/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const quest = body?.quest;
      const valid = quest && typeof quest.id === 'string' &&
        (action === 'redesign' ? quest.parentQuestId === id && quest.status === 'pending'
          : quest.id === id && quest.status === (action === 'complete' ? 'completed' : 'failed'));
      if (!valid) throw new Error('확정 결과의 형식을 확인할 수 없습니다. 목록을 다시 확인해 주세요.');
      return quest;
    },
    async history(id) {
      const body = await fetchJson(`/api/quests/${encodeURIComponent(id)}/history`, {
        headers: { Accept: 'application/json' },
      });
      if (typeof body?.rootQuestId !== 'string' || !Array.isArray(body.quests) ||
          !body.quests.some((quest) => quest.id === id) ||
          body.quests.some((quest) => quest.rootQuestId !== body.rootQuestId)) {
        throw new Error('이력의 형식을 확인할 수 없습니다. 다시 불러와 주세요.');
      }
      return body;
    },
  };
}

export function parseInput(minutesValue, energyValue) {
  const minutes = Number(minutesValue);
  const fields = {};
  if (String(minutesValue).trim() === '' || !Number.isInteger(minutes) || minutes < 5 || minutes > 120) {
    fields.availableMinutes = '5~120 사이의 정수를 입력해 주세요.';
  }
  if (!['low', 'medium', 'high'].includes(energyValue)) {
    fields.energy = '현재 상태를 선택해 주세요.';
  }
  return Object.keys(fields).length ? { fields } : { value: { availableMinutes: minutes, energy: energyValue } };
}

export function mountQuestApp(document, fetchRequest, requestTimeoutMs) {
  const api = createQuestApi(fetchRequest, requestTimeoutMs);
  const form = element(document, 'quest-form');
  const minutesInput = element(document, 'available-minutes');
  const energyInput = element(document, 'energy');
  const button = element(document, 'create-button');
  const formError = element(document, 'form-error');
  const formStatus = element(document, 'form-status');
  const listStatus = element(document, 'list-status');
  const listError = element(document, 'list-error');
  const retryButton = element(document, 'retry-button');
  const emptyState = element(document, 'empty-state');
  const list = element(document, 'quest-list');
  const resultSection = element(document, 'result-section');
  let listRequest = 0;
  const pendingQuestIds = new Set();

  function showFieldErrors(fields = {}) {
    for (const [field, [inputId, errorId]] of Object.entries(FIELD_IDS)) {
      const input = element(document, inputId);
      const error = element(document, errorId);
      const text = typeof fields[field] === 'string' ? fields[field] : '';
      error.textContent = text;
      error.hidden = !text;
      if (text) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }

  function showFormError(message) {
    formError.textContent = message;
    formError.hidden = !message;
  }

  function note(tag, text, className = '') {
    const node = document.createElement(tag);
    node.textContent = text;
    node.className = className;
    return node;
  }

  function renderQuest(quest, childIds) {
    const item = document.createElement('li');
    item.className = 'quest-card';
    item.dataset.questId = quest.id;
    item.quest = quest;
    item.append(note('h3', quest.title), note('p', quest.description),
      note('p', `예상 ${quest.estimatedMinutes}분`, 'duration'));
    const state = quest.status === 'completed' ? `완료 기록 · ${quest.completedAt ?? ''}`
      : quest.status === 'failed' ? `실패 기록 · ${FAILURE_REASONS[quest.failureReason] ?? '이유 확인 필요'}`
        : '진행할 수 있는 행동';
    item.append(note('p', state, 'quest-state'));
    if (quest.parentQuestId) {
      item.append(note('p', `더 작은 행동 · 부모 ID: ${quest.parentQuestId}`, 'quest-relation'),
        note('p', `루트 ID: ${quest.rootQuestId}`, 'quest-relation'));
    }
    const controls = document.createElement('div');
    controls.className = 'quest-actions';
    const error = note('p', '', 'notice notice-error');
    error.hidden = true;
    error.setAttribute('role', 'alert');
    const status = note('p', '', 'quest-action-status');
    status.setAttribute('role', 'status');
    const historyBox = document.createElement('div');
    historyBox.className = 'quest-history';
    historyBox.hidden = true;
    const actionButtons = [];
    let reasonInput;
    let failButton;
    function actionButton(label, handler) {
      const control = note('button', label);
      control.type = 'button';
      control.className = 'action-button';
      control.disabled = pendingQuestIds.has(quest.id);
      control.addEventListener('click', handler);
      controls.append(control);
      actionButtons.push(control);
      return control;
    }
    function setBusy(busy, text = '') {
      if (busy) pendingQuestIds.add(quest.id);
      else pendingQuestIds.delete(quest.id);
      for (const control of actionButtons) control.disabled = busy;
      if (!busy && failButton) failButton.disabled = !FAILURE_REASONS[reasonInput.value];
      if (reasonInput) reasonInput.disabled = busy;
      status.textContent = text;
    }
    async function showHistory() {
      historyBox.hidden = true;
      status.textContent = '이력을 불러오는 중입니다.';
      try {
        const history = await api.history(quest.id);
        const heading = note('h4', '연결된 행동 이력');
        const rootId = note('p', `루트 ID: ${history.rootQuestId}`, 'quest-relation');
        const steps = document.createElement('ol');
        for (const step of history.quests) {
          const entry = document.createElement('li');
          const stateLabel = step.status === 'completed' ? '완료' : step.status === 'failed'
            ? `실패 · ${FAILURE_REASONS[step.failureReason] ?? '이유 확인 필요'}` : '진행 전';
          entry.append(note('strong', `${step.title} · 예상 ${step.estimatedMinutes}분 · ${stateLabel}`),
            note('p', step.description),
            note('p', `ID: ${step.id}${step.parentQuestId ? ` · 부모 ID: ${step.parentQuestId}` : ' · 루트 행동'}`));
          steps.append(entry);
        }
        historyBox.replaceChildren(heading, rootId, steps);
        historyBox.hidden = false;
        error.hidden = true;
        status.textContent = '저장된 이력을 확인했습니다.';
      } catch (cause) {
        error.textContent = cause.message;
        error.hidden = false;
        status.textContent = '이력을 확인하지 못했습니다.';
      }
    }
    async function submit(action, input) {
      if (pendingQuestIds.has(quest.id)) return;
      resultSection.hidden = true;
      error.hidden = true;
      setBusy(true, '요청 결과를 확인하는 중입니다.');
      try {
        await api.transition(quest.id, action, input);
        pendingQuestIds.delete(quest.id);
        await loadList();
        if (action === 'redesign') await openHistory(quest.id);
      } catch (cause) {
        pendingQuestIds.delete(quest.id);
        // A lost response might follow a committed write. Re-read; never resend POST.
        if ((cause.network || cause.status === 409) && !(await loadList())) {
          listError.textContent = '요청 결과를 확인하지 못했습니다. 저장 목록을 다시 불러와 주세요.';
          return;
        }
        const current = findCard(quest.id);
        if (cause.network && current &&
            (current.quest.status !== quest.status ||
             (action === 'redesign' && Array.from(list.children).some((card) => card.quest.parentQuestId === quest.id)))) {
          current.actionError.hidden = true;
          current.actionStatus.textContent = '저장된 상태를 다시 확인했습니다.';
          return;
        }
        if (current === item) setBusy(false, '확정 결과를 확인하지 못했습니다.');
        const alert = current?.actionError ?? error;
        alert.textContent = cause.message;
        alert.hidden = false;
        if (cause.fields?.failureReason) {
          const fieldError = current?.reasonError ?? item.reasonError;
          const fieldInput = current?.reasonSelect ?? item.reasonSelect;
          if (fieldError && fieldInput) {
            fieldError.textContent = cause.fields.failureReason;
            fieldError.hidden = false;
            fieldInput.setAttribute('aria-invalid', 'true');
            fieldInput.focus();
          }
        }
        const retry = current?.refreshButton;
        if (retry) retry.hidden = false;
      }
    }
    if (quest.status === 'pending') {
      actionButton('완료 기록', () => submit('complete', {}));
      const reasonLabel = note('label', '실패 이유 선택');
      const reason = document.createElement('select');
      reasonInput = reason;
      reason.id = `failure-reason-${quest.id}`;
      reasonLabel.htmlFor = reason.id;
      reason.setAttribute('aria-describedby', `failure-error-${quest.id}`);
      for (const [value, label] of [['', '이유를 선택해 주세요'], ...Object.entries(FAILURE_REASONS)]) {
        const option = note('option', label);
        option.value = value;
        reason.append(option);
      }
      const reasonError = note('p', '', 'field-error');
      reasonError.id = `failure-error-${quest.id}`;
      reasonError.hidden = true;
      controls.append(reasonLabel, reason, reasonError);
      failButton = actionButton('실패 기록', () => {
        if (!FAILURE_REASONS[reason.value]) return;
        return submit('fail', { failureReason: reason.value });
      });
      failButton.disabled = true;
      reason.addEventListener('change', () => {
        reasonError.hidden = true;
        reason.removeAttribute('aria-invalid');
        failButton.disabled = pendingQuestIds.has(quest.id) || !FAILURE_REASONS[reason.value];
      });
      item.reasonError = reasonError;
      item.reasonSelect = reason;
    }
    if (quest.status === 'failed' && !childIds.has(quest.id)) {
      if (quest.estimatedMinutes > 1) actionButton('더 작은 행동 제안', () => submit('redesign', {}));
      else item.append(note('p', '지금은 1분짜리 행동입니다. 잠시 쉬거나 새 퀘스트를 만들어 보세요.', 'quest-guidance'));
    }
    if (quest.status === 'failed' && childIds.has(quest.id)) {
      item.append(note('p', '더 작은 행동이 연결되어 있습니다. 이력에서 확인해 주세요.', 'quest-guidance'));
    }
    actionButton('이력 보기', showHistory);
    const refreshButton = actionButton('목록 다시 확인', loadList);
    refreshButton.hidden = true;
    item.actionError = error;
    item.actionStatus = status;
    item.refreshButton = refreshButton;
    item.historyBox = historyBox;
    item.showHistory = showHistory;
    item.append(controls, error, status, historyBox);
    return item;
  }

  function findCard(id) {
    return Array.from(list.children).find((card) => card.dataset.questId === id);
  }

  async function openHistory(id) {
    const card = findCard(id);
    if (card) await card.showHistory();
  }

  async function loadList() {
    const request = ++listRequest;
    listStatus.textContent = '저장된 퀘스트를 불러오는 중입니다.';
    listError.hidden = true;
    retryButton.hidden = true;
    emptyState.hidden = true;
    try {
      const quests = await api.list();
      if (request !== listRequest) return;
      const childIds = new Set(quests.map((quest) => quest.parentQuestId).filter(Boolean));
      list.replaceChildren(...quests.map((quest) => renderQuest(quest, childIds)));
      emptyState.hidden = quests.length !== 0;
      listStatus.textContent = quests.length ? `저장된 퀘스트 ${quests.length}개` : '';
      return true;
    } catch (error) {
      if (request !== listRequest) return;
      list.replaceChildren();
      listStatus.textContent = '';
      listError.textContent = error.message || '저장 목록을 불러오지 못했습니다.';
      listError.hidden = false;
      retryButton.hidden = false;
      return false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    resultSection.hidden = true;
    showFieldErrors();
    showFormError('');
    const input = parseInput(minutesInput.value, energyInput.value);
    if (input.fields) {
      showFieldErrors(input.fields);
      showFormError('입력 내용을 확인해 주세요.');
      formStatus.textContent = '입력 내용을 확인해 주세요.';
      element(document, input.fields.availableMinutes ? 'available-minutes' : 'energy').focus();
      return;
    }
    button.disabled = true;
    button.textContent = '퀘스트를 저장하는 중입니다…';
    formStatus.textContent = '퀘스트를 저장하는 중입니다.';
    try {
      const quest = await api.create(input.value);
      element(document, 'result-quest-title').textContent = quest.title;
      element(document, 'result-description').textContent = quest.description;
      element(document, 'result-minutes').textContent = `예상 ${quest.estimatedMinutes}분 · 저장됨`;
      resultSection.hidden = false;
      formStatus.textContent = '새 퀘스트가 저장되었습니다.';
      await loadList();
    } catch (error) {
      showFieldErrors(error.fields);
      showFormError(error.message || '퀘스트를 만들지 못했습니다. 다시 확인해 주세요.');
      formStatus.textContent = '퀘스트를 만들지 못했습니다.';
      // A lost POST response can follow a successful write. Refresh the list without retrying POST.
      if (!error.fields) await loadList();
    } finally {
      button.disabled = false;
      button.textContent = '오늘의 퀘스트 만들기 ↗';
    }
  });

  retryButton.addEventListener('click', loadList);
  loadList();
  return { loadList };
}
