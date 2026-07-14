package com.restartquest.backend.domain;

public enum QuestDifficulty {
    TINY(0),
    EASY(1),
    NORMAL(2);

    private final int rank;

    QuestDifficulty(int rank) {
        this.rank = rank;
    }

    public boolean isNoHarderThan(QuestDifficulty other) {
        return rank <= other.rank;
    }
}
