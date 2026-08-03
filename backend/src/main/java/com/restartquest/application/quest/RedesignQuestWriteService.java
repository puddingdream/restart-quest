package com.restartquest.application.quest;

import com.restartquest.application.ai.RedesignedQuest;
import com.restartquest.application.error.AppException;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.Quest;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestJourneyStatus;
import com.restartquest.domain.quest.QuestRedesign;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestStatus;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RedesignQuestWriteService {

    private final QuestPlanStore questPlanStore;

    public RedesignQuestWriteService(QuestPlanStore questPlanStore) {
        this.questPlanStore = questPlanStore;
    }

    @Transactional
    public RedesignQuestResult write(
            UUID userId,
            UUID questId,
            QuestRedesignReasonCode reasonCode,
            String reasonNote,
            RedesignedQuest redesignedQuest
    ) {
        QuestJourney journey = questPlanStore.findJourneyByQuestForUser(userId, questId)
                .orElseThrow(RedesignQuestWriteService::questNotFound);
        requireCurrentTodo(journey, questId);

        try {
            QuestRedesign redesign = journey.redesign(
                    questId,
                    redesignedQuest.toAiGeneratedSeed(),
                    reasonCode,
                    reasonNote
            );
            QuestJourney savedJourney = questPlanStore.saveJourneyForUser(userId, journey);
            return new RedesignQuestResult(savedJourney, redesign);
        } catch (OptimisticLockingFailureException | DataIntegrityViolationException exception) {
            throw questAlreadyResolved();
        }
    }

    private static void requireCurrentTodo(QuestJourney journey, UUID questId) {
        Quest requestedQuest = journey.getQuests().stream()
                .filter(quest -> quest.getId().equals(questId))
                .findFirst()
                .orElseThrow(RedesignQuestWriteService::questNotFound);
        if (journey.getStatus() != QuestJourneyStatus.ACTIVE
                || !journey.getCurrentQuestId().equals(questId)
                || requestedQuest.getStatus() != QuestStatus.TODO) {
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
