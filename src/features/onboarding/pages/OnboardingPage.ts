import { h } from "../../../shared/dom";
import { energyLevelLabels, type EnergyLevel, type OnboardingProfile } from "../types";
import { readOnboardingProfile } from "../services/onboardingValidation";

type OnboardingPageProps = {
  onSubmit: (profile: OnboardingProfile) => void;
};

export function renderOnboardingPage(props: OnboardingPageProps): HTMLElement {
  const error = h("p", {
    className: "form-error",
    attrs: { role: "alert", "aria-live": "polite" },
  });

  const form = h(
    "form",
    { className: "panel onboarding-form" },
    field("region", "거주 지역", "서울", "text"),
    field("desiredRole", "희망 직무", "백엔드 개발자", "text"),
    field("desiredWorkType", "희망 근무 형태", "원격 또는 하이브리드", "text"),
    field("careerGapMonths", "취업 공백 기간(개월)", "8", "number"),
    selectField("hasResume", "이력서 보유", [
      ["yes", "있음"],
      ["no", "아직 없음"],
    ]),
    selectField("hasInterviewExperience", "면접 경험", [
      ["yes", "있음"],
      ["no", "적음 또는 없음"],
    ]),
    field("interests", "관심 분야", "Java, Spring, 커머스 서비스", "text"),
    energyField(),
    error,
    h(
      "button",
      { className: "button button-primary full-width", attrs: { type: "submit" } },
      "오늘 시작할 상태 저장",
    ),
  );

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const result = readOnboardingProfile(form);
    if (!result.ok) {
      error.textContent = result.message;
      return;
    }
    error.textContent = "";
    props.onSubmit(result.profile);
  });

  return h(
    "section",
    { className: "page-grid onboarding-page" },
    h(
      "div",
      { className: "intro-copy" },
      h("p", { className: "eyebrow", text: "Slice 1 mock loop" }),
      h("h1", { text: "오늘 다시 움직일 만큼만 작게 나눕니다." }),
      h(
        "p",
        {
          className: "lead",
          text:
            "입력값은 평가가 아니라 오늘 퀘스트의 방향과 부담을 조절하는 데만 사용합니다.",
        },
      ),
    ),
    form,
  );
}

function field(
  name: string,
  label: string,
  placeholder: string,
  type: "text" | "number",
): HTMLElement {
  return h(
    "label",
    { className: "field" },
    h("span", { text: label }),
    h("input", {
      attrs: {
        name,
        placeholder,
        type,
        min: type === "number" ? 0 : "",
        required: name !== "interests",
      },
    }),
  );
}

function selectField(name: string, label: string, options: Array<[string, string]>): HTMLElement {
  return h(
    "label",
    { className: "field" },
    h("span", { text: label }),
    h(
      "select",
      { attrs: { name } },
      ...options.map(([value, text]) => h("option", { attrs: { value }, text })),
    ),
  );
}

function energyField(): HTMLElement {
  const levels: EnergyLevel[] = ["LOW", "MEDIUM", "HIGH"];
  return h(
    "fieldset",
    { className: "segmented-field" },
    h("legend", { text: "오늘 에너지 수준" }),
    ...levels.map((level) =>
      h(
        "label",
        { className: "segmented-option" },
        h("input", {
          attrs: {
            type: "radio",
            name: "energyLevel",
            value: level,
            checked: level === "LOW",
          },
        }),
        h("span", { text: energyLevelLabels[level] }),
      ),
    ),
  );
}
