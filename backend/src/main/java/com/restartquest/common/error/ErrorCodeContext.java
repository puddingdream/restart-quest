package com.restartquest.common.error;

import jakarta.servlet.http.HttpServletRequest;

public final class ErrorCodeContext {

    public static final String REQUEST_ATTRIBUTE = ErrorCodeContext.class.getName() + ".code";

    private ErrorCodeContext() {
    }

    public static void set(HttpServletRequest request, String code) {
        request.setAttribute(REQUEST_ATTRIBUTE, code);
    }
}
