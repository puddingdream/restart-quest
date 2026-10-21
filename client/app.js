import { mountQuestApp } from './quest-app.js';

mountQuestApp(document, fetch.bind(globalThis));
