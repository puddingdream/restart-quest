package com.restartquest.backend.domain;

import java.util.Locale;

final class TextRules {
    private TextRules() {
    }

    static void requireText(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }

    static void rejectEvaluationLanguage(String text) {
        String normalized = text.toLowerCase(Locale.ROOT);
        String[] forbiddenPhrases = {
                "willpower score",
                "risk score",
                "diagnosis",
                "therapy",
                "surveillance",
                "lazy"
        };
        for (String phrase : forbiddenPhrases) {
            if (normalized.contains(phrase)) {
                throw new IllegalArgumentException("quest text contains evaluation or counseling language");
            }
        }
    }
}
