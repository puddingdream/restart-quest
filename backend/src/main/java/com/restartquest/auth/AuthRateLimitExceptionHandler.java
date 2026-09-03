package com.restartquest.auth;

import com.restartquest.common.error.ApiError;
import com.restartquest.common.error.ErrorCodeContext;
import com.restartquest.common.error.TraceId;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = AuthController.class)
class AuthRateLimitExceptionHandler {

    @ExceptionHandler(RateLimitedException.class)
    ResponseEntity<ApiError> handleRateLimit(
            RateLimitedException exception,
            HttpServletRequest request) {
        ErrorCodeContext.set(request, "RATE_LIMITED");
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, Long.toString(exception.retryAfterSeconds()))
                .body(new ApiError(
                        "RATE_LIMITED",
                        exception.getMessage(),
                        Map.of(),
                        TraceId.currentOrCreate()));
    }
}
