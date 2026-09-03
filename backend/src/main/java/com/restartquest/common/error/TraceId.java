package com.restartquest.common.error;

import java.util.UUID;
import org.slf4j.MDC;

public final class TraceId {

    public static final String MDC_KEY = "traceId";
    public static final String RESPONSE_HEADER = "X-Trace-Id";

    private TraceId() {
    }

    public static String currentOrCreate() {
        String current = MDC.get(MDC_KEY);
        return current == null || current.isBlank() ? UUID.randomUUID().toString() : current;
    }
}
