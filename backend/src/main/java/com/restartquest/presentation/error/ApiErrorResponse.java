package com.restartquest.presentation.error;

import java.util.List;

public record ApiErrorResponse(
        String code,
        String message,
        List<FieldErrorResponse> fieldErrors,
        String traceId
) {
}
