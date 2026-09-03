CREATE TABLE accounts (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uq_accounts_email UNIQUE (email),
    CONSTRAINT ck_accounts_email_not_blank CHECK (char_length(email) > 0)
);
