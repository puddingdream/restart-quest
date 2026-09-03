package com.restartquest.common.error;

import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String code, String safeMessage) {
        this(status, code, safeMessage, Map.of());
    }

    public ApiException(
            HttpStatus status,
            String code,
            String safeMessage,
            Map<String, String> fieldErrors) {
        super(Objects.requireNonNull(safeMessage));
        this.status = Objects.requireNonNull(status);
        this.code = Objects.requireNonNull(code);
        this.fieldErrors = fieldErrors == null ? Map.of() : Map.copyOf(fieldErrors);
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public Map<String, String> fieldErrors() {
        return fieldErrors;
    }
}
