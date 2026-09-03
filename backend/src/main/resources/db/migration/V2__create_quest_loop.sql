CREATE TABLE daily_check_ins (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    local_date DATE NOT NULL,
    energy_level VARCHAR(16) NOT NULL,
    available_minutes INTEGER NOT NULL,
    focus_area VARCHAR(16) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT fk_daily_check_ins_account FOREIGN KEY (account_id) REFERENCES accounts (id),
    CONSTRAINT uq_daily_check_ins_account_date UNIQUE (account_id, local_date),
    CONSTRAINT uq_daily_check_ins_id_account UNIQUE (id, account_id),
    CONSTRAINT ck_daily_check_ins_energy CHECK (energy_level IN ('LOW', 'MEDIUM', 'HIGH')),
    CONSTRAINT ck_daily_check_ins_minutes CHECK (available_minutes IN (5, 15, 30)),
    CONSTRAINT ck_daily_check_ins_focus CHECK (focus_area IN ('EXPLORE', 'RESUME', 'APPLY', 'INTERVIEW'))
);

CREATE TABLE quests (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    check_in_id UUID NOT NULL,
    template_key VARCHAR(64) NOT NULL,
    title VARCHAR(160) NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    difficulty INTEGER NOT NULL,
    recommendation_reason VARCHAR(255) NOT NULL,
    status VARCHAR(16) NOT NULL,
    predecessor_quest_id UUID,
    version BIGINT NOT NULL,
    active_marker SMALLINT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_quests_id_account UNIQUE (id, account_id),
    CONSTRAINT uq_quests_account_active UNIQUE (account_id, active_marker),
    CONSTRAINT uq_quests_predecessor UNIQUE (predecessor_quest_id),
    CONSTRAINT fk_quests_check_in_owner FOREIGN KEY (check_in_id, account_id)
        REFERENCES daily_check_ins (id, account_id),
    CONSTRAINT fk_quests_predecessor_owner FOREIGN KEY (predecessor_quest_id, account_id)
        REFERENCES quests (id, account_id),
    CONSTRAINT ck_quests_minutes CHECK (estimated_minutes BETWEEN 1 AND 30),
    CONSTRAINT ck_quests_difficulty CHECK (difficulty BETWEEN 0 AND 3),
    CONSTRAINT ck_quests_status CHECK (status IN ('ACTIVE', 'COMPLETED', 'REPLACED')),
    CONSTRAINT ck_quests_version CHECK (version >= 0),
    CONSTRAINT ck_quests_active_marker CHECK (
        (status = 'ACTIVE' AND active_marker = 1)
        OR (status <> 'ACTIVE' AND active_marker IS NULL)
    )
);

CREATE TABLE quest_outcomes (
    id UUID PRIMARY KEY,
    quest_id UUID NOT NULL,
    type VARCHAR(16) NOT NULL,
    barrier VARCHAR(32),
    note VARCHAR(300),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_quest_outcomes_quest UNIQUE (quest_id),
    CONSTRAINT fk_quest_outcomes_quest FOREIGN KEY (quest_id) REFERENCES quests (id),
    CONSTRAINT ck_quest_outcomes_type CHECK (type IN ('COMPLETED', 'BLOCKED')),
    CONSTRAINT ck_quest_outcomes_barrier CHECK (
        barrier IS NULL
        OR barrier IN ('TOO_LARGE', 'NO_TIME', 'LOW_ENERGY', 'UNCLEAR', 'EMOTIONAL_LOAD', 'OTHER')
    ),
    CONSTRAINT ck_quest_outcomes_payload CHECK (
        (type = 'COMPLETED' AND barrier IS NULL AND note IS NULL)
        OR (type = 'BLOCKED' AND barrier IS NOT NULL)
    ),
    CONSTRAINT ck_quest_outcomes_note_length CHECK (note IS NULL OR char_length(note) <= 300)
);
