package com.restartquest.backend.domain;

public enum QuestDifficulty {
    TINY(1),
    EASY(2),
    NORMAL(3);

    private final int rank;

    QuestDifficulty(int rank) {
        this.rank = rank;
    }

    public boolean isEasierThan(QuestDifficulty other) {
        return rank < other.rank;
    }

    public QuestDifficulty lower() {
        return switch (this) {
            case NORMAL -> EASY;
            case EASY, TINY -> TINY;
        };
    }
}
