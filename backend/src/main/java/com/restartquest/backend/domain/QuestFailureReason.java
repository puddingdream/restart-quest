package com.restartquest.backend.domain;

public enum QuestFailureReason {
    NOT_ENOUGH_TIME("Reduce the expected time and keep only one step"),
    TOO_OVERWHELMING("Lower the task to reading, choosing, or listing before producing output"),
    UNCLEAR_WHAT_TO_WRITE("Split the task into examples, keywords, and one first sentence"),
    MISSING_MATERIALS("Find or save the needed material before starting the original task"),
    LOW_CONFIDENCE("Use a small check action without judgmental wording"),
    NOT_RELEVANT("Narrow the job, region, or interest condition again"),
    LOW_ENERGY("Use a 5 to 10 minute reading or routine action");

    private final String defaultStrategySummary;

    QuestFailureReason(String defaultStrategySummary) {
        this.defaultStrategySummary = defaultStrategySummary;
    }

    public String defaultStrategySummary() {
        return defaultStrategySummary;
    }
}
