package com.restartquest.presentation;

import com.restartquest.application.DashboardSummary;
import com.restartquest.application.RedesignHistoryItem;
import com.restartquest.application.RedesignResult;
import com.restartquest.domain.DailyQuest;
import com.restartquest.domain.OnboardingProfile;
import java.util.List;
import java.util.Locale;

final class JsonResponses {
    private JsonResponses() {
    }

    static String profile(OnboardingProfile profile) {
        return "{"
                + field("id", profile.id()) + ","
                + field("region", profile.region()) + ","
                + field("desiredJob", profile.desiredJob()) + ","
                + field("desiredWorkType", profile.desiredWorkType()) + ","
                + field("careerGapMonths", profile.careerGapMonths()) + ","
                + field("hasResume", profile.hasResume()) + ","
                + field("hasInterviewExperience", profile.hasInterviewExperience()) + ","
                + "\"interests\":" + stringArray(profile.interests()) + ","
                + field("energyLevel", profile.energyLevel().name())
                + "}";
    }

    static String quest(DailyQuest quest) {
        return "{"
                + field("id", quest.id()) + ","
                + field("title", quest.title()) + ","
                + field("description", quest.description()) + ","
                + field("category", quest.category().name()) + ","
                + field("difficulty", quest.difficulty().name()) + ","
                + field("estimatedMinutes", quest.estimatedMinutes()) + ","
                + field("completionCriteria", quest.completionCriteria()) + ","
                + field("status", quest.status().name()) + ","
                + nullableField("failureReason", quest.failureReason() == null ? null : quest.failureReason().name()) + ","
                + nullableField("failureNote", quest.failureNote()) + ","
                + nullableField("parentQuestId", quest.parentQuestId())
                + "}";
    }

    static String generatedQuests(List<DailyQuest> quests) {
        return "{\"quests\":" + questArray(quests) + "}";
    }

    static String todayQuests(List<DailyQuest> quests) {
        List<DailyQuest> originals = quests.stream()
                .filter(DailyQuest::isOriginal)
                .toList();
        List<DailyQuest> redesigns = quests.stream()
                .filter(quest -> !quest.isOriginal())
                .toList();
        return "{"
                + "\"quests\":" + questArray(originals) + ","
                + "\"redesignedQuests\":" + questArray(redesigns)
                + "}";
    }

    static String redesignResult(RedesignResult result) {
        return "{"
                + "\"originalQuest\":" + quest(result.originalQuest()) + ","
                + "\"redesignedQuests\":" + questArray(result.redesignedQuests())
                + "}";
    }

    static String dashboard(DashboardSummary summary) {
        return "{"
                + field("totalOriginalQuests", summary.totalOriginalQuests()) + ","
                + field("doneCount", summary.doneCount()) + ","
                + field("failedCount", summary.failedCount()) + ","
                + field("redesignedCount", summary.redesignedCount()) + ","
                + "\"completionRate\":" + String.format(Locale.ROOT, "%.2f", summary.completionRate()) + ","
                + "\"nextAction\":" + (summary.nextAction() == null ? "null" : quest(summary.nextAction())) + ","
                + "\"redesignHistory\":" + redesignHistoryArray(summary.redesignHistory())
                + "}";
    }

    static String error(String message) {
        return "{" + field("error", message) + "}";
    }

    private static String questArray(List<DailyQuest> quests) {
        return "[" + String.join(",", quests.stream()
                .map(JsonResponses::quest)
                .toList()) + "]";
    }

    private static String redesignHistoryArray(List<RedesignHistoryItem> items) {
        return "[" + String.join(",", items.stream()
                .map(item -> "{"
                        + field("originalQuestId", item.originalQuestId()) + ","
                        + field("originalTitle", item.originalTitle()) + ","
                        + nullableField("failureReason", item.failureReason() == null ? null : item.failureReason().name()) + ","
                        + "\"redesignedQuests\":" + questArray(item.redesignedQuests())
                        + "}")
                .toList()) + "]";
    }

    private static String stringArray(List<String> values) {
        return "[" + String.join(",", values.stream()
                .map(JsonResponses::quote)
                .toList()) + "]";
    }

    private static String field(String name, String value) {
        return quote(name) + ":" + quote(value);
    }

    private static String field(String name, int value) {
        return quote(name) + ":" + value;
    }

    private static String field(String name, boolean value) {
        return quote(name) + ":" + value;
    }

    private static String nullableField(String name, String value) {
        return quote(name) + ":" + (value == null ? "null" : quote(value));
    }

    private static String quote(String value) {
        StringBuilder builder = new StringBuilder("\"");
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            switch (current) {
                case '"' -> builder.append("\\\"");
                case '\\' -> builder.append("\\\\");
                case '\b' -> builder.append("\\b");
                case '\f' -> builder.append("\\f");
                case '\n' -> builder.append("\\n");
                case '\r' -> builder.append("\\r");
                case '\t' -> builder.append("\\t");
                default -> builder.append(current);
            }
        }
        return builder.append('"').toString();
    }
}
