package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

final class QuestOutputValidator {
    private QuestOutputValidator() {
    }

    static void validateGeneratedQuests(List<DailyQuest> quests) {
        if (quests.size() != 3) {
            throw new IllegalArgumentException("Daily quest generation must return exactly 3 quests");
        }
        Set<String> ids = new HashSet<>();
        for (DailyQuest quest : quests) {
            if (!quest.isOriginal()) {
                throw new IllegalArgumentException("Generated daily quests must not have parentQuestId");
            }
            if (!ids.add(quest.id())) {
                throw new IllegalArgumentException("Quest ids must be unique");
            }
        }
    }

    static void validateRedesignedQuests(DailyQuest originalQuest, List<DailyQuest> redesignedQuests) {
        if (redesignedQuests.isEmpty() || redesignedQuests.size() > 3) {
            throw new IllegalArgumentException("Redesign must return 1 to 3 quests");
        }
        Set<String> ids = new HashSet<>();
        for (DailyQuest quest : redesignedQuests) {
            if (!originalQuest.id().equals(quest.parentQuestId())) {
                throw new IllegalArgumentException("Redesigned quest must link to original quest");
            }
            if (!quest.difficulty().isEasierThan(originalQuest.difficulty())) {
                throw new IllegalArgumentException("Redesigned quest difficulty must be lower than original");
            }
            if (quest.estimatedMinutes() >= originalQuest.estimatedMinutes()) {
                throw new IllegalArgumentException("Redesigned quest must take less time than original");
            }
            if (!ids.add(quest.id())) {
                throw new IllegalArgumentException("Redesigned quest ids must be unique");
            }
        }
    }
}
