package com.restartquest.api;

import org.springframework.http.HttpStatus;

import java.util.List;

public class ApiException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final String title;
    private final String detail;
    private final List<FieldIssue> fieldErrors;

    public ApiException(HttpStatus status, String code, String title, String detail) {
        this(status, code, title, detail, List.of());
    }

    public ApiException(HttpStatus status, String code, String title, String detail, List<FieldIssue> fieldErrors) {
        super(code);
        this.status = status;
        this.code = code;
        this.title = title;
        this.detail = detail;
        this.fieldErrors = List.copyOf(fieldErrors);
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public String title() { return title; }
    public String detail() { return detail; }
    public List<FieldIssue> fieldErrors() { return fieldErrors; }

    public static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, "RESOURCE_NOT_FOUND", "대상을 찾을 수 없습니다.", "요청한 대상을 확인할 수 없습니다.");
    }

    public static ApiException conflict(String code) {
        return new ApiException(HttpStatus.CONFLICT, code, "현재 상태에서 처리할 수 없습니다.", "최신 상태를 다시 확인해 주세요.");
    }

    public static ApiException badRequest(String code) {
        return new ApiException(HttpStatus.BAD_REQUEST, code, "요청을 확인해 주세요.", "요청을 처리할 수 없습니다.");
    }

    public record FieldIssue(String field, String reason) {}
}
