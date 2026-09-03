package com.restartquest.common.error;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class SecurityErrorResponseWriter {

    private final ObjectMapper objectMapper;

    public SecurityErrorResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void writeUnauthorized(
            HttpServletRequest request,
            HttpServletResponse response,
            Exception exception) throws IOException {
        write(
                request,
                response,
                HttpStatus.UNAUTHORIZED,
                "AUTH_REQUIRED",
                "로그인이 필요합니다.");
    }

    public void writeAccessDenied(
            HttpServletRequest request,
            HttpServletResponse response,
            Exception exception) throws IOException {
        write(
                request,
                response,
                HttpStatus.FORBIDDEN,
                "ACCESS_DENIED",
                "요청을 처리할 권한이 없습니다.");
    }

    private void write(
            HttpServletRequest request,
            HttpServletResponse response,
            HttpStatus status,
            String code,
            String message) throws IOException {
        ErrorCodeContext.set(request, code);
        response.setStatus(status.value());
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(
                response.getWriter(),
                new ApiError(code, message, Map.of(), TraceId.currentOrCreate()));
    }
}
