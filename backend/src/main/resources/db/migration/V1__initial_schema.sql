create table app_users (
    id uuid primary key,
    email varchar(255) not null unique,
    password_hash varchar(100) not null,
    name varchar(50) not null,
    onboarding_completed boolean not null,
    created_at timestamp with time zone not null
);

create table onboarding_profiles (
    user_id uuid primary key references app_users(id) on delete cascade,
    desired_job varchar(80) not null,
    region varchar(80),
    desired_work_type varchar(20) not null,
    career_gap_months integer not null,
    has_resume boolean not null,
    interview_experience varchar(20) not null,
    updated_at timestamp with time zone not null
);

create table access_tokens (
    id uuid primary key,
    token_hash varchar(64) not null unique,
    user_id uuid not null references app_users(id) on delete cascade,
    created_at timestamp with time zone not null,
    expires_at timestamp with time zone not null,
    revoked_at timestamp with time zone
);
create unique index idx_access_token_hash on access_tokens(token_hash);

create table daily_quest_plans (
    id uuid primary key,
    user_id uuid not null references app_users(id) on delete cascade,
    quest_date date not null,
    energy_level varchar(10) not null,
    initial_journey_count integer not null check (initial_journey_count = 3),
    created_at timestamp with time zone not null,
    constraint uq_daily_quest_plan_user_date unique (user_id, quest_date)
);

create table quest_journeys (
    id uuid primary key,
    daily_quest_plan_id uuid not null references daily_quest_plans(id) on delete cascade,
    initial_slot integer not null check (initial_slot between 1 and 3),
    root_quest_id uuid not null,
    current_quest_id uuid not null,
    status varchar(15) not null,
    version bigint not null default 0,
    constraint uq_quest_journey_plan_slot unique (daily_quest_plan_id, initial_slot)
);

create table quests (
    id uuid primary key,
    journey_id uuid not null references quest_journeys(id) on delete cascade,
    parent_quest_id uuid,
    revision integer not null,
    title varchar(120) not null,
    description varchar(600) not null,
    completion_criteria varchar(300) not null,
    category varchar(20) not null,
    difficulty varchar(10) not null,
    estimated_minutes integer not null,
    status varchar(15) not null,
    current_marker integer check (current_marker is null or current_marker = 1),
    generated_by_ai boolean not null,
    created_at timestamp with time zone not null,
    completed_at timestamp with time zone,
    version bigint not null default 0,
    constraint uq_quest_journey_revision unique (journey_id, revision),
    constraint uq_quest_journey_current unique (journey_id, current_marker),
    constraint uq_quest_id_journey unique (id, journey_id)
);

create table quest_steps (
    quest_id uuid not null references quests(id) on delete cascade,
    step_order integer not null,
    step varchar(160) not null,
    primary key (quest_id, step_order)
);

create table quest_redesigns (
    id uuid primary key,
    journey_id uuid not null references quest_journeys(id) on delete cascade,
    original_quest_id uuid not null,
    original_journey_id uuid not null,
    replacement_quest_id uuid not null,
    replacement_journey_id uuid not null,
    reason_code varchar(30) not null,
    reason_note varchar(300),
    created_at timestamp with time zone not null,
    constraint uq_quest_redesign_original unique (original_quest_id),
    constraint uq_quest_redesign_replacement unique (replacement_quest_id),
    constraint ck_quest_redesign_same_journey check (
        journey_id = original_journey_id and journey_id = replacement_journey_id
    ),
    constraint fk_redesign_original foreign key (original_quest_id, original_journey_id)
        references quests(id, journey_id),
    constraint fk_redesign_replacement foreign key (replacement_quest_id, replacement_journey_id)
        references quests(id, journey_id)
);
