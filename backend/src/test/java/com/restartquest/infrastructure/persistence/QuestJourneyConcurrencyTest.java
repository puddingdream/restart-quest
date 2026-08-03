package com.restartquest.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.restartquest.application.port.QuestPlanStore;
import com.restartquest.domain.quest.DailyQuestPlan;
import com.restartquest.domain.quest.QuestJourney;
import com.restartquest.domain.quest.QuestRedesignReasonCode;
import jakarta.persistence.EntityManager;
import jakarta.persistence.EntityManagerFactory;
import jakarta.persistence.OptimisticLockException;
import jakarta.persistence.RollbackException;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.StaleObjectStateException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@DataJpaTest
@Import(QuestPlanStoreAdapter.class)
@Transactional(propagation = Propagation.NOT_SUPPORTED)
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
class QuestJourneyConcurrencyTest {

    @Autowired
    private QuestPlanStore store;

    @Autowired
    private EntityManagerFactory entityManagerFactory;

    @Test
    void concurrentCompletionAndRedesignCannotBothCommit() {
        UUID userId = UUID.randomUUID();
        DailyQuestPlan plan = store.saveForUser(
                userId,
                QuestPlanRepositoryTest.createPlan(userId, LocalDate.of(2026, 8, 1))
        );
        UUID journeyId = plan.getJourneys().get(0).getId();

        QuestJourney completionCopy = loadDetached(journeyId);
        QuestJourney redesignCopy = loadDetached(journeyId);
        UUID currentQuestId = completionCopy.getCurrentQuestId();

        completionCopy.complete(currentQuestId);
        mergeInTransaction(completionCopy);

        redesignCopy.redesign(
                currentQuestId,
                QuestPlanRepositoryTest.replacementSeed(),
                QuestRedesignReasonCode.LOW_ENERGY,
                null
        );
        assertThatThrownBy(() -> mergeInTransaction(redesignCopy))
                .isInstanceOfAny(
                        OptimisticLockException.class,
                        RollbackException.class,
                        StaleObjectStateException.class
                );

        QuestJourney reloaded = store.findJourneyForUser(userId, journeyId).orElseThrow();
        assertThat(reloaded.getCurrentQuest().getStatus().name()).isEqualTo("DONE");
        assertThat(reloaded.getRedesigns()).isEmpty();
    }

    private QuestJourney loadDetached(UUID journeyId) {
        EntityManager entityManager = entityManagerFactory.createEntityManager();
        try {
            entityManager.getTransaction().begin();
            QuestJourney journey = entityManager.find(QuestJourney.class, journeyId);
            journey.getQuests().size();
            journey.getRedesigns().size();
            entityManager.getTransaction().commit();
            return journey;
        } finally {
            entityManager.close();
        }
    }

    private void mergeInTransaction(QuestJourney journey) {
        EntityManager entityManager = entityManagerFactory.createEntityManager();
        try {
            entityManager.getTransaction().begin();
            entityManager.merge(journey);
            entityManager.flush();
            entityManager.getTransaction().commit();
        } catch (RuntimeException exception) {
            if (entityManager.getTransaction().isActive()) {
                entityManager.getTransaction().rollback();
            }
            throw exception;
        } finally {
            entityManager.close();
        }
    }
}
