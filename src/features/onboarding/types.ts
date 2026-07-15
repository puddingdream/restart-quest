export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

export interface OnboardingProfile {
  region: string;
  desiredRole: string;
  desiredWorkType: string;
  careerGapMonths: number;
  hasResume: boolean;
  hasInterviewExperience: boolean;
  interests: string;
  energyLevel: EnergyLevel;
}

export const energyLevelLabels: Record<EnergyLevel, string> = {
  LOW: "낮음",
  MEDIUM: "보통",
  HIGH: "높음",
};
