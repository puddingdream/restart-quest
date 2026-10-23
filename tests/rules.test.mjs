import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboard, createQuest, createRedesign, initialLevel, RATIONALES, STEPS, suggestRedesign } from '../server/quests.mjs';

test('시간과 상태의 경계에서 실행 가능한 첫 단계를 고른다', () => {
  assert.equal(initialLevel(5, 'ready'), 1);
  assert.equal(initialLevel(9, 'ready'), 1);
  assert.equal(initialLevel(10, 'ready'), 2);
  assert.equal(initialLevel(19, 'ready'), 2);
  assert.equal(initialLevel(20, 'ready'), 3);
  assert.equal(initialLevel(120, 'low_energy'), 2);
  assert.equal(initialLevel(9, 'low_energy'), 1);
  assert.equal(initialLevel(120, 'overwhelmed'), 1);
  for (const step of STEPS.slice(1)) {
    assert.ok(step.minutes <= [5, 10, 20][step.level - 1]);
  }
});

test('실패 이유별 제안은 후손으로 확정될 때 한 단계와 시간을 줄인다', () => {
  for (const input of [
    { availableMinutes: 20, currentState: 'ready' },
    { availableMinutes: 10, currentState: 'ready' },
    { availableMinutes: 5, currentState: 'overwhelmed' }
  ]) {
    const titles = new Set();
    const instructions = new Set();
    for (const reasonCode of Object.keys(RATIONALES)) {
      const original = createQuest(input);
      original.status = 'failed';
      original.failedAt = new Date().toISOString();
      original.failureReason = { code: reasonCode, note: '' };
      const suggestion = suggestRedesign(original);
      assert.deepEqual(Object.keys(suggestion), ['parentId', 'level', 'minutes', 'title', 'instruction', 'reasonCode', 'rationale']);
      assert.equal(suggestion.reasonCode, reasonCode);
      assert.equal(suggestion.rationale, RATIONALES[reasonCode]);
      assert.equal(suggestion.level, original.level - 1);
      assert.ok(suggestion.minutes < original.minutes);
      titles.add(suggestion.title);
      instructions.add(suggestion.instruction);
      const intent = {
        time: [/직무/, /직무명/],
        energy: [/예시/, /기획/],
        too_hard: [/동사/, /쓰기/],
        unclear: [/칸/, /빈칸/],
        other: [/키워드/, /키워드/]
      }[reasonCode];
      assert.match(suggestion.title, intent[0]);
      assert.match(suggestion.instruction, intent[1]);
      const child = createRedesign(original);
      assert.equal(child.rootId, original.id);
      assert.equal(child.parentId, original.id);
      assert.equal(child.redesignReason, reasonCode);
      assert.deepEqual(
        [child.level, child.minutes, child.title, child.instruction],
        [suggestion.level, suggestion.minutes, suggestion.title, suggestion.instruction]
      );
      assert.equal(child.status, 'pending');
      assert.equal(child.failureReason, null);
      if (reasonCode === 'other') {
        assert.equal(suggestion.title, STEPS[suggestion.level].title);
        assert.equal(suggestion.instruction, STEPS[suggestion.level].instruction);
      }
    }
    assert.equal(titles.size, 5, `level ${initialLevel(input.availableMinutes, input.currentState)}`);
    assert.equal(instructions.size, 5, `level ${initialLevel(input.availableMinutes, input.currentState)}`);
  }
  const minimum = { ...createQuest({ availableMinutes: 5, currentState: 'overwhelmed' }), level: 0, status: 'failed', failureReason: { code: 'time', note: '' } };
  assert.equal(suggestRedesign(minimum), null);
  assert.equal(createRedesign(minimum), null);
});

test('대시보드는 저장된 상태와 이력에서만 합계, 다음 행동, 미확정 제안을 계산한다', () => {
  const older = createQuest({ availableMinutes: 20, currentState: 'ready' }, '2026-01-01T00:00:00.000Z');
  const failed = createQuest({ availableMinutes: 10, currentState: 'ready' }, '2026-01-02T00:00:00.000Z');
  failed.status = 'failed';
  failed.failedAt = '2026-01-02T00:00:01.000Z';
  failed.failureReason = { code: 'unclear', note: '구체적이지 않음' };
  const dashboard = buildDashboard([older, failed]);
  assert.deepEqual(dashboard.summary, { total: 2, pending: 1, completed: 0, failed: 1, redesigned: 0 });
  assert.deepEqual(dashboard.quests.map((quest) => quest.id), [failed.id, older.id]);
  assert.deepEqual(dashboard.nextActions.map((quest) => quest.id), [older.id]);
  assert.deepEqual(dashboard.suggestions.map((suggestion) => suggestion.parentId), [failed.id]);

  const child = createRedesign(failed, '2026-01-03T00:00:00.000Z');
  const updated = buildDashboard([older, failed, child]);
  assert.deepEqual(updated.summary, { total: 3, pending: 2, completed: 0, failed: 1, redesigned: 1 });
  assert.deepEqual(updated.nextActions.map((quest) => quest.id), [child.id, older.id]);
  assert.deepEqual(updated.suggestions, []);
});
