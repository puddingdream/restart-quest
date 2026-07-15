package com.restartquest.application;

import com.restartquest.domain.DailyQuest;
import java.util.List;

public record RedesignResult(DailyQuest originalQuest, List<DailyQuest> redesignedQuests) {
    public RedesignResult {
        redesignedQuests = List.copyOf(redesignedQuests);
    }
}
