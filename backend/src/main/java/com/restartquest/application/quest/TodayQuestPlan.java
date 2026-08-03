package com.restartquest.application.quest;

import com.restartquest.domain.quest.DailyQuestPlan;
import java.time.LocalDate;
import java.util.Objects;

public record TodayQuestPlan(
        LocalDate questDate,
        DailyQuestPlan plan,
        boolean generatedNow
) {

    public TodayQuestPlan {
        Objects.requireNonNull(questDate, "questDate는 필수입니다.");
        if (generatedNow && plan == null) {
            throw new IllegalArgumentException("신규 생성 결과에는 일일 계획이 필요합니다.");
        }
    }

    public static TodayQuestPlan empty(LocalDate questDate) {
        return new TodayQuestPlan(questDate, null, false);
    }

    public static TodayQuestPlan existing(DailyQuestPlan plan) {
        return new TodayQuestPlan(plan.getQuestDate(), plan, false);
    }

    public static TodayQuestPlan generated(DailyQuestPlan plan) {
        return new TodayQuestPlan(plan.getQuestDate(), plan, true);
    }

    public boolean hasPlan() {
        return plan != null;
    }
}
