package com.restartquest.domain;

public enum QuestDifficulty {
    TINY(0),
    EASY(1),
    NORMAL(2);

    private final int order;

    QuestDifficulty(int order) {
        this.order = order;
    }

    public boolean isEasierThan(QuestDifficulty other) {
        return order < other.order;
    }
}
