package com.restartquest.quest;

import com.restartquest.quest.QuestModels.ApiError;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(assignableTypes = QuestController.class)
public class QuestApiExceptionHandler {

    @ExceptionHandler(QuestApiException.class)
    ResponseEntity<ApiError> handleQuestApiException(QuestApiException exception) {
        return ResponseEntity.status(exception.status()).body(new ApiError(
                exception.code(),
                exception.getMessage(),
                exception.fieldErrors(),
                exception.snapshot()));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(error ->
                fieldErrors.putIfAbsent(error.getField(), error.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR",
                "요청 값을 확인해 주세요.",
                fieldErrors,
                null));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> handleUnreadableRequest() {
        return ResponseEntity.badRequest().body(new ApiError(
                "VALIDATION_ERROR",
                "요청 값을 확인해 주세요.",
                Map.of("request", "JSON 형식과 허용된 값을 확인해 주세요."),
                null));
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> handleUnsupportedMediaType() {
        return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(new ApiError(
                "UNSUPPORTED_MEDIA_TYPE",
                "Content-Type은 application/json이어야 합니다.",
                null,
                null));
    }
}
