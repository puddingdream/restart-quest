package com.restartquest.domain;

import com.restartquest.api.ApiModels.BlockerCode;
import org.springframework.stereotype.Component;

@Component
public class SuggestionPolicy {
    public Suggestion suggest(BlockerCode blockerCode, String actionTitle, int estimatedMinutes) {
        Rule rule = switch (blockerCode) {
            case TOO_BIG -> new Rule("FIRST_STEP", "첫 단계만 분리해 보세요.", "첫 단계만 하기: ",
                    Math.max(2, Math.min(5, estimatedMinutes / 2)));
            case LOW_ENERGY -> new Rule("PREPARE_ONLY", "시작할 준비만 해도 충분해요.", "시작할 준비만 하기: ", 2);
            case UNCLEAR -> new Rule("CLARIFY_DONE", "완료 기준을 한 줄로 정해 보세요.", "완료 기준 한 줄 쓰기: ", 5);
            case NO_TIME -> new Rule("OPEN_RESOURCES", "다음 시작에 필요한 것만 열어 두세요.", "필요한 것 열어 두기: ", 2);
            case OTHER -> new Rule("CHOOSE_SMALLER", "더 작은 다음 한 가지만 정해 보세요.", "더 작은 한 가지 정하기: ",
                    Math.min(5, estimatedMinutes));
        };
        return new Suggestion(rule.strategyCode, rule.guidance, fit(rule.prefix, actionTitle), rule.minutes);
    }

    private String fit(String prefix, String original) {
        int allowedCodePoints = 100 - prefix.codePointCount(0, prefix.length());
        int originalCodePoints = original.codePointCount(0, original.length());
        if (originalCodePoints <= allowedCodePoints) return prefix + original;
        int end = original.offsetByCodePoints(0, allowedCodePoints);
        return prefix + original.substring(0, end);
    }

    private record Rule(String strategyCode, String guidance, String prefix, int minutes) {}
    public record Suggestion(String strategyCode, String guidance, String title, int estimatedMinutes) {}
}
