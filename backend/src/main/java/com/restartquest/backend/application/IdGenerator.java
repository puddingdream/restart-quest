package com.restartquest.backend.application;

@FunctionalInterface
public interface IdGenerator {
    String nextId(String prefix);
}
