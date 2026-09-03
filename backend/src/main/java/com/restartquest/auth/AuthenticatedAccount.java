package com.restartquest.auth;

import java.io.Serial;
import java.io.Serializable;
import java.util.UUID;

public record AuthenticatedAccount(UUID id, String email) implements Serializable {

    @Serial
    private static final long serialVersionUID = 1L;

    static AuthenticatedAccount from(Account account) {
        return new AuthenticatedAccount(account.getId(), account.getEmail());
    }
}
