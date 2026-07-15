export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";

export type OnboardingProfile = {
  region: string;
  desiredJob: string;
  desiredWorkType: string;
  careerGapMonths: number;
  hasResume: boolean;
  hasInterviewExperience: boolean;
  interests: string;
  energyLevel: EnergyLevel;
};
