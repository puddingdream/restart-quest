package com.restartquest.infrastructure.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestAiException;
import com.restartquest.application.ai.QuestDraft;
import com.restartquest.application.ai.QuestGenerationRequest;
import com.restartquest.application.ai.QuestPersonalization;
import com.restartquest.application.ai.QuestRedesignRequest;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;
import com.restartquest.infrastructure.ai.provider.ProviderException;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProvider;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.GenerationResponse;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.QuestPayload;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignRequest;
import com.restartquest.infrastructure.ai.provider.StructuredQuestProviderContract.RedesignResponse;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.http.HttpStatus;

class ProviderQuestAiClientTest {

    @Test
    void convertsTypedProviderResponseWithoutIdentityOrCredentialFields() {
        CapturingProvider provider = new CapturingProvider();
        provider.generationResponse = new GenerationResponse(List.of(
                payload("이력서 문장", "RESUME", 10),
                payload("공고 조건", "JOB_SEARCH", 15),
                payload("시작 준비", "ROUTINE", 20)
        ));
        ProviderQuestAiClient client = new ProviderQuestAiClient(provider);

        GeneratedQuestBatch result = client.generateDailyQuests(new QuestGenerationRequest(personalization()));

        assertThat(result.quests()).hasSize(3);
        assertThat(provider.generationRequest.personalization().desiredJob()).isEqualTo("백엔드 개발자");
        assertThat(provider.generationRequest.personalization().energyLevel()).isEqualTo("MEDIUM");
        assertThat(provider.generationRequest.toString())
                .doesNotContain("email", "accessToken", "password", "apiKey");
    }

    @ParameterizedTest
    @EnumSource(ProviderException.FailureType.class)
    void mapsEveryProviderFailureToDistinctApplicationError(ProviderException.FailureType failureType) {
        StructuredQuestProvider provider = new FailingProvider(new ProviderException(failureType));
        ProviderQuestAiClient client = new ProviderQuestAiClient(provider);

        assertThatThrownBy(() -> client.generateDailyQuests(new QuestGenerationRequest(personalization())))
                .isInstanceOfSatisfying(QuestAiException.class, exception -> {
                    assertThat(exception.getCode()).isEqualTo(expectedCode(failureType));
                    assertThat(exception.getStatus()).isEqualTo(expectedStatus(failureType));
                });
    }

    @Test
    void mapsMalformedTypedOutputToInvalidResponse() {
        CapturingProvider provider = new CapturingProvider();
        provider.generationResponse = new GenerationResponse(List.of(
                payload("이력서 문장", "UNKNOWN", 10),
                payload("공고 조건", "JOB_SEARCH", 15),
                payload("시작 준비", "ROUTINE", 20)
        ));
        ProviderQuestAiClient client = new ProviderQuestAiClient(provider);

        assertThatThrownBy(() -> client.generateDailyQuests(new QuestGenerationRequest(personalization())))
                .isInstanceOfSatisfying(QuestAiException.class, exception ->
                        assertThat(exception.getCode()).isEqualTo("AI_INVALID_RESPONSE")
                );
    }

    @Test
    void validatesReplacementAgainstOriginalBeforeReturningIt() {
        CapturingProvider provider = new CapturingProvider();
        provider.redesignResponse = new RedesignResponse(payload("범주가 바뀐 대체", "RESUME", 10));
        ProviderQuestAiClient client = new ProviderQuestAiClient(provider);
        QuestRedesignRequest request = new QuestRedesignRequest(
                personalization(),
                draft("면접 답변 정리", QuestCategory.INTERVIEW, 12),
                QuestRedesignReasonCode.TASK_TOO_LARGE,
                null
        );

        assertThatThrownBy(() -> client.redesignQuest(request))
                .isInstanceOfSatisfying(QuestAiException.class, exception ->
                        assertThat(exception.getCode()).isEqualTo("AI_INVALID_RESPONSE")
                );
    }

    @Test
    void doesNotExposeUnexpectedProviderMessage() {
        String providerRawMessage = "raw-provider-body-must-not-be-public";
        ProviderQuestAiClient client = new ProviderQuestAiClient(
                new FailingProvider(new IllegalStateException(providerRawMessage))
        );

        assertThatThrownBy(() -> client.generateDailyQuests(new QuestGenerationRequest(personalization())))
                .isInstanceOfSatisfying(QuestAiException.class, exception -> {
                    assertThat(exception.getCode()).isEqualTo("AI_PROVIDER_UNAVAILABLE");
                    assertThat(exception.getMessage()).doesNotContain(providerRawMessage);
                    assertThat(exception.getCause()).isNull();
                });
    }

    private static String expectedCode(ProviderException.FailureType failureType) {
        return switch (failureType) {
            case TIMEOUT -> "AI_PROVIDER_TIMEOUT";
            case QUOTA_EXCEEDED -> "AI_QUOTA_EXCEEDED";
            case INVALID_RESPONSE -> "AI_INVALID_RESPONSE";
            case UNAVAILABLE -> "AI_PROVIDER_UNAVAILABLE";
        };
    }

    private static HttpStatus expectedStatus(ProviderException.FailureType failureType) {
        return switch (failureType) {
            case TIMEOUT -> HttpStatus.GATEWAY_TIMEOUT;
            case QUOTA_EXCEEDED -> HttpStatus.TOO_MANY_REQUESTS;
            case INVALID_RESPONSE -> HttpStatus.BAD_GATEWAY;
            case UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
        };
    }

    private static QuestPayload payload(String title, String category, int minutes) {
        return new QuestPayload(
                title,
                "짧고 구체적인 설명",
                "결과 한 개를 남깁니다.",
                List.of("한 단계"),
                category,
                "EASY",
                minutes
        );
    }

    private static QuestDraft draft(String title, QuestCategory category, int minutes) {
        return new QuestDraft(
                title,
                "짧고 구체적인 설명",
                "결과 한 개를 남깁니다.",
                List.of("한 단계"),
                category,
                QuestDifficulty.EASY,
                minutes
        );
    }

    private static QuestPersonalization personalization() {
        return new QuestPersonalization(
                "백엔드 개발자",
                "서울",
                DesiredWorkType.FULL_TIME,
                12,
                true,
                InterviewExperience.LIMITED,
                EnergyLevel.MEDIUM
        );
    }

    private static final class CapturingProvider implements StructuredQuestProvider {

        private GenerationRequest generationRequest;
        private GenerationResponse generationResponse;
        private RedesignResponse redesignResponse;

        @Override
        public GenerationResponse generate(GenerationRequest request) {
            this.generationRequest = request;
            return generationResponse;
        }

        @Override
        public RedesignResponse redesign(RedesignRequest request) {
            return redesignResponse;
        }
    }

    private static final class FailingProvider implements StructuredQuestProvider {

        private final RuntimeException failure;

        private FailingProvider(RuntimeException failure) {
            this.failure = failure;
        }

        @Override
        public GenerationResponse generate(GenerationRequest request) {
            throw failure;
        }

        @Override
        public RedesignResponse redesign(RedesignRequest request) {
            throw failure;
        }
    }
}
