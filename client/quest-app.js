const FIELD_IDS = {
  availableMinutes: ['available-minutes', 'minutes-error'],
  energy: ['energy', 'energy-error'],
};

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
    throw new Error('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  }
  if (!response.ok) {
    const error = new Error(messageFrom(body, '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'));
    error.fields = body?.error?.fields ?? {};
    throw error;
  }
  return body;
}

export function createQuestApi(fetchRequest) {
  async function fetchJson(options) {
    let response;
    try {
      response = await fetchRequest('/api/quests', options);
    } catch {
      throw new Error('서버에 연결할 수 없습니다. 저장 목록을 확인해 주세요.');
    }
    return readResponse(response);
  }
  return {
    async list() {
      const body = await fetchJson({ headers: { Accept: 'application/json' } });
      if (!Array.isArray(body?.quests)) throw new Error('저장 목록의 형식을 확인할 수 없습니다.');
      return body.quests;
    },
    async create(input) {
      const body = await fetchJson({
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!body?.quest || typeof body.quest.id !== 'string') {
        throw new Error('생성 결과의 형식을 확인할 수 없습니다.');
      }
      return body.quest;
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

export function mountQuestApp(document, fetchRequest) {
  const api = createQuestApi(fetchRequest);
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
  let listRequest = 0;

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

  function renderQuest(quest) {
    const item = document.createElement('li');
    item.className = 'quest-card';
    item.dataset.questId = quest.id;
    const title = document.createElement('h3');
    title.textContent = quest.title;
    const description = document.createElement('p');
    description.textContent = quest.description;
    const duration = document.createElement('p');
    duration.className = 'duration';
    duration.textContent = `예상 ${quest.estimatedMinutes}분`;
    item.append(title, description, duration);
    return item;
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
      list.replaceChildren(...quests.map(renderQuest));
      emptyState.hidden = quests.length !== 0;
      listStatus.textContent = quests.length ? `저장된 퀘스트 ${quests.length}개` : '';
    } catch (error) {
      if (request !== listRequest) return;
      list.replaceChildren();
      listStatus.textContent = '';
      listError.textContent = error.message || '저장 목록을 불러오지 못했습니다.';
      listError.hidden = false;
      retryButton.hidden = false;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
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
    element(document, 'result-section').hidden = true;
    try {
      const quest = await api.create(input.value);
      element(document, 'result-quest-title').textContent = quest.title;
      element(document, 'result-description').textContent = quest.description;
      element(document, 'result-minutes').textContent = `예상 ${quest.estimatedMinutes}분 · 저장됨`;
      element(document, 'result-section').hidden = false;
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
