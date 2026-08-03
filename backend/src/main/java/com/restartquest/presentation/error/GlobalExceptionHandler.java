package com.restartquest.presentation.error;

import com.restartquest.application.error.AppException;
import java.util.Comparator;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import tools.jackson.databind.exc.InvalidFormatException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(AppException.class)
    public ResponseEntity<ApiErrorResponse> handleAppException(AppException exception) {
        ApiErrorResponse body = new ApiErrorResponse(
                exception.getCode(),
                exception.getMessage(),
                List.of(),
                null
        );
        return ResponseEntity.status(exception.getStatus()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception) {
        List<FieldErrorResponse> fieldErrors = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new FieldErrorResponse(error.getField(), error.getDefaultMessage()))
                .sorted(Comparator.comparing(FieldErrorResponse::field))
                .toList();
        ApiErrorResponse body = new ApiErrorResponse(
                "INVALID_INPUT",
                "입력값을 확인해 주세요.",
                fieldErrors,
                null
        );
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleUnreadableMessage(HttpMessageNotReadableException exception) {
        String field = invalidField(exception);
        ApiErrorResponse body = new ApiErrorResponse(
                "INVALID_INPUT",
                "요청 형식 또는 enum 값을 확인해 주세요.",
                List.of(new FieldErrorResponse(field, "지원하지 않는 값이 포함되어 있습니다.")),
                null
        );
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(body);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException exception) {
        ApiErrorResponse body = new ApiErrorResponse(
                "INVALID_INPUT",
                "입력값을 확인해 주세요.",
                List.of(new FieldErrorResponse(
                        exception.getName(),
                        "지원하지 않는 값이 포함되어 있습니다."
                )),
                null
        );
        return ResponseEntity.badRequest().body(body);
    }

    private static String invalidField(HttpMessageNotReadableException exception) {
        Throwable cause = exception.getMostSpecificCause();
        if (cause instanceof InvalidFormatException invalidFormatException
                && !invalidFormatException.getPath().isEmpty()) {
            int lastIndex = invalidFormatException.getPath().size() - 1;
            String propertyName = invalidFormatException.getPath().get(lastIndex).getPropertyName();
            if (propertyName != null && !propertyName.isBlank()) {
                return propertyName;
            }
        }
        return "request";
    }
}
