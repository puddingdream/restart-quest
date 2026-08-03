package com.restartquest.application.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import com.restartquest.domain.user.DesiredWorkType;
import com.restartquest.domain.user.InterviewExperience;
import java.util.List;
import org.junit.jupiter.api.Test;

class QuestAiOutputValidationTest {

    @Test
    void generationRequiresExactlyThreeUniqueQuestsWithinMinuteRange() {
        QuestDraft first = draft("첫 퀘스트", QuestCategory.RESUME, 10, List.of("한 단계"));
        QuestDraft second = draft("둘째 퀘스트", QuestCategory.JOB_SEARCH, 20, List.of("한 단계", "두 단계"));
        QuestDraft third = draft("셋째 퀘스트", QuestCategory.ROUTINE, 30, List.of("한 단계"));

        GeneratedQuestBatch result = new GeneratedQuestBatch(List.of(first, second, third));

        assertThat(result.toAiGeneratedSeeds()).hasSize(3).allMatch(seed -> seed.generatedByAi());
        assertThatThrownBy(() -> new GeneratedQuestBatch(List.of(first, second)))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GeneratedQuestBatch(List.of(first, second, draft(
                "  첫 퀘스트  ", QuestCategory.INTERVIEW, 15, List.of("한 단계")
        )))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new GeneratedQuestBatch(List.of(first, second, draft(
                "시간 초과", QuestCategory.LEARNING, 31, List.of("한 단계")
        )))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void questDraftRequiresAllFieldsKnownEnumsAndOneToThreeSteps() {
        assertThatThrownBy(() -> new QuestDraft(
                " ", "설명", "완료 기준", List.of("단계"),
                QuestCategory.RESUME, QuestDifficulty.EASY, 10
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new QuestDraft(
                "제목", "설명", "완료 기준", List.of(),
                QuestCategory.RESUME, QuestDifficulty.EASY, 10
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new QuestDraft(
                "제목", "설명", "완료 기준", List.of("1", "2", "3", "4"),
                QuestCategory.RESUME, QuestDifficulty.EASY, 10
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new QuestDraft(
                "제목", "설명", "완료 기준", List.of("단계"),
                null, QuestDifficulty.EASY, 10
        )).isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new QuestDraft(
                "제목", "설명", "완료 기준", List.of("단계"),
                QuestCategory.RESUME, null, 10
        )).isInstanceOf(NullPointerException.class);
    }

    @Test
    void redesignRequiresOneReplacementWithSameCategoryAndNoMoreTimeThanOriginal() {
        QuestRedesignRequest request = redesignRequest(draft(
                "원본", QuestCategory.INTERVIEW, 12, List.of("한 단계", "두 단계")
        ));
        QuestDraft validReplacement = draft("대체", QuestCategory.INTERVIEW, 10, List.of("한 단계"));

        RedesignedQuest result = RedesignedQuest.validate(validReplacement, request);

        assertThat(result.replacementQuest()).isEqualTo(validReplacement);
        assertThat(result.toAiGeneratedSeed().generatedByAi()).isTrue();
        assertThatThrownBy(() -> RedesignedQuest.validate(
                draft("다른 범주", QuestCategory.RESUME, 10, List.of("한 단계")), request
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RedesignedQuest.validate(
                draft("너무 긺", QuestCategory.INTERVIEW, 13, List.of("한 단계")), request
        )).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> RedesignedQuest.validate(
                draft("범위 초과", QuestCategory.INTERVIEW, 16, List.of("한 단계")), request
        )).isInstanceOf(IllegalArgumentException.class);
    }

    private static QuestRedesignRequest redesignRequest(QuestDraft original) {
        return new QuestRedesignRequest(
                personalization(),
                original,
                QuestRedesignReasonCode.TASK_TOO_LARGE,
                "범위를 줄여 볼게요."
        );
    }

    static QuestPersonalization personalization() {
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

    static QuestDraft draft(String title, QuestCategory category, int minutes, List<String> steps) {
        return new QuestDraft(
                title,
                "짧고 구체적인 설명",
                "결과 한 개를 남깁니다.",
                steps,
                category,
                QuestDifficulty.EASY,
                minutes
        );
    }
}
