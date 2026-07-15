package com.restartquest.backend.infrastructure;

import com.restartquest.backend.application.QuestAiClient;
import com.restartquest.backend.application.QuestDraft;
import com.restartquest.backend.application.QuestPlan;
import com.restartquest.backend.domain.DailyQuest;
import com.restartquest.backend.domain.EnergyLevel;
import com.restartquest.backend.domain.FailureReason;
import com.restartquest.backend.domain.OnboardingProfile;
import com.restartquest.backend.domain.QuestCategory;
import com.restartquest.backend.domain.QuestDifficulty;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public final class MockQuestAiClient implements QuestAiClient {
    @Override
    public QuestPlan generateDailyQuests(OnboardingProfile profile, LocalDate questDate) {
        int baseMinutes = switch (profile.energyLevel()) {
            case LOW -> 10;
            case MEDIUM -> 15;
            case HIGH -> 25;
        };
        QuestDifficulty firstDifficulty = profile.energyLevel() == EnergyLevel.HIGH
                ? QuestDifficulty.NORMAL
                : QuestDifficulty.EASY;

        List<QuestDraft> quests = List.of(
                new QuestDraft(
                        "Find two " + profile.desiredRole() + " postings",
                        "Search for two roles near " + profile.region() + " and save the links or titles.",
                        QuestCategory.JOB_SEARCH,
                        firstDifficulty,
                        baseMinutes,
                        "Two posting links or titles are written down"
                ),
                new QuestDraft(
                        profile.hasResume() ? "Update one resume project note" : "Create a tiny resume outline",
                        profile.hasResume()
                                ? "Pick one project and add one clear sentence about your role."
                                : "Write only your desired role, one skill, and one project keyword.",
                        QuestCategory.RESUME,
                        QuestDifficulty.EASY,
                        Math.max(8, baseMinutes - 2),
                        "One resume note is saved"
                ),
                new QuestDraft(
                        profile.hasInterviewExperience() ? "Practice one interview answer" : "Draft one gap explanation",
                        profile.hasInterviewExperience()
                                ? "Answer one common question out loud or in notes for five minutes."
                                : "Write three plain sentences about what you want to restart today.",
                        QuestCategory.INTERVIEW,
                        QuestDifficulty.TINY,
                        Math.max(5, baseMinutes - 4),
                        "One short answer draft exists"
                )
        );
        return new QuestPlan(quests);
    }

    @Override
    public QuestPlan redesignQuest(
            DailyQuest originalQuest,
            FailureReason failureReason,
            OnboardingProfile profile,
            LocalDate questDate
    ) {
        int minutes = Math.max(5, originalQuest.estimatedMinutes() - 5);
        QuestDifficulty lowerDifficulty = originalQuest.difficulty().lower();
        List<QuestDraft> drafts = switch (failureReason) {
            case NOT_SURE_WHAT_TO_WRITE -> writingDrafts(originalQuest, lowerDifficulty, minutes);
            case NO_TIME, LOW_ENERGY -> shortStepDrafts(originalQuest, lowerDifficulty, minutes);
            case NO_MATERIAL -> materialDrafts(originalQuest, lowerDifficulty, minutes);
            case LOW_CONFIDENCE -> privateDrafts(originalQuest, lowerDifficulty, minutes);
            case NOT_INTERESTED -> alternateDrafts(originalQuest, lowerDifficulty, minutes, profile);
            case TOO_BIG -> splitDrafts(originalQuest, lowerDifficulty, minutes);
        };
        return new QuestPlan(drafts);
    }

    private static List<QuestDraft> writingDrafts(DailyQuest originalQuest, QuestDifficulty difficulty, int minutes) {
        return List.of(
                draft("List three raw keywords", "Write three unpolished keywords related to: " + originalQuest.title(), originalQuest, difficulty, minutes),
                draft("Choose one concrete example", "Pick one experience or posting detail that could support the task.", originalQuest, difficulty, minutes),
                draft("Write only the first sentence", "Turn the easiest keyword into one plain sentence.", originalQuest, difficulty, minutes)
        );
    }

    private static List<QuestDraft> shortStepDrafts(DailyQuest originalQuest, QuestDifficulty difficulty, int minutes) {
        return List.of(draft(
                "Open the task for five minutes",
                "Start " + originalQuest.title() + " and stop after the smallest visible step.",
                originalQuest,
                difficulty,
                minutes
        ));
    }

    private static List<QuestDraft> materialDrafts(DailyQuest originalQuest, QuestDifficulty difficulty, int minutes) {
        return List.of(
                draft("Collect one missing input", "Find just one note, link, or keyword needed for the task.", originalQuest, difficulty, minutes),
                draft("Save it in one place", "Put that input where you can use it next.", originalQuest, difficulty, minutes)
        );
    }

    private static List<QuestDraft> privateDrafts(DailyQuest originalQuest, QuestDifficulty difficulty, int minutes) {
        return List.of(draft(
                "Make a private rough draft",
                "Write a version that nobody else has to see yet.",
                originalQuest,
                difficulty,
                minutes
        ));
    }

    private static List<QuestDraft> alternateDrafts(
            DailyQuest originalQuest,
            QuestDifficulty difficulty,
            int minutes,
            OnboardingProfile profile
    ) {
        return List.of(draft(
                "Try one nearby " + profile.desiredRole() + " option",
                "Change one keyword or company type and repeat only the first step.",
                originalQuest,
                difficulty,
                minutes
        ));
    }

    private static List<QuestDraft> splitDrafts(DailyQuest originalQuest, QuestDifficulty difficulty, int minutes) {
        List<QuestDraft> drafts = new ArrayList<>();
        drafts.add(draft("Name the first visible step", "Write the first action needed before doing the full task.", originalQuest, difficulty, minutes));
        drafts.add(draft("Do only that first step", "Complete only the action you named, then stop.", originalQuest, difficulty, minutes));
        return drafts;
    }

    private static QuestDraft draft(
            String title,
            String description,
            DailyQuest originalQuest,
            QuestDifficulty difficulty,
            int minutes
    ) {
        return new QuestDraft(
                title,
                description,
                originalQuest.category(),
                difficulty,
                Math.min(minutes, Math.max(5, originalQuest.estimatedMinutes() - 1)),
                "A smaller output exists for the original task"
        );
    }
}
