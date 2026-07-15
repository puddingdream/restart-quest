import type { EnergyLevel, OnboardingProfile } from "../types";

const energyLevels: EnergyLevel[] = ["LOW", "MEDIUM", "HIGH"];

export type OnboardingValidationResult =
  | { ok: true; profile: OnboardingProfile }
  | { ok: false; message: string };

export function readOnboardingProfile(form: HTMLFormElement): OnboardingValidationResult {
  const formData = new FormData(form);
  const region = readString(formData, "region");
  const desiredRole = readString(formData, "desiredRole");
  const desiredWorkType = readString(formData, "desiredWorkType");
  const interests = readString(formData, "interests");
  const energyLevel = readEnergyLevel(formData);
  const careerGapMonths = Number(readString(formData, "careerGapMonths"));

  if (!region || !desiredRole || !desiredWorkType) {
    return { ok: false, message: "지역, 희망 직무, 근무 형태를 입력해 주세요." };
  }

  if (!Number.isInteger(careerGapMonths) || careerGapMonths < 0) {
    return { ok: false, message: "공백 기간은 0 이상의 월 단위 숫자로 입력해 주세요." };
  }

  if (!energyLevel) {
    return { ok: false, message: "오늘 에너지 수준을 선택해 주세요." };
  }

  return {
    ok: true,
    profile: {
      region,
      desiredRole,
      desiredWorkType,
      careerGapMonths,
      hasResume: readString(formData, "hasResume") === "yes",
      hasInterviewExperience: readString(formData, "hasInterviewExperience") === "yes",
      interests,
      energyLevel,
    },
  };
}

function readString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readEnergyLevel(formData: FormData): EnergyLevel | null {
  const value = readString(formData, "energyLevel");
  return energyLevels.includes(value as EnergyLevel) ? (value as EnergyLevel) : null;
}
