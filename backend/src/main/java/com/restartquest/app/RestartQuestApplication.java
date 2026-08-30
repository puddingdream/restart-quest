package com.restartquest.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication(scanBasePackages = "com.restartquest")
public class RestartQuestApplication {

    public static void main(String[] args) {
        SpringApplication.run(RestartQuestApplication.class, args);
    }
}
