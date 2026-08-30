CREATE TABLE participant_session (
    id UUID PRIMARY KEY,
    token_digest CHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT ck_participant_session_token_digest
        CHECK (token_digest ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_participant_session_expiry
        CHECK (expires_at > created_at)
);

CREATE INDEX ix_participant_session_expires_at
    ON participant_session (expires_at);

CREATE TABLE journey (
    id UUID PRIMARY KEY,
    participant_session_id UUID NOT NULL
        REFERENCES participant_session (id) ON DELETE CASCADE,
    goal_type VARCHAR(32) NOT NULL,
    energy_level VARCHAR(16) NOT NULL,
    available_minutes SMALLINT NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_journey_participant_session UNIQUE (participant_session_id),
    CONSTRAINT ck_journey_goal_type
        CHECK (goal_type IN ('JOB_SEARCH', 'RESUME', 'NETWORKING')),
    CONSTRAINT ck_journey_energy_level
        CHECK (energy_level IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT ck_journey_available_minutes
        CHECK (available_minutes IN (5, 15, 30)),
    CONSTRAINT ck_journey_version CHECK (version >= 0)
);

CREATE TABLE quest_attempt (
    id UUID PRIMARY KEY,
    journey_id UUID NOT NULL REFERENCES journey (id) ON DELETE CASCADE,
    parent_attempt_id UUID REFERENCES quest_attempt (id),
    catalog_key VARCHAR(128) NOT NULL,
    title VARCHAR(160) NOT NULL,
    instruction VARCHAR(500) NOT NULL,
    estimated_minutes SMALLINT NOT NULL,
    difficulty_level SMALLINT NOT NULL,
    status VARCHAR(16) NOT NULL,
    friction_reason VARCHAR(32),
    created_at TIMESTAMPTZ NOT NULL,
    transitioned_at TIMESTAMPTZ,
    CONSTRAINT ck_quest_attempt_estimated_minutes CHECK (estimated_minutes > 0),
    CONSTRAINT ck_quest_attempt_difficulty CHECK (difficulty_level BETWEEN 1 AND 3),
    CONSTRAINT ck_quest_attempt_status
        CHECK (status IN ('ACTIVE', 'COMPLETED', 'REFRAMED')),
    CONSTRAINT ck_quest_attempt_friction_reason
        CHECK (friction_reason IS NULL OR friction_reason IN
            ('TOO_BIG', 'UNCLEAR', 'LOW_ENERGY', 'MISSING_MATERIAL', 'OTHER')),
    CONSTRAINT ck_quest_attempt_transition
        CHECK ((status = 'ACTIVE' AND transitioned_at IS NULL)
            OR (status <> 'ACTIVE' AND transitioned_at IS NOT NULL))
);

CREATE UNIQUE INDEX uq_quest_attempt_one_active_per_journey
    ON quest_attempt (journey_id)
    WHERE status = 'ACTIVE';

CREATE INDEX ix_quest_attempt_journey_created
    ON quest_attempt (journey_id, created_at DESC);

CREATE TABLE command_receipt (
    id UUID PRIMARY KEY,
    participant_session_id UUID NOT NULL
        REFERENCES participant_session (id) ON DELETE CASCADE,
    command_id UUID NOT NULL,
    request_fingerprint CHAR(64) NOT NULL,
    response_status SMALLINT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_command_receipt_session_command
        UNIQUE (participant_session_id, command_id),
    CONSTRAINT ck_command_receipt_fingerprint
        CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_command_receipt_response_status
        CHECK (response_status BETWEEN 200 AND 599)
);

CREATE INDEX ix_command_receipt_created_at
    ON command_receipt (created_at);
