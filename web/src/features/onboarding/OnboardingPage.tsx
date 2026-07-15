import { useOnboardingForm } from "./hooks/useOnboardingForm";
import { EnergyLevel, OnboardingProfile } from "./types";

type OnboardingPageProps = {
  savedProfile: OnboardingProfile | null;
  onSubmit: (profile: OnboardingProfile) => void;
};

const energyOptions: Array<{ value: EnergyLevel; label: string; helper: string }> = [
  { value: "LOW", label: "낮음", helper: "5~15분 안에 끝나는 행동 중심" },
  { value: "MEDIUM", label: "보통", helper: "10~20분짜리 작은 실행 중심" },
  { value: "HIGH", label: "높음", helper: "20~30분까지 가능한 실행 중심" },
];

export function OnboardingPage({ savedProfile, onSubmit }: OnboardingPageProps) {
  const { errors, form, handleSubmit, isValid, updateField } = useOnboardingForm(
    savedProfile,
    onSubmit,
  );

  return (
    <section className="flow-section" aria-labelledby="onboarding-title">
      <div className="section-heading">
        <p className="eyebrow">첫 입력</p>
        <h2 id="onboarding-title">오늘 퀘스트를 작게 맞추기</h2>
        <p>
          입력값은 난이도와 방향을 정하는 재료로만 사용합니다. 지금 바로 할 수
          있는 구직 행동을 만들기 위한 최소 정보입니다.
        </p>
      </div>

      <form className="form-grid" onSubmit={handleSubmit} noValidate>
        <label className="field">
          <span>지역</span>
          <input
            aria-invalid={Boolean(errors.region)}
            value={form.region}
            onChange={(event) => updateField("region", event.target.value)}
          />
          {errors.region && <small className="error-text">{errors.region}</small>}
        </label>

        <label className="field">
          <span>희망 직무</span>
          <input
            aria-invalid={Boolean(errors.desiredJob)}
            value={form.desiredJob}
            onChange={(event) => updateField("desiredJob", event.target.value)}
          />
          {errors.desiredJob && <small className="error-text">{errors.desiredJob}</small>}
        </label>

        <label className="field">
          <span>희망 근무 형태</span>
          <select
            value={form.desiredWorkType}
            onChange={(event) => updateField("desiredWorkType", event.target.value)}
          >
            <option>정규직</option>
            <option>계약직</option>
            <option>인턴</option>
            <option>프리랜서</option>
            <option>아직 정하지 않음</option>
          </select>
        </label>

        <label className="field">
          <span>취업 공백 기간</span>
          <input
            aria-invalid={Boolean(errors.careerGapMonths)}
            inputMode="numeric"
            min="0"
            max="120"
            type="number"
            value={form.careerGapMonths}
            onChange={(event) => updateField("careerGapMonths", event.target.value)}
          />
          {errors.careerGapMonths && (
            <small className="error-text">{errors.careerGapMonths}</small>
          )}
        </label>

        <fieldset className="choice-group">
          <legend>준비 자료</legend>
          <label>
            <input
              checked={form.hasResume}
              type="checkbox"
              onChange={(event) => updateField("hasResume", event.target.checked)}
            />
            이력서 초안이 있습니다
          </label>
          <label>
            <input
              checked={form.hasInterviewExperience}
              type="checkbox"
              onChange={(event) =>
                updateField("hasInterviewExperience", event.target.checked)
              }
            />
            면접 경험이 있습니다
          </label>
        </fieldset>

        <label className="field wide">
          <span>관심 분야나 기술</span>
          <textarea
            aria-invalid={Boolean(errors.interests)}
            rows={3}
            value={form.interests}
            onChange={(event) => updateField("interests", event.target.value)}
          />
          {errors.interests && <small className="error-text">{errors.interests}</small>}
        </label>

        <fieldset className="energy-group wide">
          <legend>오늘 에너지 수준</legend>
          <div className="segmented-options">
            {energyOptions.map((option) => (
              <label key={option.value} className="segment">
                <input
                  checked={form.energyLevel === option.value}
                  name="energyLevel"
                  type="radio"
                  value={option.value}
                  onChange={() => updateField("energyLevel", option.value)}
                />
                <span>{option.label}</span>
                <small>{option.helper}</small>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-actions wide">
          <button className="primary-button" disabled={!isValid} type="submit">
            오늘 퀘스트로 이동
          </button>
        </div>
      </form>
    </section>
  );
}
