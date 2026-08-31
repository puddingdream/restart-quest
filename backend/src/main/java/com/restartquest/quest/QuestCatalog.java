package com.restartquest.quest;

import static com.restartquest.quest.QuestModels.EnergyLevel;
import static com.restartquest.quest.QuestModels.FrictionReason;
import static com.restartquest.quest.QuestModels.GoalType;

import com.restartquest.quest.QuestModels.CatalogAction;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class QuestCatalog {

    public static final String VERSION = "v1";

    private final Map<GoalType, Map<Integer, List<CatalogAction>>> actions;
    private final Map<GoalType, CatalogAction> fallbacks;

    public QuestCatalog() {
        actions = new EnumMap<>(GoalType.class);
        actions.put(GoalType.JOB_SEARCH, Map.of(
                1, List.of(
                        action("job-search-write-keyword-v1", "검색어 1개 적기", "찾고 싶은 역할을 검색어 한 개로 적으면 끝입니다.", 5, 1),
                        action("job-search-name-company-v1", "관심 회사 이름 1개 적기", "떠오르는 회사 이름 한 개만 적으면 끝입니다.", 5, 1)),
                2, List.of(
                        action("job-search-save-posting-v1", "조건에 맞는 공고 1개 저장하기", "지원 여부를 정하지 않아도 공고 한 개를 저장하면 끝입니다.", 15, 2),
                        action("job-search-mark-requirement-v1", "공고 요구사항 1개 표시하기", "공고에서 확인할 요구사항 한 줄만 표시하면 끝입니다.", 10, 2)),
                3, List.of(
                        action("job-search-compare-postings-v1", "공고 2개 비교하기", "두 공고의 공통 요구사항 한 가지를 확인하면 끝입니다.", 30, 3),
                        action("job-search-note-criterion-v1", "지원 기준 1개 정리하기", "다음 공고를 고를 기준 한 가지를 문장으로 적으면 끝입니다.", 25, 3))));
        actions.put(GoalType.RESUME, Map.of(
                1, List.of(
                        action("resume-write-keywords-v1", "경험 키워드 3개 적기", "최근 경험에서 떠오르는 단어 세 개만 적으면 끝입니다.", 5, 1),
                        action("resume-name-section-v1", "고칠 항목 이름 1개 적기", "이력서에서 손볼 항목 이름 하나만 적으면 끝입니다.", 5, 1)),
                2, List.of(
                        action("resume-rewrite-sentence-v1", "경험 문장 1개 고치기", "경험 한 문장을 관찰 가능한 행동으로 바꾸면 끝입니다.", 15, 2),
                        action("resume-add-result-v1", "경험 결과 1개 덧붙이기", "기존 문장 한 개에 결과나 변화를 한 구절 덧붙이면 끝입니다.", 12, 2)),
                3, List.of(
                        action("resume-review-section-v1", "이력서 항목 1개 정리하기", "한 항목의 중복 표현을 지우고 핵심 문장을 남기면 끝입니다.", 30, 3),
                        action("resume-align-posting-v1", "공고와 경험 1개 연결하기", "공고 요구사항 하나와 내 경험 하나를 나란히 적으면 끝입니다.", 25, 3))));
        actions.put(GoalType.NETWORKING, Map.of(
                1, List.of(
                        action("networking-name-contact-v1", "연락할 사람 이름 1명 적기", "부담 없이 떠오르는 이름 한 명만 적으면 끝입니다.", 5, 1),
                        action("networking-write-greeting-v1", "안부 문장 1개 적기", "보내지 않아도 짧은 안부 한 문장만 적으면 끝입니다.", 5, 1)),
                2, List.of(
                        action("networking-draft-message-v1", "안부 메시지 초안 쓰기", "인사와 근황을 담은 두 문장 초안을 쓰면 끝입니다.", 15, 2),
                        action("networking-write-question-v1", "물어볼 질문 1개 적기", "상대에게 부담 없이 물을 질문 한 개를 적으면 끝입니다.", 10, 2)),
                3, List.of(
                        action("networking-prepare-message-v1", "연락 메시지 1개 다듬기", "인사, 근황, 질문이 담긴 짧은 메시지를 준비하면 끝입니다.", 30, 3),
                        action("networking-list-contacts-v1", "연락할 사람 3명 정리하기", "이름 세 개와 각자에게 물을 내용 한 단어씩 적으면 끝입니다.", 25, 3))));

        fallbacks = Map.of(
                GoalType.JOB_SEARCH,
                action("job-search-open-tab-v1", "채용 사이트 탭 열기", "사이트를 열면 오늘 행동은 끝입니다.", 2, 1),
                GoalType.RESUME,
                action("resume-find-file-v1", "이력서 파일 위치 확인하기", "파일이 있는 폴더를 열면 오늘 행동은 끝입니다.", 2, 1),
                GoalType.NETWORKING,
                action("networking-open-contacts-v1", "연락처 앱 열기", "연락처 목록을 열면 오늘 행동은 끝입니다.", 2, 1));
    }

    CatalogAction initial(GoalType goalType, EnergyLevel energyLevel, int availableMinutes) {
        return variants(goalType, targetDifficulty(energyLevel, availableMinutes)).getFirst();
    }

    CatalogAction afterCompletion(
            GoalType goalType,
            EnergyLevel energyLevel,
            int availableMinutes,
            String previousCatalogKey) {
        List<CatalogAction> candidates = variants(goalType, targetDifficulty(energyLevel, availableMinutes));
        return candidates.getFirst().key().equals(previousCatalogKey)
                ? candidates.get(1)
                : candidates.getFirst();
    }

    CatalogAction afterReframe(
            GoalType goalType,
            int previousDifficulty,
            FrictionReason reason) {
        if (previousDifficulty <= 1) {
            return fallbacks.get(goalType);
        }
        List<CatalogAction> candidates = variants(goalType, previousDifficulty - 1);
        return candidates.get(reason.ordinal() % candidates.size());
    }

    CatalogAction fallback(GoalType goalType) {
        return fallbacks.get(goalType);
    }

    private List<CatalogAction> variants(GoalType goalType, int difficulty) {
        return actions.get(goalType).get(difficulty);
    }

    private int targetDifficulty(EnergyLevel energyLevel, int availableMinutes) {
        int energyCapacity = energyLevel.ordinal() + 1;
        int timeCapacity = switch (availableMinutes) {
            case 5 -> 1;
            case 15 -> 2;
            case 30 -> 3;
            default -> throw new IllegalArgumentException("availableMinutes is unsupported");
        };
        return Math.min(energyCapacity, timeCapacity);
    }

    private static CatalogAction action(
            String key,
            String title,
            String instruction,
            int estimatedMinutes,
            int difficultyLevel) {
        return new CatalogAction(key, title, instruction, estimatedMinutes, difficultyLevel);
    }
}
