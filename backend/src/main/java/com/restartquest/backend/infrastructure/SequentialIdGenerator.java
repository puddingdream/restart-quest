package com.restartquest.backend.infrastructure;

import com.restartquest.backend.application.IdGenerator;
import java.util.concurrent.atomic.AtomicInteger;

public final class SequentialIdGenerator implements IdGenerator {
    private final AtomicInteger next = new AtomicInteger(1);

    @Override
    public String nextId(String prefix) {
        return prefix + "-" + next.getAndIncrement();
    }
}
