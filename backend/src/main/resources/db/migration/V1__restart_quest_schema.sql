CREATE TABLE workspaces (
    id UUID PRIMARY KEY,
    timezone VARCHAR(64) NOT NULL,
    session_hash CHAR(64) NOT NULL UNIQUE,
    csrf_token VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE quests (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('ACTIVE', 'COMPLETED', 'ARCHIVED')),
    title VARCHAR(120) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 120 AND title = btrim(title)),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    UNIQUE (workspace_id, id),
    CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL)),
    CHECK ((status = 'ARCHIVED') = (archived_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_workspace_active_quest
    ON quests(workspace_id) WHERE status = 'ACTIVE';

CREATE TABLE actions (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    quest_id UUID NOT NULL,
    status VARCHAR(16) NOT NULL CHECK (status IN ('READY', 'DONE', 'BLOCKED', 'CANCELLED')),
    title VARCHAR(100) NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 100 AND title = btrim(title)),
    estimated_minutes INTEGER NOT NULL CHECK (estimated_minutes BETWEEN 2 AND 30),
    source_attempt_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    UNIQUE (workspace_id, quest_id, id),
    UNIQUE (source_attempt_id),
    FOREIGN KEY (workspace_id, quest_id) REFERENCES quests(workspace_id, id) ON DELETE CASCADE,
    CHECK ((status = 'READY') = (ended_at IS NULL))
);

CREATE UNIQUE INDEX uq_quest_ready_action
    ON actions(quest_id) WHERE status = 'READY';

CREATE TABLE attempts (
    id UUID PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    quest_id UUID NOT NULL,
    action_id UUID NOT NULL UNIQUE,
    outcome VARCHAR(16) NOT NULL CHECK (outcome IN ('DONE', 'BLOCKED')),
    blocker_code VARCHAR(24),
    note VARCHAR(500) CHECK (note IS NULL OR char_length(note) <= 500),
    strategy_code VARCHAR(32),
    guidance VARCHAR(200),
    suggested_title VARCHAR(100),
    suggested_minutes INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, quest_id, id),
    FOREIGN KEY (workspace_id, quest_id, action_id)
        REFERENCES actions(workspace_id, quest_id, id) ON DELETE CASCADE,
    CHECK (
        (outcome = 'DONE' AND blocker_code IS NULL AND strategy_code IS NULL
            AND guidance IS NULL AND suggested_title IS NULL AND suggested_minutes IS NULL)
        OR
        (outcome = 'BLOCKED' AND blocker_code IN ('TOO_BIG', 'LOW_ENERGY', 'UNCLEAR', 'NO_TIME', 'OTHER')
            AND strategy_code IS NOT NULL AND guidance IS NOT NULL
            AND suggested_title IS NOT NULL AND suggested_minutes BETWEEN 2 AND 30)
    )
);

ALTER TABLE actions ADD CONSTRAINT fk_action_source_attempt
    FOREIGN KEY (workspace_id, quest_id, source_attempt_id)
    REFERENCES attempts(workspace_id, quest_id, id);

CREATE TABLE idempotency_records (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    route VARCHAR(200) NOT NULL,
    idempotency_key UUID NOT NULL,
    request_digest CHAR(64) NOT NULL,
    response_status INTEGER NOT NULL CHECK (response_status BETWEEN 200 AND 299),
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
    PRIMARY KEY (workspace_id, route, idempotency_key)
);

CREATE INDEX ix_attempt_history ON attempts(workspace_id, created_at DESC, id DESC);
