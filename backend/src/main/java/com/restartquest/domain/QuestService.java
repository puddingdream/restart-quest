package com.restartquest.domain;

import com.restartquest.api.ApiException;
import com.restartquest.api.ApiException.FieldIssue;
import com.restartquest.api.ApiModels.ActionInput;
import com.restartquest.api.ApiModels.AdaptationRequest;
import com.restartquest.api.ApiModels.AttemptRequest;
import com.restartquest.api.ApiModels.CreateQuestRequest;
import com.restartquest.api.ApiModels.Outcome;
import com.restartquest.security.WorkspaceSessionService;
import com.restartquest.security.WorkspaceSessionService.WorkspaceSession;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class QuestService {
    private final JdbcTemplate jdbc;
    private final SuggestionPolicy suggestions;
    private final WorkspaceSessionService sessions;

    public QuestService(JdbcTemplate jdbc, SuggestionPolicy suggestions, WorkspaceSessionService sessions) {
        this.jdbc = jdbc;
        this.suggestions = suggestions;
        this.sessions = sessions;
    }

    public Map<String, Object> createQuest(UUID workspaceId, CreateQuestRequest request) {
        String questTitle = title(request.title(), 120, "title");
        String actionTitle = title(request.firstAction().title(), 100, "firstAction.title");
        Integer active = jdbc.queryForObject(
                "select count(*) from quests where workspace_id = ? and status = 'ACTIVE'", Integer.class, workspaceId);
        if (active != null && active > 0) throw ApiException.conflict("ACTIVE_QUEST_EXISTS");

        QuestRow quest = jdbc.queryForObject(
                "insert into quests(id, workspace_id, status, title) values (?, ?, 'ACTIVE', ?) " +
                        "returning id, status, title, version, created_at, completed_at, archived_at",
                this::questRow, UUID.randomUUID(), workspaceId, questTitle);
        ActionRow action = insertAction(workspaceId, quest.id, actionTitle,
                request.firstAction().estimatedMinutes(), null);
        return response("quest", questMap(quest), "action", actionMap(action),
                "nextRequiredAction", "DO_READY_ACTION");
    }

    public Map<String, Object> createAction(UUID workspaceId, UUID questId, ActionInput request) {
        String actionTitle = title(request.title(), 100, "title");
        QuestRow quest = findQuestForUpdate(workspaceId, questId);
        if (!"ACTIVE".equals(quest.status)) throw ApiException.conflict("QUEST_NOT_ACTIVE");
        if (count("select count(*) from actions where workspace_id = ? and quest_id = ? and status = 'READY'",
                workspaceId, questId) > 0) throw ApiException.conflict("READY_ACTION_EXISTS");
        if (pendingAdaptations(workspaceId, questId) > 0) throw ApiException.conflict("PENDING_ADAPTATION_EXISTS");

        ActionRow action = insertAction(workspaceId, questId, actionTitle, request.estimatedMinutes(), null);
        return response("action", actionMap(action), "nextRequiredAction", "DO_READY_ACTION");
    }

    public Map<String, Object> recordAttempt(UUID workspaceId, UUID actionId, AttemptRequest request) {
        ActionRow action = findActionForUpdate(workspaceId, actionId);
        if (!"READY".equals(action.status)) throw ApiException.conflict("ACTION_ALREADY_RESOLVED");
        validateAttempt(request);

        SuggestionPolicy.Suggestion suggestion = request.outcome() == Outcome.BLOCKED
                ? suggestions.suggest(request.blockerCode(), action.title, action.estimatedMinutes) : null;
        UUID attemptId = UUID.randomUUID();
        String note = optionalTrimmed(request.note());
        AttemptRow attempt = jdbc.queryForObject(
                "insert into attempts(id, workspace_id, quest_id, action_id, outcome, blocker_code, note, " +
                        "strategy_code, guidance, suggested_title, suggested_minutes) " +
                        "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                        "returning id, action_id, outcome, blocker_code, note, strategy_code, guidance, " +
                        "suggested_title, suggested_minutes, created_at",
                this::attemptRow, attemptId, workspaceId, action.questId, action.id, request.outcome().name(),
                request.blockerCode() == null ? null : request.blockerCode().name(), note,
                suggestion == null ? null : suggestion.strategyCode(),
                suggestion == null ? null : suggestion.guidance(),
                suggestion == null ? null : suggestion.title(),
                suggestion == null ? null : suggestion.estimatedMinutes());
        jdbc.update("update actions set status = ?, ended_at = now() where id = ? and workspace_id = ? and status = 'READY'",
                request.outcome().name(), actionId, workspaceId);
        ActionRow ended = findAction(workspaceId, actionId);

        Map<String, Object> result = response("attempt", attemptMap(attempt), "action", actionMap(ended),
                "nextRequiredAction", request.outcome() == Outcome.BLOCKED
                        ? "ADAPT_BLOCKED_ACTION" : "CREATE_NEXT_ACTION_OR_COMPLETE");
        if (suggestion != null) result.put("suggestion", suggestionMap(suggestion));
        return result;
    }

    public Map<String, Object> adapt(UUID workspaceId, UUID attemptId, AdaptationRequest request) {
        String actionTitle = title(request.title(), 100, "title");
        AttemptWithQuest attempt = findAttemptForUpdate(workspaceId, attemptId);
        if (!"BLOCKED".equals(attempt.outcome)) throw ApiException.conflict("ATTEMPT_NOT_BLOCKED");
        if (count("select count(*) from actions where workspace_id = ? and source_attempt_id = ?",
                workspaceId, attemptId) > 0) throw ApiException.conflict("ADAPTATION_EXISTS");
        if (count("select count(*) from actions where workspace_id = ? and quest_id = ? and status = 'READY'",
                workspaceId, attempt.questId) > 0) throw ApiException.conflict("READY_ACTION_EXISTS");

        ActionRow successor = insertAction(workspaceId, attempt.questId, actionTitle,
                request.estimatedMinutes(), attemptId);
        return response("action", actionMap(successor), "nextRequiredAction", "DO_READY_ACTION");
    }

    public Map<String, Object> completeQuest(UUID workspaceId, UUID questId, long expectedVersion) {
        QuestRow quest = findQuestForUpdate(workspaceId, questId);
        if (!"ACTIVE".equals(quest.status)) throw ApiException.conflict("QUEST_NOT_ACTIVE");
        if (quest.version != expectedVersion) throw ApiException.conflict("STALE_STATE");
        if (count("select count(*) from actions where workspace_id = ? and quest_id = ? and status = 'READY'",
                workspaceId, questId) > 0 || pendingAdaptations(workspaceId, questId) > 0) {
            throw ApiException.conflict("QUEST_HAS_PENDING_ACTION");
        }
        QuestRow completed = jdbc.queryForObject(
                "update quests set status = 'COMPLETED', completed_at = now(), version = version + 1 " +
                        "where id = ? and workspace_id = ? returning id, status, title, version, created_at, completed_at, archived_at",
                this::questRow, questId, workspaceId);
        return response("quest", questMap(completed), "nextRequiredAction", "START_NEW_QUEST");
    }

    public Map<String, Object> archiveQuest(UUID workspaceId, UUID questId, long expectedVersion) {
        QuestRow quest = findQuestForUpdate(workspaceId, questId);
        if (!"ACTIVE".equals(quest.status)) throw ApiException.conflict("QUEST_NOT_ACTIVE");
        if (quest.version != expectedVersion) throw ApiException.conflict("STALE_STATE");
        jdbc.update("update actions set status = 'CANCELLED', ended_at = now() " +
                "where workspace_id = ? and quest_id = ? and status = 'READY'", workspaceId, questId);
        QuestRow archived = jdbc.queryForObject(
                "update quests set status = 'ARCHIVED', archived_at = now(), version = version + 1 " +
                        "where id = ? and workspace_id = ? returning id, status, title, version, created_at, completed_at, archived_at",
                this::questRow, questId, workspaceId);
        return response("quest", questMap(archived), "nextRequiredAction", "START_NEW_QUEST");
    }

    @Transactional(readOnly = true)
    public Map<String, Object> bootstrap(WorkspaceSession workspace) {
        List<QuestRow> activeRows = jdbc.query(
                "select id, status, title, version, created_at, completed_at, archived_at from quests " +
                        "where workspace_id = ? and status = 'ACTIVE'", this::questRow, workspace.id());
        QuestRow active = activeRows.stream().findFirst().orElse(null);
        ActionRow current = null;
        PendingAdaptation pending = null;
        if (active != null) {
            List<ActionRow> ready = jdbc.query(
                    "select id, quest_id, status, title, estimated_minutes, source_attempt_id, created_at, ended_at " +
                            "from actions where workspace_id = ? and quest_id = ? and status = 'READY'",
                    this::actionRow, workspace.id(), active.id);
            current = ready.stream().findFirst().orElse(null);
            pending = findPending(workspace.id(), active.id);
        }

        String next = nextRequired(workspace.id(), active, current, pending);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("workspace", response("id", workspace.id(), "timezone", workspace.timezone()));
        result.put("activeQuest", active == null ? null : questMap(active));
        result.put("currentAction", current == null ? null : actionMap(current));
        result.put("pendingAdaptation", pending == null ? null : pendingMap(pending));
        result.put("recentAttempts", historyItems(workspace.id(), null, 10));
        result.put("nextRequiredAction", next);
        result.put("csrfToken", workspace.csrfToken());
        result.put("workspaceExpiresAt", workspace.expiresAt().toInstant().toString());
        return result;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> history(UUID workspaceId, String cursorValue, int size) {
        if (size < 1 || size > 50) throw ApiException.badRequest("INVALID_CURSOR");
        Cursor cursor = null;
        if (cursorValue != null && !cursorValue.isBlank()) {
            UUID cursorId;
            try {
                cursorId = UUID.fromString(cursorValue);
            } catch (IllegalArgumentException exception) {
                throw ApiException.badRequest("INVALID_CURSOR");
            }
            List<Cursor> cursors = jdbc.query(
                    "select id, created_at from attempts where workspace_id = ? and id = ?",
                    (rs, row) -> new Cursor(rs.getObject("id", UUID.class), timestamp(rs, "created_at")),
                    workspaceId, cursorId);
            if (cursors.isEmpty()) throw ApiException.badRequest("INVALID_CURSOR");
            cursor = cursors.getFirst();
        }

        List<Map<String, Object>> items = historyItems(workspaceId, cursor, size + 1);
        boolean hasMore = items.size() > size;
        List<Map<String, Object>> page = hasMore ? new ArrayList<>(items.subList(0, size)) : items;
        String nextCursor = hasMore ? ((Map<?, ?>) page.getLast().get("attempt")).get("id").toString() : null;
        return response("items", page, "nextCursor", nextCursor);
    }

    @Transactional
    public void deleteWorkspace(UUID workspaceId) {
        sessions.lock(workspaceId);
        jdbc.update("delete from workspaces where id = ?", workspaceId);
    }

    private ActionRow insertAction(UUID workspaceId, UUID questId, String title, int minutes, UUID sourceAttemptId) {
        return jdbc.queryForObject(
                "insert into actions(id, workspace_id, quest_id, status, title, estimated_minutes, source_attempt_id) " +
                        "values (?, ?, ?, 'READY', ?, ?, ?) returning id, quest_id, status, title, estimated_minutes, " +
                        "source_attempt_id, created_at, ended_at",
                this::actionRow, UUID.randomUUID(), workspaceId, questId, title, minutes, sourceAttemptId);
    }

    private QuestRow findQuestForUpdate(UUID workspaceId, UUID questId) {
        List<QuestRow> rows = jdbc.query(
                "select id, status, title, version, created_at, completed_at, archived_at from quests " +
                        "where workspace_id = ? and id = ? for update",
                this::questRow, workspaceId, questId);
        if (rows.isEmpty()) throw ApiException.notFound();
        return rows.getFirst();
    }

    private ActionRow findActionForUpdate(UUID workspaceId, UUID actionId) {
        List<ActionRow> rows = jdbc.query(
                "select id, quest_id, status, title, estimated_minutes, source_attempt_id, created_at, ended_at " +
                        "from actions where workspace_id = ? and id = ? for update",
                this::actionRow, workspaceId, actionId);
        if (rows.isEmpty()) throw ApiException.notFound();
        return rows.getFirst();
    }

    private ActionRow findAction(UUID workspaceId, UUID actionId) {
        return jdbc.queryForObject(
                "select id, quest_id, status, title, estimated_minutes, source_attempt_id, created_at, ended_at " +
                        "from actions where workspace_id = ? and id = ?",
                this::actionRow, workspaceId, actionId);
    }

    private AttemptWithQuest findAttemptForUpdate(UUID workspaceId, UUID attemptId) {
        List<AttemptWithQuest> rows = jdbc.query(
                "select t.id, t.quest_id, t.outcome from attempts t where t.workspace_id = ? and t.id = ? for update",
                (rs, row) -> new AttemptWithQuest(rs.getObject("id", UUID.class),
                        rs.getObject("quest_id", UUID.class), rs.getString("outcome")),
                workspaceId, attemptId);
        if (rows.isEmpty()) throw ApiException.notFound();
        return rows.getFirst();
    }

    private PendingAdaptation findPending(UUID workspaceId, UUID questId) {
        List<PendingAdaptation> rows = jdbc.query(
                "select t.id, t.action_id, t.outcome, t.blocker_code, t.note, t.strategy_code, t.guidance, " +
                        "t.suggested_title, t.suggested_minutes, t.created_at " +
                        "from attempts t left join actions s on s.source_attempt_id = t.id " +
                        "where t.workspace_id = ? and t.quest_id = ? and t.outcome = 'BLOCKED' and s.id is null " +
                        "order by t.created_at desc, t.id desc limit 1",
                (rs, row) -> new PendingAdaptation(attemptRow(rs, row)), workspaceId, questId);
        return rows.stream().findFirst().orElse(null);
    }

    private int pendingAdaptations(UUID workspaceId, UUID questId) {
        return count("select count(*) from attempts t left join actions s on s.source_attempt_id = t.id " +
                "where t.workspace_id = ? and t.quest_id = ? and t.outcome = 'BLOCKED' and s.id is null",
                workspaceId, questId);
    }

    private List<Map<String, Object>> historyItems(UUID workspaceId, Cursor cursor, int limit) {
        String base = "select t.id t_id, t.action_id t_action_id, t.outcome t_outcome, t.blocker_code t_blocker_code, " +
                "t.note t_note, t.strategy_code t_strategy_code, t.guidance t_guidance, " +
                "t.suggested_title t_suggested_title, t.suggested_minutes t_suggested_minutes, t.created_at t_created_at, " +
                "a.id a_id, a.quest_id a_quest_id, a.status a_status, a.title a_title, " +
                "a.estimated_minutes a_estimated_minutes, a.source_attempt_id a_source_attempt_id, " +
                "a.created_at a_created_at, a.ended_at a_ended_at, " +
                "s.id s_id, s.quest_id s_quest_id, s.status s_status, s.title s_title, " +
                "s.estimated_minutes s_estimated_minutes, s.source_attempt_id s_source_attempt_id, " +
                "s.created_at s_created_at, s.ended_at s_ended_at " +
                "from attempts t join actions a on a.id = t.action_id " +
                "left join actions s on s.source_attempt_id = t.id where t.workspace_id = ? ";
        Object[] args;
        if (cursor == null) {
            base += "order by t.created_at desc, t.id desc limit ?";
            args = new Object[]{workspaceId, limit};
        } else {
            base += "and (t.created_at < ? or (t.created_at = ? and t.id < ?)) " +
                    "order by t.created_at desc, t.id desc limit ?";
            args = new Object[]{workspaceId, cursor.createdAt, cursor.createdAt, cursor.id, limit};
        }
        return jdbc.query(base, (rs, row) -> {
            AttemptRow attempt = attemptRow(rs, "t_");
            ActionRow action = actionRow(rs, "a_");
            UUID successorId = rs.getObject("s_id", UUID.class);
            Map<String, Object> item = response("attempt", attemptMap(attempt), "action", actionMap(action));
            if (successorId != null) item.put("successorAction", actionMap(actionRow(rs, "s_")));
            return item;
        }, args);
    }

    private String nextRequired(UUID workspaceId, QuestRow active, ActionRow current, PendingAdaptation pending) {
        if (active == null) {
            return count("select count(*) from quests where workspace_id = ?", workspaceId) == 0
                    ? "CREATE_QUEST" : "START_NEW_QUEST";
        }
        if (current != null) return "DO_READY_ACTION";
        if (pending != null) return "ADAPT_BLOCKED_ACTION";
        return "CREATE_NEXT_ACTION_OR_COMPLETE";
    }

    private void validateAttempt(AttemptRequest request) {
        if (request.outcome() == Outcome.BLOCKED && request.blockerCode() == null) {
            throw validation("blockerCode", "REQUIRED");
        }
        if (request.outcome() == Outcome.DONE && request.blockerCode() != null) {
            throw validation("blockerCode", "NOT_ALLOWED");
        }
        if (request.note() != null && request.note().codePointCount(0, request.note().length()) > 500) {
            throw validation("note", "INVALID_LENGTH");
        }
    }

    private String title(String value, int max, String field) {
        String normalized = value == null ? "" : value.trim();
        int length = normalized.codePointCount(0, normalized.length());
        if (length < 1) throw validation(field, "REQUIRED");
        if (length > max) throw validation(field, "INVALID_LENGTH");
        return normalized;
    }

    private String optionalTrimmed(String value) {
        if (value == null) return null;
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private ApiException validation(String field, String reason) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "입력값을 확인해 주세요.",
                "요청을 처리할 수 없습니다.", List.of(new FieldIssue(field, reason)));
    }

    private int count(String sql, Object... args) {
        Integer value = jdbc.queryForObject(sql, Integer.class, args);
        return value == null ? 0 : value;
    }

    private QuestRow questRow(ResultSet rs, int row) throws SQLException {
        return new QuestRow(rs.getObject("id", UUID.class), rs.getString("status"), rs.getString("title"),
                rs.getLong("version"), timestamp(rs, "created_at"), timestamp(rs, "completed_at"),
                timestamp(rs, "archived_at"));
    }

    private ActionRow actionRow(ResultSet rs, int row) throws SQLException {
        return actionRow(rs, "");
    }

    private ActionRow actionRow(ResultSet rs, String prefix) throws SQLException {
        return new ActionRow(rs.getObject(prefix + "id", UUID.class), rs.getObject(prefix + "quest_id", UUID.class),
                rs.getString(prefix + "status"), rs.getString(prefix + "title"),
                rs.getInt(prefix + "estimated_minutes"), rs.getObject(prefix + "source_attempt_id", UUID.class),
                timestamp(rs, prefix + "created_at"), timestamp(rs, prefix + "ended_at"));
    }

    private AttemptRow attemptRow(ResultSet rs, int row) throws SQLException {
        return attemptRow(rs, "");
    }

    private AttemptRow attemptRow(ResultSet rs, String prefix) throws SQLException {
        Integer minutes = (Integer) rs.getObject(prefix + "suggested_minutes");
        return new AttemptRow(rs.getObject(prefix + "id", UUID.class),
                rs.getObject(prefix + "action_id", UUID.class), rs.getString(prefix + "outcome"),
                rs.getString(prefix + "blocker_code"), rs.getString(prefix + "note"),
                rs.getString(prefix + "strategy_code"), rs.getString(prefix + "guidance"),
                rs.getString(prefix + "suggested_title"), minutes, timestamp(rs, prefix + "created_at"));
    }

    private static OffsetDateTime timestamp(ResultSet rs, String column) throws SQLException {
        return rs.getObject(column, OffsetDateTime.class);
    }

    private Map<String, Object> questMap(QuestRow quest) {
        Map<String, Object> map = response("id", quest.id, "status", quest.status, "title", quest.title,
                "version", quest.version, "createdAt", iso(quest.createdAt));
        if (quest.completedAt != null) map.put("completedAt", iso(quest.completedAt));
        if (quest.archivedAt != null) map.put("archivedAt", iso(quest.archivedAt));
        return map;
    }

    private Map<String, Object> actionMap(ActionRow action) {
        Map<String, Object> map = response("id", action.id, "questId", action.questId, "status", action.status,
                "title", action.title, "estimatedMinutes", action.estimatedMinutes,
                "createdAt", iso(action.createdAt));
        if (action.sourceAttemptId != null) map.put("sourceAttemptId", action.sourceAttemptId);
        if (action.endedAt != null) map.put("endedAt", iso(action.endedAt));
        return map;
    }

    private Map<String, Object> attemptMap(AttemptRow attempt) {
        Map<String, Object> map = response("id", attempt.id, "actionId", attempt.actionId,
                "outcome", attempt.outcome, "createdAt", iso(attempt.createdAt));
        if (attempt.blockerCode != null) map.put("blockerCode", attempt.blockerCode);
        if (attempt.note != null) map.put("note", attempt.note);
        return map;
    }

    private Map<String, Object> pendingMap(PendingAdaptation pending) {
        return response("attempt", attemptMap(pending.attempt), "suggestion", response(
                "strategyCode", pending.attempt.strategyCode, "guidance", pending.attempt.guidance,
                "title", pending.attempt.suggestedTitle, "estimatedMinutes", pending.attempt.suggestedMinutes));
    }

    private Map<String, Object> suggestionMap(SuggestionPolicy.Suggestion suggestion) {
        return response("strategyCode", suggestion.strategyCode(), "guidance", suggestion.guidance(),
                "title", suggestion.title(), "estimatedMinutes", suggestion.estimatedMinutes());
    }

    private static String iso(OffsetDateTime value) {
        return value.toInstant().toString();
    }

    private static Map<String, Object> response(Object... pairs) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int index = 0; index < pairs.length; index += 2) map.put((String) pairs[index], pairs[index + 1]);
        return map;
    }

    private record QuestRow(UUID id, String status, String title, long version, OffsetDateTime createdAt,
            OffsetDateTime completedAt, OffsetDateTime archivedAt) {}
    private record ActionRow(UUID id, UUID questId, String status, String title, int estimatedMinutes,
            UUID sourceAttemptId, OffsetDateTime createdAt, OffsetDateTime endedAt) {}
    private record AttemptRow(UUID id, UUID actionId, String outcome, String blockerCode, String note,
            String strategyCode, String guidance, String suggestedTitle, Integer suggestedMinutes,
            OffsetDateTime createdAt) {}
    private record AttemptWithQuest(UUID id, UUID questId, String outcome) {}
    private record PendingAdaptation(AttemptRow attempt) {}
    private record Cursor(UUID id, OffsetDateTime createdAt) {}
}
