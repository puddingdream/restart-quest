package com.restartquest.quest;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface DailyCheckInRepository extends JpaRepository<DailyCheckIn, UUID> {

    Optional<DailyCheckIn> findByAccountIdAndLocalDate(UUID accountId, LocalDate localDate);

    List<DailyCheckIn> findByAccountIdAndLocalDateBetweenOrderByLocalDateDesc(
            UUID accountId,
            LocalDate from,
            LocalDate to);
}

interface QuestRepository extends JpaRepository<Quest, UUID> {

    boolean existsByAccountIdAndStatus(UUID accountId, QuestStatus status);

    Optional<Quest> findByIdAndAccountId(UUID id, UUID accountId);

    Optional<Quest> findFirstByAccountIdAndStatusOrderByCreatedAtDesc(
            UUID accountId,
            QuestStatus status);

    Optional<Quest> findFirstByAccountIdAndCheckInIdAndStatusOrderByCreatedAtDesc(
            UUID accountId,
            UUID checkInId,
            QuestStatus status);

    List<Quest> findByAccountIdAndCheckInIdIn(UUID accountId, Collection<UUID> checkInIds);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Quest quest
               set quest.status = :nextStatus,
                   quest.activeMarker = null,
                   quest.version = quest.version + 1
             where quest.id = :questId
               and quest.accountId = :accountId
               and quest.status = :activeStatus
               and quest.version = :expectedVersion
            """)
    int transition(
            @Param("questId") UUID questId,
            @Param("accountId") UUID accountId,
            @Param("expectedVersion") long expectedVersion,
            @Param("activeStatus") QuestStatus activeStatus,
            @Param("nextStatus") QuestStatus nextStatus);
}

interface QuestOutcomeRepository extends JpaRepository<QuestOutcome, UUID> {

    List<QuestOutcome> findByQuestIdInOrderByCreatedAtAsc(Collection<UUID> questIds);
}
