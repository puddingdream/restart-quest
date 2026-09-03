package com.restartquest.quest;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Component;

@Component
class ActionCatalog {

    static final String VERSION = "v1";

    private final List<ActionTemplate> templates = List.of(
            template("explore.compare", FocusArea.EXPLORE, 3, 30, "채용 공고 3개에서 공통 기술 하나 찾기", "explore.requirement"),
            template("explore.requirement", FocusArea.EXPLORE, 2, 15, "채용 공고 하나에서 요구 기술 하나 표시하기", "explore.keyword"),
            template("explore.keyword", FocusArea.EXPLORE, 1, 5, "관심 직무 검색어 하나 적기", "explore.pause"),
            template("explore.pause", FocusArea.EXPLORE, 0, 2, "내일 다시 볼 탐색 한 문장 남기기", null),
            template("resume.result", FocusArea.RESUME, 3, 30, "경험 한 건을 성과형 문장으로 다시 쓰기", "resume.verb"),
            template("resume.verb", FocusArea.RESUME, 2, 15, "경력 한 줄의 동사와 결과 다듬기", "resume.pick"),
            template("resume.pick", FocusArea.RESUME, 1, 5, "고칠 경력 한 줄 표시하기", "resume.pause"),
            template("resume.pause", FocusArea.RESUME, 0, 2, "내일 다시 볼 이력서 한 문장 남기기", null),
            template("apply.motivation", FocusArea.APPLY, 3, 30, "공고 하나에 맞춰 지원 동기 첫 문장 쓰기", "apply.match"),
            template("apply.match", FocusArea.APPLY, 2, 15, "요구사항 하나와 내 경험 하나 연결하기", "apply.open"),
            template("apply.open", FocusArea.APPLY, 1, 5, "지원 후보 공고 하나 열고 제목 적기", "apply.pause"),
            template("apply.pause", FocusArea.APPLY, 0, 2, "내일 다시 볼 공고 한 문장 남기기", null),
            template("interview.star", FocusArea.INTERVIEW, 3, 30, "질문 하나에 STAR 답변 초안 만들기", "interview.points"),
            template("interview.points", FocusArea.INTERVIEW, 2, 15, "답변의 상황·행동·결과 핵심어 적기", "interview.question"),
            template("interview.question", FocusArea.INTERVIEW, 1, 5, "연습할 면접 질문 하나 고르기", "interview.pause"),
            template("interview.pause", FocusArea.INTERVIEW, 0, 2, "내일 다시 볼 질문 한 문장 남기기", null));

    private final Map<String, ActionTemplate> templatesByKey;

    ActionCatalog() {
        Map<String, ActionTemplate> indexed = new HashMap<>();
        for (ActionTemplate template : templates) {
            if (indexed.put(template.key(), template) != null) {
                throw new IllegalStateException("Duplicate action template key");
            }
        }
        templatesByKey = Map.copyOf(indexed);
        validateFallbacks();
    }

    Recommendation recommend(FocusArea focusArea, int availableMinutes, EnergyLevel energyLevel) {
        int difficultyLimit = Math.min(energyLimit(energyLevel), timeLimit(availableMinutes));
        ActionTemplate selected = templates.stream()
                .filter(template -> template.focusArea() == focusArea)
                .filter(template -> template.difficulty() > 0)
                .filter(template -> template.difficulty() <= difficultyLimit)
                .max(java.util.Comparator.comparingInt(ActionTemplate::difficulty))
                .orElseThrow(() -> new IllegalStateException("No action template for supported check-in"));
        return new Recommendation(selected, recommendationReason(energyLevel, availableMinutes));
    }

    Recommendation fallback(String templateKey) {
        ActionTemplate current = requireTemplate(templateKey);
        if (current.fallbackKey() == null) {
            return null;
        }
        return new Recommendation(
                requireTemplate(current.fallbackKey()),
                "지금 막힌 행동보다 더 작고 짧은 행동으로 바꿨어요.");
    }

    private ActionTemplate requireTemplate(String key) {
        ActionTemplate template = templatesByKey.get(key);
        if (template == null) {
            throw new IllegalStateException("Unknown action template key");
        }
        return template;
    }

    private int energyLimit(EnergyLevel energyLevel) {
        return switch (energyLevel) {
            case LOW -> 1;
            case MEDIUM -> 2;
            case HIGH -> 3;
        };
    }

    private int timeLimit(int availableMinutes) {
        return switch (availableMinutes) {
            case 5 -> 1;
            case 15 -> 2;
            case 30 -> 3;
            default -> throw new IllegalArgumentException("Unsupported available minutes");
        };
    }

    private String recommendationReason(EnergyLevel energyLevel, int availableMinutes) {
        String energy = switch (energyLevel) {
            case LOW -> "낮은";
            case MEDIUM -> "보통";
            case HIGH -> "높은";
        };
        return energy + " 에너지와 " + availableMinutes + "분 안에 끝낼 수 있는 행동을 골랐어요.";
    }

    private void validateFallbacks() {
        for (ActionTemplate start : templates) {
            Set<String> visited = new HashSet<>();
            ActionTemplate current = start;
            while (current.fallbackKey() != null) {
                if (!visited.add(current.key())) {
                    throw new IllegalStateException("Action template fallback cycle");
                }
                ActionTemplate fallback = requireTemplate(current.fallbackKey());
                if (fallback.focusArea() != current.focusArea()
                        || fallback.difficulty() >= current.difficulty()
                        || fallback.minutes() > current.minutes()) {
                    throw new IllegalStateException("Action template fallback must be smaller");
                }
                current = fallback;
            }
        }
    }

    private static ActionTemplate template(
            String key,
            FocusArea focusArea,
            int difficulty,
            int minutes,
            String title,
            String fallbackKey) {
        return new ActionTemplate(key, focusArea, difficulty, minutes, title, fallbackKey);
    }

    record Recommendation(ActionTemplate template, String reason) {
    }

    record ActionTemplate(
            String key,
            FocusArea focusArea,
            int difficulty,
            int minutes,
            String title,
            String fallbackKey) {
    }
}
