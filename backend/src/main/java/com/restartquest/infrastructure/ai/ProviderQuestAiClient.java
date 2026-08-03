package com.restartquest.infrastructure.ai;

import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestAiException;
import com.restartquest.application.ai.QuestDraft;
import com.restartquest.application.ai.QuestGenerationRequest;
import com.restartquest.application.ai.QuestPersonalization;
import com.restartquest.application.ai.QuestRedesignRequest;
import com.restartquest.application.ai.RedesignedQuest;
import com.restartquest.application.port.QuestAiClient;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.infrastructure.ai.provider.ProviderException;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProvider;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationResponse;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.PersonalizationPayload;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.QuestPayload;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignResponse;
import java.util.function.Supplier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "restartquest.ai", name = "provider", havingValue = "runtime")
public class ProviderQuestAiClient implements QuestAiClient {

    private final StructuredQuestProvider provider;

    public ProviderQuestAiClient(StructuredQuestProvider provider) {
        this.provider = provider;
    }

    @Override
    public GeneratedQuestBatch generateDailyQuests(QuestGenerationRequest request) {
        GenerationRequest providerRequest = new GenerationRequest(toPayload(request.personalization()));
        GenerationResponse response = callProvider(() -> provider.generate(providerRequest));
        try {
            return new GeneratedQuestBatch(response.quests().stream()
                    .map(ProviderQuestAiClient::toDraft)
                    .toList());
        } catch (RuntimeException exception) {
            throw QuestAiException.invalidResponse();
        }
    }

    @Override
    public RedesignedQuest redesignQuest(QuestRedesignRequest request) {
        RedesignRequest providerRequest = new RedesignRequest(
                toPayload(request.personalization()),
                toPayload(request.originalQuest()),
                request.reasonCode().name(),
                request.reasonNote()
        );
        RedesignResponse response = callProvider(() -> provider.redesign(providerRequest));
        try {
            return RedesignedQuest.validate(toDraft(response.replacementQuest()), request);
        } catch (RuntimeException exception) {
            throw QuestAiException.invalidResponse();
        }
    }

    private static <T> T callProvider(Supplier<T> providerCall) {
        try {
            return providerCall.get();
        } catch (ProviderException exception) {
            throw mapFailure(exception.getFailureType());
        } catch (RuntimeException exception) {
            throw QuestAiException.providerUnavailable();
        }
    }

    private static QuestAiException mapFailure(ProviderException.FailureType failureType) {
        return switch (failureType) {
            case TIMEOUT -> QuestAiException.providerTimeout();
            case QUOTA_EXCEEDED -> QuestAiException.quotaExceeded();
            case INVALID_RESPONSE -> QuestAiException.invalidResponse();
            case UNAVAILABLE -> QuestAiException.providerUnavailable();
        };
    }

    private static PersonalizationPayload toPayload(QuestPersonalization personalization) {
        return new PersonalizationPayload(
                personalization.desiredJob(),
                personalization.region(),
                personalization.desiredWorkType().name(),
                personalization.careerGapMonths(),
                personalization.hasResume(),
                personalization.interviewExperience().name(),
                personalization.energyLevel().name()
        );
    }

    private static QuestPayload toPayload(QuestDraft quest) {
        return new QuestPayload(
                quest.title(),
                quest.description(),
                quest.completionCriteria(),
                quest.steps(),
                quest.category().name(),
                quest.difficulty().name(),
                quest.estimatedMinutes()
        );
    }

    private static QuestDraft toDraft(QuestPayload payload) {
        return new QuestDraft(
                payload.title(),
                payload.description(),
                payload.completionCriteria(),
                payload.steps(),
                QuestCategory.valueOf(payload.category()),
                QuestDifficulty.valueOf(payload.difficulty()),
                payload.estimatedMinutes()
        );
    }
}
