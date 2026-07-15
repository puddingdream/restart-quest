package com.restartquest.presentation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

final class SimpleJson {
    private final String text;
    private int position;

    private SimpleJson(String text) {
        this.text = text == null ? "" : text;
    }

    static Map<String, Object> parseObject(String text) {
        if (text == null || text.isBlank()) {
            return Map.of();
        }
        SimpleJson parser = new SimpleJson(text);
        Object value = parser.parseValue();
        parser.skipWhitespace();
        if (parser.position != parser.text.length()) {
            throw new IllegalArgumentException("Unexpected JSON content");
        }
        if (!(value instanceof Map<?, ?> map)) {
            throw new IllegalArgumentException("JSON body must be an object");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            result.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return result;
    }

    private Object parseValue() {
        skipWhitespace();
        if (position >= text.length()) {
            throw new IllegalArgumentException("Unexpected end of JSON");
        }
        char current = text.charAt(position);
        return switch (current) {
            case '{' -> parseObjectValue();
            case '[' -> parseArray();
            case '"' -> parseString();
            case 't' -> parseLiteral("true", Boolean.TRUE);
            case 'f' -> parseLiteral("false", Boolean.FALSE);
            case 'n' -> parseLiteral("null", null);
            default -> {
                if (current == '-' || Character.isDigit(current)) {
                    yield parseNumber();
                }
                throw new IllegalArgumentException("Unexpected JSON value");
            }
        };
    }

    private Map<String, Object> parseObjectValue() {
        expect('{');
        Map<String, Object> values = new LinkedHashMap<>();
        skipWhitespace();
        if (tryConsume('}')) {
            return values;
        }
        while (true) {
            String key = parseString();
            skipWhitespace();
            expect(':');
            Object value = parseValue();
            values.put(key, value);
            skipWhitespace();
            if (tryConsume('}')) {
                return values;
            }
            expect(',');
        }
    }

    private List<Object> parseArray() {
        expect('[');
        List<Object> values = new ArrayList<>();
        skipWhitespace();
        if (tryConsume(']')) {
            return values;
        }
        while (true) {
            values.add(parseValue());
            skipWhitespace();
            if (tryConsume(']')) {
                return values;
            }
            expect(',');
        }
    }

    private String parseString() {
        expect('"');
        StringBuilder builder = new StringBuilder();
        while (position < text.length()) {
            char current = text.charAt(position++);
            if (current == '"') {
                return builder.toString();
            }
            if (current == '\\') {
                builder.append(parseEscape());
            } else {
                builder.append(current);
            }
        }
        throw new IllegalArgumentException("Unterminated JSON string");
    }

    private char parseEscape() {
        if (position >= text.length()) {
            throw new IllegalArgumentException("Invalid JSON escape");
        }
        char escaped = text.charAt(position++);
        return switch (escaped) {
            case '"', '\\', '/' -> escaped;
            case 'b' -> '\b';
            case 'f' -> '\f';
            case 'n' -> '\n';
            case 'r' -> '\r';
            case 't' -> '\t';
            case 'u' -> parseUnicodeEscape();
            default -> throw new IllegalArgumentException("Unsupported JSON escape");
        };
    }

    private char parseUnicodeEscape() {
        if (position + 4 > text.length()) {
            throw new IllegalArgumentException("Invalid unicode escape");
        }
        String hex = text.substring(position, position + 4);
        position += 4;
        return (char) Integer.parseInt(hex, 16);
    }

    private Integer parseNumber() {
        int start = position;
        if (text.charAt(position) == '-') {
            position++;
        }
        while (position < text.length() && Character.isDigit(text.charAt(position))) {
            position++;
        }
        return Integer.parseInt(text.substring(start, position));
    }

    private Object parseLiteral(String literal, Object value) {
        if (!text.startsWith(literal, position)) {
            throw new IllegalArgumentException("Invalid JSON literal");
        }
        position += literal.length();
        return value;
    }

    private void skipWhitespace() {
        while (position < text.length() && Character.isWhitespace(text.charAt(position))) {
            position++;
        }
    }

    private void expect(char expected) {
        skipWhitespace();
        if (position >= text.length() || text.charAt(position) != expected) {
            throw new IllegalArgumentException("Expected '" + expected + "'");
        }
        position++;
    }

    private boolean tryConsume(char expected) {
        skipWhitespace();
        if (position < text.length() && text.charAt(position) == expected) {
            position++;
            return true;
        }
        return false;
    }
}
