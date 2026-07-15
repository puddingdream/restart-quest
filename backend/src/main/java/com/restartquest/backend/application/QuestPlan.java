package com.restartquest.backend.application;

import java.util.List;
import java.util.Objects;

public record QuestPlan(List<QuestDraft> quests) {
    public QuestPlan {
        quests = List.copyOf(Objects.requireNonNullElse(quests, List.of()));
    }
}
