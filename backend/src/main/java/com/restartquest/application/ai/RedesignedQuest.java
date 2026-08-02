package com.restartquest.application.ai;

import com.restartquest.domain.quest.QuestSeed;
import java.util.Objects;

public final class RedesignedQuest {

    private final QuestDraft replacementQuest;

    private RedesignedQuest(QuestDraft replacementQuest) {
        this.replacementQuest = replacementQuest;
    }

    public static RedesignedQuest validate(QuestDraft replacementQuest, QuestRedesignRequest request) {
        Objects.requireNonNull(replacementQuest, "replacementQuest는 필수입니다.");
        Objects.requireNonNull(request, "request는 필수입니다.");
        QuestDraft originalQuest = request.originalQuest();
        if (replacementQuest.category() != originalQuest.category()) {
            throw new IllegalArgumentException("대체 퀘스트는 원본 category를 유지해야 합니다.");
        }
        if (replacementQuest.estimatedMinutes() < 5 || replacementQuest.estimatedMinutes() > 15) {
            throw new IllegalArgumentException("대체 퀘스트는 5분 이상 15분 이하여야 합니다.");
        }
        if (replacementQuest.estimatedMinutes() > originalQuest.estimatedMinutes()) {
            throw new IllegalArgumentException("대체 퀘스트는 원본보다 오래 걸릴 수 없습니다.");
        }
        return new RedesignedQuest(replacementQuest);
    }

    public QuestDraft replacementQuest() {
        return replacementQuest;
    }

    public QuestSeed toAiGeneratedSeed() {
        return replacementQuest.toAiGeneratedSeed();
    }
}
