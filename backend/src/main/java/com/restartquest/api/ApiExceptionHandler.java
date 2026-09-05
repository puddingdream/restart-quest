package com.restartquest.api;

import com.restartquest.security.WorkspaceSessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private final boolean secureCookie;

    public ApiExceptionHandler(@Value("${app.security.cookie-secure:false}") boolean secureCookie) {
        this.secureCookie = secureCookie;
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<Map<String, Object>> api(ApiException exception, HttpServletRequest request) {
        return problem(exception.status(), exception.code(), exception.title(), exception.detail(),
                exception.fieldErrors(), traceId(request));
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<ApiException.FieldIssue> fields = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> new ApiException.FieldIssue(error.getField(), validationReason(error.getCode())))
                .toList();
        return problem(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "입력값을 확인해 주세요.",
                "요청을 처리할 수 없습니다.", fields, traceId(request));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<Map<String, Object>> malformed(HttpMessageNotReadableException exception, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "MALFORMED_JSON", "요청을 확인해 주세요.",
                "JSON 요청을 처리할 수 없습니다.", List.of(), traceId(request));
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<Map<String, Object>> malformedParameter(
            MethodArgumentTypeMismatchException exception, HttpServletRequest request) {
        return problem(HttpStatus.BAD_REQUEST, "INVALID_PARAMETER", "요청을 확인해 주세요.",
                "경로 또는 조회 조건을 처리할 수 없습니다.", List.of(), traceId(request));
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception exception, HttpServletRequest request) {
        String traceId = traceId(request);
        log.error("Unhandled request failure traceId={} type={}", traceId, exception.getClass().getSimpleName());
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "요청을 완료하지 못했습니다.",
                "잠시 후 다시 시도해 주세요.", List.of(), traceId);
    }

    private ResponseEntity<Map<String, Object>> problem(HttpStatus status, String code, String title,
            String detail, List<ApiException.FieldIssue> fieldErrors, String traceId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", "https://restart-quest.example/problems/" + code.toLowerCase().replace('_', '-'));
        body.put("title", title);
        body.put("status", status.value());
        body.put("code", code);
        body.put("detail", detail);
        if (!fieldErrors.isEmpty()) body.put("fieldErrors", fieldErrors);
        body.put("traceId", traceId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PROBLEM_JSON);
        if ("WORKSPACE_ACCESS_UNAVAILABLE".equals(code)) {
            headers.add(HttpHeaders.SET_COOKIE, ResponseCookie
                    .from(WorkspaceSessionService.COOKIE_NAME, "")
                    .httpOnly(true).secure(secureCookie).sameSite("Lax").path("/api/v1").maxAge(0).build().toString());
        }
        return new ResponseEntity<>(body, headers, status);
    }

    private String traceId(HttpServletRequest request) {
        Object value = request.getAttribute("traceId");
        if (value != null) return value.toString();
        String generated = UUID.randomUUID().toString();
        request.setAttribute("traceId", generated);
        return generated;
    }

    private String validationReason(String code) {
        if ("NotBlank".equals(code) || "NotNull".equals(code)) return "REQUIRED";
        if ("Size".equals(code)) return "INVALID_LENGTH";
        return "OUT_OF_RANGE";
    }
}
