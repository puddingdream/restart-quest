import { FormEvent, useState } from "react";
import { failureReasonHelp, failureReasonLabel } from "../questLabels";
import { DailyQuest, FailureReason, FailureSubmission } from "../types";

type FailureReasonPanelProps = {
  quest: DailyQuest;
  onCancel: () => void;
  onSubmit: (submission: FailureSubmission) => void;
};

const reasons: FailureReason[] = [
  "NO_TIME",
  "TOO_BIG",
  "NOT_SURE_WHAT_TO_WRITE",
  "NO_MATERIAL",
  "LOW_CONFIDENCE",
  "LOW_ENERGY",
  "NOT_INTERESTED",
];

export function FailureReasonPanel({
  quest,
  onCancel,
  onSubmit,
}: FailureReasonPanelProps) {
  const [reason, setReason] = useState<FailureReason>("TOO_BIG");
  const [note, setNote] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ reason, note });
  }

  return (
    <form
      className="failure-panel"
      aria-labelledby={`${quest.id}-failure-title`}
      onSubmit={handleSubmit}
    >
      <div className="section-heading compact">
        <p className="eyebrow">다시 나누기</p>
        <h3 id={`${quest.id}-failure-title`}>어디에서 막혔나요?</h3>
        <p>이유를 고르면 같은 목표를 더 작은 행동으로 바꿉니다.</p>
      </div>

      <fieldset className="reason-list">
        <legend className="sr-only">막힌 이유</legend>
        {reasons.map((item) => (
          <label key={item} className="reason-option">
            <input
              checked={reason === item}
              name={`${quest.id}-reason`}
              type="radio"
              value={item}
              onChange={() => setReason(item)}
            />
            <span>
              <strong>{failureReasonLabel[item]}</strong>
              <small>{failureReasonHelp[item]}</small>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="field">
        <span>짧은 메모</span>
        <textarea
          placeholder="예: 공고를 찾았지만 어떤 기준으로 볼지 몰랐다"
          rows={2}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>

      <div className="form-actions">
        <button className="ghost-button" type="button" onClick={onCancel}>
          취소
        </button>
        <button className="primary-button" type="submit">
          더 쉬운 퀘스트 만들기
        </button>
      </div>
    </form>
  );
}
