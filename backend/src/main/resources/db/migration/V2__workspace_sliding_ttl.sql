ALTER TABLE workspaces
    ADD COLUMN last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX ix_workspaces_cleanup
    ON workspaces(last_activity_at, id);
