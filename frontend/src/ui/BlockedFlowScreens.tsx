import type { FormEvent } from 'react';
import { InlineError, PageIntro } from './primitives';
import type { AdaptationValues, BlockerCode, BlockerValues } from './types';

const blockerOptions: Array<{ value: BlockerCode; label: string; hint: string }> = [
  { value: 'TOO_BIG', label: '생각보다 너무 커요', hint: '첫 단계만 떼어 내요.' },
  { value: 'LOW_ENERGY', label: '지금은 에너지가 부족해요', hint: '시작 준비만 남겨요.' },
  { value: 'UNCLEAR', label: '어디까지 해야 할지 모르겠어요', hint: '완료 기준부터 정해요.' },
  { value: 'NO_TIME', label: '시간이 부족해요', hint: '필요한 것만 열어 둬요.' },
  { value: 'OTHER', label: '다른 이유가 있어요', hint: '더 작은 한 가지를 찾아요.' },
];

interface BlockerFormScreenProps {
  errorMessage?: string;
  isSubmitting?: boolean;
  onSubmit: (values: BlockerValues) => void;
  onCancel: () => void;
}

export function BlockerFormScreen({
  errorMessage,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: BlockerFormScreenProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      blockerCode: String(data.get('blockerCode')) as BlockerCode,
      note: String(data.get('note') ?? ''),
    });
  }

  return (
    <section>
      <PageIntro
        eyebrow="막힘 기록"
        title="어떤 점에서 막혔나요?"
        description="이유를 고르면 지금 상황에 맞는 더 작은 행동을 제안해 드려요."
      />
      <form className="form-stack" onSubmit={handleSubmit}>
        <fieldset className="radio-group">
          <legend>가장 가까운 이유 하나를 골라 주세요</legend>
          {blockerOptions.map((option) => (
            <label className="radio-card" key={option.value}>
              <input type="radio" name="blockerCode" value={option.value} required />
              <span>
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="field">
          <label htmlFor="blocker-note">덧붙일 메모 <span className="optional">선택</span></label>
          <textarea id="blocker-note" name="note" maxLength={500} rows={4} />
          <p className="field-hint">개인정보나 민감한 내용은 적지 않아도 괜찮아요. 최대 500자</p>
        </div>
        {errorMessage ? <InlineError>{errorMessage}</InlineError> : null}
        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '기록하는 중…' : '막힘 기록하기'}
          </button>
          <button className="button button--quiet" type="button" onClick={onCancel}>돌아가기</button>
        </div>
      </form>
    </section>
  );
}

interface AdaptationFormScreenProps {
  guidance: string;
  defaultValues: AdaptationValues;
  errorMessage?: string;
  isSubmitting?: boolean;
  onSubmit: (values: AdaptationValues) => void;
  onCancel: () => void;
}

export function AdaptationFormScreen({
  guidance,
  defaultValues,
  errorMessage,
  isSubmitting = false,
  onSubmit,
  onCancel,
}: AdaptationFormScreenProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSubmit({
      title: String(data.get('title') ?? ''),
      estimatedMinutes: Number(data.get('estimatedMinutes')),
    });
  }

  return (
    <section>
      <PageIntro
        eyebrow="다시 설계"
        title="다음 행동을 이만큼 줄여 봤어요"
        description="제안을 그대로 수락하거나, 지금 더 하기 쉬운 말과 시간으로 고쳐도 돼요."
      />
      <aside className="strategy-note" aria-label="재설계 전략">
        <span className="strategy-icon" aria-hidden="true">↘</span>
        <div>
          <strong>이번 전략</strong>
          <p>{guidance}</p>
        </div>
      </aside>
      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="adapted-title">더 작은 다음 행동</label>
          <input id="adapted-title" name="title" defaultValue={defaultValues.title} maxLength={100} required />
        </div>
        <div className="field field--compact">
          <label htmlFor="adapted-minutes">예상 시간</label>
          <div className="input-suffix">
            <input
              id="adapted-minutes"
              name="estimatedMinutes"
              type="number"
              min={2}
              max={30}
              defaultValue={defaultValues.estimatedMinutes}
              required
            />
            <span aria-hidden="true">분</span>
          </div>
        </div>
        {errorMessage ? <InlineError>{errorMessage}</InlineError> : null}
        <div className="form-actions">
          <button className="button button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? '저장하는 중…' : '이 행동으로 다시 시작하기'}
          </button>
          <button className="button button--quiet" type="button" onClick={onCancel}>나중에 이어하기</button>
        </div>
      </form>
    </section>
  );
}
