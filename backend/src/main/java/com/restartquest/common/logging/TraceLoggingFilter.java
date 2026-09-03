package com.restartquest.common.logging;

import com.restartquest.common.error.ErrorCodeContext;
import com.restartquest.common.error.TraceId;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(TraceLoggingFilter.class);

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String previousTraceId = MDC.get(TraceId.MDC_KEY);
        String traceId = UUID.randomUUID().toString();
        long startedAt = System.nanoTime();
        MDC.put(TraceId.MDC_KEY, traceId);
        response.setHeader(TraceId.RESPONSE_HEADER, traceId);

        try {
            filterChain.doFilter(request, response);
        } finally {
            Object errorCode = request.getAttribute(ErrorCodeContext.REQUEST_ATTRIBUTE);
            String resultCode = errorCode == null ? "SUCCESS" : errorCode.toString();
            long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
            log.info(
                    "request_completed traceId={} resultCode={} status={} durationMs={}",
                    traceId,
                    resultCode,
                    response.getStatus(),
                    durationMs);
            if (previousTraceId == null) {
                MDC.remove(TraceId.MDC_KEY);
            } else {
                MDC.put(TraceId.MDC_KEY, previousTraceId);
            }
        }
    }
}
