import type { EnergyLevel, OnboardingProfile } from "../../shared/types.js";

export const energyLabels: Record<EnergyLevel, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음"
};

export function normalizeInterests(rawValue: string): string[] {
  return rawValue
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function validateProfile(profile: OnboardingProfile): string[] {
  const errors: string[] = [];

  if (!profile.region.trim()) errors.push("거주 지역을 입력해 주세요.");
  if (!profile.desiredJob.trim()) errors.push("희망 직무를 입력해 주세요.");
  if (!profile.desiredWorkType.trim()) errors.push("희망 근무 형태를 선택해 주세요.");
  if (!Number.isInteger(profile.careerGapMonths) || profile.careerGapMonths < 0) {
    errors.push("취업 공백 기간은 0 이상의 숫자로 입력해 주세요.");
  }
  if (profile.interests.length === 0) errors.push("관심 분야를 1개 이상 입력해 주세요.");

  return errors;
}

export function createDemoProfile(): OnboardingProfile {
  return {
    region: "서울",
    desiredJob: "백엔드 개발자",
    desiredWorkType: "정규직",
    careerGapMonths: 8,
    hasResume: true,
    interviewExperienceLevel: "LOW",
    interests: ["Java", "Spring"],
    defaultEnergyLevel: "LOW"
  };
}
