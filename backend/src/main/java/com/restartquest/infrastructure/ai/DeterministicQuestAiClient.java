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
        RedesignStrategy strategy = strategy(request, original);
        int minutes = Math.max(5, Math.min(strategy.maximumMinutes(), original.estimatedMinutes()));
        QuestDraft replacement = draft(
                strategy.title(),
                strategy.description(),
                strategy.completionCriteria(),
                strategy.steps(),
                original.category(),
                minutes
        );
        return RedesignedQuest.validate(replacement, request);
    }

    private static RedesignStrategy strategy(QuestRedesignRequest request, QuestDraft original) {
        RedesignStrategy selected = switch (request.reasonCode()) {
            case TIME_SHORTAGE -> new RedesignStrategy(
                    "5분만 시작하기",
                    original.title() + "에서 남은 시간 안에 가능한 한 단계만 진행합니다.",
                    "가장 짧은 단계 하나를 5분 동안 실행합니다.",
                    List.of("타이머를 5분으로 맞추기", "가장 짧은 단계 하나 실행하기"),
                    5
            );
            case TASK_TOO_LARGE -> new RedesignStrategy(
                    "한 조각만 끝내기",
                    original.title() + "의 전체 범위를 작은 결과 하나로 줄입니다.",
                    "작은 결과 한 개를 저장합니다.",
                    List.of("해야 할 일을 세 조각으로 나누기", "첫 조각만 실행하기"),
                    10
            );
            case START_POINT_UNCLEAR -> new RedesignStrategy(
                    "시작점만 정하기",
                    original.title() + "을 시작할 화면과 첫 행동만 정합니다.",
                    "시작할 화면을 열고 첫 행동을 한 줄 적습니다.",
                    List.of("필요한 화면 하나 열기", "첫 행동 한 줄 적기"),
                    10
            );
            case MATERIALS_MISSING -> new RedesignStrategy(
                    "준비물 하나 찾기",
                    original.title() + "에 필요한 자료를 모두 모으지 않고 한 개만 찾습니다.",
                    "필요한 자료 한 개의 위치를 저장합니다.",
                    List.of("필요한 자료 목록 적기", "가장 찾기 쉬운 자료 하나 저장하기"),
                    10
            );
            case LOW_ENERGY -> new RedesignStrategy(
                    "가볍게 열어보기",
                    original.title() + "과 관련된 자료를 열고 한 곳만 표시합니다.",
                    "관련 자료를 열고 한 곳을 표시합니다.",
                    List.of("관련 자료 열기", "눈에 들어오는 한 곳 표시하기"),
                    5
            );
            case TASK_NOT_RELEVANT -> new RedesignStrategy(
                    "지금 필요한 행동 고르기",
                    request.personalization().desiredJob() + " 목표와 가까운 행동 후보를 하나만 고릅니다.",
                    "지금 필요한 행동 한 개를 메모합니다.",
                    List.of("이번 주 목표 한 줄 확인하기", "가장 가까운 행동 하나 고르기"),
                    10
            );
            case OTHER -> new RedesignStrategy(
                    "첫 단계만 시작하기",
                    original.title() + "의 범위를 줄여 첫 단계만 진행합니다.",
                    "첫 단계 한 가지를 마칩니다.",
                    List.of("지금 가능한 첫 단계 하나만 실행하기"),
                    10
            );
        };
        return selected.withDescription(reasonAwareDescription(selected.description(), request.reasonNote()));
    }

    private static String reasonAwareDescription(String description, String reasonNote) {
        if (reasonNote == null) {
            return description;
        }
        return description + " 사용자가 남긴 메모도 반영합니다: " + reasonNote;
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

    private record RedesignStrategy(
            String title,
            String description,
            String completionCriteria,
            List<String> steps,
            int maximumMinutes
    ) {

        private RedesignStrategy withDescription(String updatedDescription) {
            return new RedesignStrategy(
                    title,
                    updatedDescription,
                    completionCriteria,
                    steps,
                    maximumMinutes
            );
        }
    }
}
