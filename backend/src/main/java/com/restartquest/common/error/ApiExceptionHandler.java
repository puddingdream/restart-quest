package com.restartquest.common.error;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final String SAFE_VALIDATION_MESSAGE = "입력값을 확인해 주세요.";

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApiException(ApiException exception, HttpServletRequest request) {
        return response(
                request,
                exception.status(),
                exception.code(),
                exception.getMessage(),
                exception.fieldErrors());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(
            MethodArgumentNotValidException exception,
            HttpServletRequest request) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (FieldError fieldError : exception.getBindingResult().getFieldErrors()) {
            fieldErrors.putIfAbsent(fieldError.getField(), SAFE_VALIDATION_MESSAGE);
        }
        return response(
                request,
                HttpStatus.BAD_REQUEST,
                "VALIDATION_ERROR",
                SAFE_VALIDATION_MESSAGE,
                fieldErrors);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleUnreadableBody(
            HttpMessageNotReadableException exception,
            HttpServletRequest request) {
        return response(
                request,
                HttpStatus.BAD_REQUEST,
                "VALIDATION_ERROR",
                SAFE_VALIDATION_MESSAGE,
                Map.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> handleUnexpected(Exception exception, HttpServletRequest request) {
        return response(
                request,
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
                Map.of());
    }

    private ResponseEntity<ApiError> response(
            HttpServletRequest request,
            HttpStatus status,
            String code,
            String message,
            Map<String, String> fieldErrors) {
        ErrorCodeContext.set(request, code);
        return ResponseEntity.status(status)
                .body(new ApiError(code, message, fieldErrors, TraceId.currentOrCreate()));
    }
}
