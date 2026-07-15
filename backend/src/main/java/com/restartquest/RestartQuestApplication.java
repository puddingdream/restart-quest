package com.restartquest;

import com.restartquest.presentation.ApiServer;

public final class RestartQuestApplication {
    private RestartQuestApplication() {
    }

    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        ApiServer server = ApiServer.createWithDefaults(port);
        server.start();
        System.out.println("Re:Start Quest backend API listening on http://localhost:" + server.port());
    }
}
