package com.restartquest.application.quest;

import com.restartquest.application.error.AppException;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.Quest;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestJourneyStatus;
import com.restartquest.domain.quest.QuestStatus;
import java.util.UUID;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CompleteQuestService {

    private final QuestPlanStore questPlanStore;

    public CompleteQuestService(QuestPlanStore questPlanStore) {
        this.questPlanStore = questPlanStore;
    }

    @Transactional
    public QuestJourney complete(UUID userId, UUID questId) {
        QuestJourney journey = questPlanStore.findJourneyByQuestForUser(userId, questId)
                .orElseThrow(CompleteQuestService::questNotFound);
        Quest quest = journey.getQuests().stream()
                .filter(candidate -> candidate.getId().equals(questId))
                .findFirst()
                .orElseThrow(CompleteQuestService::questNotFound);

        if (journey.getStatus() != QuestJourneyStatus.ACTIVE
                || !journey.getCurrentQuestId().equals(questId)
                || quest.getStatus() != QuestStatus.TODO) {
            throw questAlreadyResolved();
        }

        try {
            journey.complete(questId);
            return questPlanStore.saveJourneyForUser(userId, journey);
        } catch (OptimisticLockingFailureException exception) {
            throw questAlreadyResolved();
        }
    }

    private static AppException questNotFound() {
        return new AppException(HttpStatus.NOT_FOUND, "QUEST_NOT_FOUND", "퀘스트를 찾을 수 없습니다.");
    }

    private static AppException questAlreadyResolved() {
        return new AppException(HttpStatus.CONFLICT, "QUEST_ALREADY_RESOLVED", "이미 처리된 퀘스트입니다.");
    }
}
