package com.restartquest.application.ai;

import java.util.List;
import java.util.Locale;

final class QuestContentPolicy {

    private static final List<String> FORBIDDEN_PHRASES = List.of(
            "우울증",
            "정신 질환",
            "정신질환",
            "심리 진단",
            "의학적 진단",
            "치료가 필요",
            "상담이 필요",
            "의지가 부족",
            "의지 점수",
            "구직 의지 평가",
            "행동을 감시",
            "사용자를 감시",
            "mental illness",
            "medical diagnosis",
            "psychological diagnosis",
            "needs therapy",
            "needs counseling",
            "motivation score",
            "lack of motivation",
            "monitor the user"
    );

    private QuestContentPolicy() {
    }

    static void validate(String value, String field) {
        String normalized = value.toLowerCase(Locale.ROOT);
        if (FORBIDDEN_PHRASES.stream().anyMatch(normalized::contains)) {
            throw new IllegalArgumentException(field + "에 허용되지 않는 평가·상담·진단 표현이 포함되어 있습니다.");
        }
    }
}
