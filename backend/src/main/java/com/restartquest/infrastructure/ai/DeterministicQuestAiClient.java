package com.restartquest.infrastructure.ai;

import com.restartquest.application.ai.GeneratedQuestBatch;
import com.restartquest.application.ai.QuestDraft;
import com.restartquest.application.ai.QuestGenerationRequest;
import com.restartquest.application.ai.QuestRedesignRequest;
import com.restartquest.application.ai.RedesignedQuest;
import com.restartquest.application.port.QuestAiClient;
import com.restartquest.domain.quest.EnergyLevel;
import com.restartquest.domain.quest.QuestCategory;
import com.restartquest.domain.quest.QuestDifficulty;
import java.util.List;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(
        prefix = "restartquest.ai",
        name = "provider",
        havingValue = "deterministic",
        matchIfMissing = true
)
public class DeterministicQuestAiClient implements QuestAiClient {

    @Override
    public GeneratedQuestBatch generateDailyQuests(QuestGenerationRequest request) {
        int minutes = generationMinutes(request.personalization().energyLevel());
        String desiredJob = request.personalization().desiredJob();
        return new GeneratedQuestBatch(List.of(
                draft(
                        "이력서 핵심 문장 다듬기",
                        desiredJob + " 직무와 연결되는 경험 한 가지를 짧게 정리합니다.",
                        "경험과 결과가 담긴 문장 한 개를 작성합니다.",
                        List.of("경험 하나 고르기", "행동과 결과를 한 문장으로 쓰기"),
                        QuestCategory.RESUME,
                        minutes
                ),
                draft(
                        "관심 공고 조건 살펴보기",
                        desiredJob + " 공고에서 오늘 확인할 조건만 가볍게 살펴봅니다.",
                        "관심 조건 두 가지를 메모합니다.",
                        List.of("더미 또는 저장한 공고 하나 열기", "관심 조건 두 가지 적기"),
                        QuestCategory.JOB_SEARCH,
                        minutes
                ),
                draft(
                        "내일 시작점 준비하기",
                        "다음 구직 행동을 바로 시작할 수 있도록 첫 자료를 준비합니다.",
                        "다음에 열 자료 한 개를 정해 둡니다.",
                        List.of("다음 행동 하나 고르기", "필요한 자료 위치 확인하기"),
                        QuestCategory.ROUTINE,
                        minutes
                )
        ));
    }

    @Override
    public RedesignedQuest redesignQuest(QuestRedesignRequest request) {
        QuestDraft original = request.originalQuest();
        int minutes = Math.max(5, Math.min(10, original.estimatedMinutes()));
        QuestDraft replacement = draft(
                "첫 단계만 시작하기",
                original.title() + "의 범위를 줄여 첫 단계만 진행합니다.",
                "첫 단계 한 가지를 마칩니다.",
                List.of("지금 가능한 첫 단계 하나만 실행하기"),
                original.category(),
                minutes
        );
        return RedesignedQuest.validate(replacement, request);
    }

    private static int generationMinutes(EnergyLevel energyLevel) {
        return switch (energyLevel) {
            case LOW -> 10;
            case MEDIUM -> 15;
            case HIGH -> 20;
        };
    }

    private static QuestDraft draft(
            String title,
            String description,
            String completionCriteria,
            List<String> steps,
            QuestCategory category,
            int estimatedMinutes
    ) {
        return new QuestDraft(
                title,
                description,
                completionCriteria,
                steps,
                category,
                QuestDifficulty.EASY,
                estimatedMinutes
        );
    }
}
