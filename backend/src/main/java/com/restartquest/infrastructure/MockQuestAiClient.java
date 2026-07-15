package com.restartquest.infrastructure;

import com.restartquest.application.QuestAiClient;
import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.EnergyLevel;
import com.restartquest.domain.FailureReason;
import com.restartquest.domain.OnboardingProfile;
import com.restartquest.domain.QuestCategory;
import com.restartquest.domain.QuestDifficulty;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

public final class MockQuestAiClient implements QuestAiClient {
    private final AtomicInteger sequence = new AtomicInteger(1);

    @Override
    public List<DailyQuest> generateDailyQuests(OnboardingProfile profile) {
        int firstMinutes = profile.energyLevel() == EnergyLevel.LOW ? 12 : 18;
        int secondMinutes = profile.energyLevel() == EnergyLevel.HIGH ? 25 : 16;
        int thirdMinutes = profile.energyLevel() == EnergyLevel.LOW ? 15 : 22;

        return List.of(
                DailyQuest.original(
                        nextId(),
                        "Find two " + profile.desiredJob() + " postings",
                        "Search one job board for " + profile.desiredJob() + " roles near " + profile.region() + ".",
                        QuestCategory.JOB_SEARCH,
                        QuestDifficulty.EASY,
                        firstMinutes,
                        "Save or write down two posting titles"
                ),
                DailyQuest.original(
                        nextId(),
                        profile.hasResume()
                                ? "Update one resume project sentence"
                                : "Create a five-line resume outline",
                        profile.hasResume()
                                ? "Pick one project and improve only one sentence for the target role."
                                : "Write five rough lines: role, project, stack, result, next fix.",
                        QuestCategory.RESUME,
                        QuestDifficulty.NORMAL,
                        secondMinutes,
                        "One resume sentence or outline is written"
                ),
                DailyQuest.original(
                        nextId(),
                        profile.hasInterviewExperience()
                                ? "Refresh three interview answer bullets"
                                : "Draft three short interview answer bullets",
                        "Prepare short bullets for a likely " + profile.desiredJob() + " interview question.",
                        QuestCategory.INTERVIEW,
                        QuestDifficulty.NORMAL,
                        thirdMinutes,
                        "Three answer bullets are written"
                )
        );
    }

    @Override
    public List<DailyQuest> redesignQuest(DailyQuest originalQuest, FailureReason failureReason) {
        return switch (failureReason) {
            case NOT_SURE_WHAT_TO_WRITE -> writingStarterQuests(originalQuest);
            case NO_MATERIAL -> materialStarterQuests(originalQuest);
            case NOT_INTERESTED -> interestShiftQuests(originalQuest);
            case LOW_CONFIDENCE -> confidenceStarterQuests(originalQuest);
            case NO_TIME, TOO_BIG, LOW_ENERGY -> smallerStepQuests(originalQuest);
        };
    }

    private List<DailyQuest> writingStarterQuests(DailyQuest originalQuest) {
        return List.of(
                tiny(originalQuest, "Write three keywords only", "List three words related to the original quest.", 5),
                tiny(originalQuest, "Pick one example", "Choose one project, posting, or experience to use later.", 6),
                tiny(originalQuest, "Draft one rough sentence", "Write one unfinished sentence without editing it.", 8)
        );
    }

    private List<DailyQuest> materialStarterQuests(DailyQuest originalQuest) {
        return List.of(
                tiny(originalQuest, "Open one source", "Open one resume, posting, note, or project file.", 5),
                tiny(originalQuest, "Copy one useful detail", "Save one phrase or fact that can help the quest.", 7),
                tiny(originalQuest, "Name the missing material", "Write the one material needed for the next attempt.", 8)
        );
    }

    private List<DailyQuest> interestShiftQuests(DailyQuest originalQuest) {
        return List.of(
                tiny(originalQuest, "Try one adjacent keyword", "Search one adjacent role or skill keyword.", 5),
                tiny(originalQuest, "Keep one possible option", "Write down one option that feels acceptable enough.", 7),
                tiny(originalQuest, "Skip the least useful part", "Mark which part of the original quest can be ignored today.", 8)
        );
    }

    private List<DailyQuest> confidenceStarterQuests(DailyQuest originalQuest) {
        return List.of(
                tiny(originalQuest, "Write a private rough note", "Write one private line that does not need to be polished.", 5),
                tiny(originalQuest, "Name one thing already done", "Write one concrete thing you have already prepared.", 6),
                tiny(originalQuest, "Choose a safe next line", "Write the smallest next line you can continue from.", 8)
        );
    }

    private List<DailyQuest> smallerStepQuests(DailyQuest originalQuest) {
        return List.of(
                tiny(originalQuest, "Open the starting page", "Open only the page or document needed for the quest.", 5),
                tiny(originalQuest, "Do the first visible step", "Complete only the first button, line, or search.", 7),
                tiny(originalQuest, "Leave one next-action note", "Write one sentence about what to do next.", 8)
        );
    }

    private DailyQuest tiny(DailyQuest originalQuest, String title, String description, int minutes) {
        return DailyQuest.redesigned(
                nextId(),
                originalQuest.id(),
                title,
                description,
                originalQuest.category(),
                QuestDifficulty.TINY,
                minutes,
                "The tiny action is done"
        );
    }

    private String nextId() {
        return "quest-" + sequence.getAndIncrement();
    }
}
