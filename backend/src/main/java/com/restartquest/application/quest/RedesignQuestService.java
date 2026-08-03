package com.restartquest.application.quest;

import com.restartquest.application.ai.QuestAiException;
import com.restartquest.application.ai.QuestDraft;
import com.restartquest.application.ai.QuestPersonalization;
import com.restartquest.application.ai.QuestRedesignRequest;
import com.restartquest.application.ai.RedesignedQuest;
import com.restartquest.application.error.AppException;
import com.restartquest.application.port.OnboardingProfileStore;
import com.restartquest.application.port.QuestAiClient;
import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.Quest;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestJourneyStatus;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.quest.QuestStatus;
import com.restartquest.domain.user.OnboardingProfile;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class RedesignQuestService {

    private final QuestPlanStore questPlanStore;
    private final OnboardingProfileStore onboardingProfileStore;
    private final QuestAiClient questAiClient;
    private final RedesignQuestWriteService writeService;

    public RedesignQuestService(
            QuestPlanStore questPlanStore,
            OnboardingProfileStore onboardingProfileStore,
            QuestAiClient questAiClient,
            RedesignQuestWriteService writeService
    ) {
        this.questPlanStore = questPlanStore;
        this.onboardingProfileStore = onboardingProfileStore;
        this.questAiClient = questAiClient;
        this.writeService = writeService;
    }

    public RedesignQuestResult redesign(
            UUID userId,
            UUID questId,
            QuestRedesignReasonCode reasonCode,
            String reasonNote
    ) {
        QuestJourney snapshot = questPlanStore.findJourneySnapshotByQuestForUser(userId, questId)
                .orElseThrow(RedesignQuestService::questNotFound);
        Quest originalQuest = requireCurrentTodo(snapshot, questId);
        OnboardingProfile profile = onboardingProfileStore.findByUserId(userId)
                .orElseThrow(RedesignQuestService::onboardingRequired);
        QuestRedesignRequest request = new QuestRedesignRequest(
                personalization(profile, snapshot),
                QuestDraft.from(originalQuest),
                reasonCode,
                reasonNote
        );
        RedesignedQuest redesignedQuest = validatedAiResult(request);
        return writeService.write(userId, questId, reasonCode, request.reasonNote(), redesignedQuest);
    }

    private RedesignedQuest validatedAiResult(QuestRedesignRequest request) {
        try {
            RedesignedQuest result = questAiClient.redesignQuest(request);
            return RedesignedQuest.validate(result.replacementQuest(), request);
        } catch (QuestAiException exception) {
            throw exception;
        } catch (RuntimeException exception) {
            throw QuestAiException.invalidResponse();
        }
    }

    private static Quest requireCurrentTodo(QuestJourney journey, UUID questId) {
        Quest requestedQuest = journey.getQuests().stream()
                .filter(quest -> quest.getId().equals(questId))
                .findFirst()
                .orElseThrow(RedesignQuestService::questNotFound);
        if (journey.getStatus() != QuestJourneyStatus.ACTIVE
                || !journey.getCurrentQuestId().equals(questId)
                || requestedQuest.getStatus() != QuestStatus.TODO) {
            throw questAlreadyResolved();
        }
        return requestedQuest;
    }

    private static QuestPersonalization personalization(
            OnboardingProfile profile,
            QuestJourney journey
    ) {
        return new QuestPersonalization(
                profile.getDesiredJob(),
                profile.getRegion(),
                profile.getDesiredWorkType(),
                profile.getCareerGapMonths(),
                profile.isHasResume(),
                profile.getInterviewExperience(),
                journey.getEnergyLevel()
        );
    }

    private static AppException questNotFound() {
        return new AppException(HttpStatus.NOT_FOUND, "QUEST_NOT_FOUND", "퀘스트를 찾을 수 없습니다.");
    }

    private static AppException questAlreadyResolved() {
        return new AppException(HttpStatus.CONFLICT, "QUEST_ALREADY_RESOLVED", "이미 처리된 퀘스트입니다.");
    }

    private static AppException onboardingRequired() {
        return new AppException(HttpStatus.CONFLICT, "ONBOARDING_REQUIRED", "온보딩을 먼저 완료해 주세요.");
    }
}
