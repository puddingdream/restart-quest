package com.restartquest.application.ai;

import com.restartquest.domain.quest.QuestSeed;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

public record GeneratedQuestBatch(List<QuestDraft> quests) {

    public GeneratedQuestBatch {
        if (quests == null || quests.size() != 3) {
            throw new IllegalArgumentException("생성 결과에는 정확히 세 개의 퀘스트가 필요합니다.");
        }
        quests = List.copyOf(quests);
        Set<String> normalizedTitles = new HashSet<>();
        for (QuestDraft quest : quests) {
            if (quest.estimatedMinutes() < 10 || quest.estimatedMinutes() > 30) {
                throw new IllegalArgumentException("생성 퀘스트는 10분 이상 30분 이하여야 합니다.");
            }
            if (!normalizedTitles.add(quest.title().toLowerCase(Locale.ROOT))) {
                throw new IllegalArgumentException("생성 퀘스트 제목은 서로 달라야 합니다.");
            }
        }
    }

    public List<QuestSeed> toAiGeneratedSeeds() {
        return quests.stream()
                .map(QuestDraft::toAiGeneratedSeed)
                .toList();
    }
}
