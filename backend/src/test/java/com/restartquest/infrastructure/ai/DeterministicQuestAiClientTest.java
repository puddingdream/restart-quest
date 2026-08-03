package com.restartquest.infrastructure.ai;

import static org.assertj.core.api.Assertions.assertThat;

import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestDraft;
import com.restartquest.application.ai.QuestGenerationRequest;
import com.restartquest.application.ai.QuestPersonalization;
import com.restartquest.application.ai.QuestRedesignRequest;
import com.restartquest.application.ai.RedesignedQuest;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;

class DeterministicQuestAiClientTest {

    private final DeterministicQuestAiClient client = new DeterministicQuestAiClient();

    @Test
    void returnsSameValidatedThreeQuestsWithoutNetworkOrCredentials() {
        QuestGenerationRequest request = new QuestGenerationRequest(personalization());

        GeneratedQuestBatch first = client.generateDailyQuests(request);
        GeneratedQuestBatch second = client.generateDailyQuests(request);

        assertThat(first).isEqualTo(second);
        assertThat(first.quests()).hasSize(3)
                .allSatisfy(quest -> {
                    assertThat(quest.estimatedMinutes()).isBetween(10, 30);
                    assertThat(quest.steps()).hasSizeBetween(1, 3);
                });
    }

    @Test
    void redesignReturnsOneSmallerQuestKeepingCategory() {
        QuestRedesignRequest request = new QuestRedesignRequest(
                personalization(),
                draft("면접 답변 정리", QuestCategory.INTERVIEW, 12),
                QuestRedesignReasonCode.START_POINT_UNCLEAR,
                null
        );

        RedesignedQuest result = client.redesignQuest(request);

        assertThat(result.replacementQuest().category()).isEqualTo(QuestCategory.INTERVIEW);
        assertThat(result.replacementQuest().estimatedMinutes()).isBetween(5, 12);
        assertThat(result.replacementQuest().steps()).hasSizeBetween(1, 3);
    }

    @Test
    void redesignUsesDistinctRecoveryActionForEveryFailureReason() {
        QuestDraft original = draft("면접 답변 정리", QuestCategory.INTERVIEW, 12);

        List<QuestDraft> replacements = Arrays.stream(QuestRedesignReasonCode.values())
                .map(reasonCode -> client.redesignQuest(new QuestRedesignRequest(
                        personalization(), original, reasonCode, null
                )).replacementQuest())
                .toList();

        assertThat(replacements)
                .extracting(QuestDraft::title)
                .doesNotHaveDuplicates();
        assertThat(replacements).allSatisfy(replacement -> {
            assertThat(replacement.category()).isEqualTo(original.category());
            assertThat(replacement.estimatedMinutes()).isBetween(5, original.estimatedMinutes());
            assertThat(replacement.steps()).hasSizeBetween(1, 3);
        });
    }

    @Test
    void redesignDeterministicallyReflectsOptionalReasonNote() {
        QuestRedesignRequest request = new QuestRedesignRequest(
                personalization(),
                draft("면접 답변 정리", QuestCategory.INTERVIEW, 12),
                QuestRedesignReasonCode.OTHER,
                "공고 용어가 낯설었습니다"
        );

        RedesignedQuest first = client.redesignQuest(request);
        RedesignedQuest second = client.redesignQuest(request);

        assertThat(first.replacementQuest()).isEqualTo(second.replacementQuest());
        assertThat(first.replacementQuest().description()).contains("공고 용어가 낯설었습니다");
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
}
