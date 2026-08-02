package com.restartquest.application.quest;

import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestRedesign;

public record RedesignQuestResult(
        QuestJourney journey,
        QuestRedesign redesign
) {
}
