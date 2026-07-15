import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const serviceUrl = pathToFileURL(
  path.join(root, "dist/assets/features/quests/services/mockQuestService.js"),
).href;
const dashboardUrl = pathToFileURL(
  path.join(root, "dist/assets/features/dashboard/services/dashboardSummary.js"),
).href;

const { generateDailyQuests, redesignQuest } = await import(serviceUrl);
const { createDashboardSummary } = await import(dashboardUrl);

const profile = {
  region: "서울",
  desiredRole: "백엔드 개발자",
  desiredWorkType: "원격 또는 하이브리드",
  careerGapMonths: 8,
  hasResume: true,
  hasInterviewExperience: false,
  interests: "Java, Spring",
  energyLevel: "LOW",
};

const quests = generateDailyQuests(profile);
assert.equal(quests.length, 3);
assert.ok(
  quests.some(
    (quest) =>
      quest.title.includes(profile.desiredRole) ||
      quest.description.includes(profile.desiredRole),
  ),
);
assert.ok(quests.every((quest) => quest.status === "TODO"));
assert.ok(quests.every((quest) => quest.estimatedMinutes >= 10));

const redesigned = redesignQuest(quests[1], "NOT_SURE_WHAT_TO_WRITE", "");
assert.ok(redesigned.length >= 1);
assert.ok(redesigned.every((quest) => quest.origin === "REDESIGNED"));
assert.ok(
  redesigned.every((quest) => quest.estimatedMinutes < quests[1].estimatedMinutes),
);

quests[0].status = "DONE";
quests[1].status = "REDESIGNED";
const summary = createDashboardSummary([...quests, ...redesigned], [
  {
    id: "record-1",
    sourceQuestId: quests[1].id,
    sourceTitle: quests[1].title,
    reason: "NOT_SURE_WHAT_TO_WRITE",
    redesignedQuestIds: redesigned.map((quest) => quest.id),
    createdAtLabel: "오늘",
  },
]);

assert.equal(summary.generatedTotal, 3);
assert.equal(summary.doneCount, 1);
assert.equal(summary.redesignedCount, 1);
assert.ok(summary.nextAction);

const rootElement = installDomHarness();
const appEntryUrl = pathToFileURL(path.join(root, "dist/assets/main.js")).href;
await import(appEntryUrl);

assert.equal(rootElement.childNodes.length, 1);
assert.match(rootElement.textContent, /Re:Start Quest/);
assert.match(rootElement.textContent, /오늘 다시 움직일 만큼만 작게 나눕니다/);

console.log(
  "Smoke passed: quest generation, redesign, dashboard summary, and built app entry are coherent.",
);

function installDomHarness() {
  class TestNode {
    childNodes = [];
    parentNode = null;
    #textContent;

    append(...children) {
      if (this.#textContent !== undefined) {
        this.childNodes.push(new TestTextNode(this.#textContent));
        this.#textContent = undefined;
      }

      for (const child of children) {
        const node = child instanceof TestNode ? child : new TestTextNode(String(child));
        node.parentNode = this;
        this.childNodes.push(node);
      }
    }

    replaceChildren(...children) {
      this.childNodes = [];
      this.#textContent = undefined;
      this.append(...children);
    }

    get textContent() {
      if (this.#textContent !== undefined) {
        return this.#textContent;
      }
      return this.childNodes.map((child) => child.textContent).join("");
    }

    set textContent(value) {
      this.childNodes = [];
      this.#textContent = String(value);
    }
  }

  class TestTextNode extends TestNode {
    constructor(text) {
      super();
      this.textContent = text;
    }
  }

  class TestElement extends TestNode {
    attributes = new Map();
    className = "";

    constructor(tagName) {
      super();
      this.tagName = tagName.toUpperCase();
    }

    setAttribute(name, value) {
      this.attributes.set(name, String(value));
      this[name] = String(value);
    }

    addEventListener() {}
  }

  class TestDocument {
    #root;

    constructor(root) {
      this.#root = root;
    }

    createElement(tagName) {
      return new TestElement(tagName);
    }

    createTextNode(text) {
      return new TestTextNode(text);
    }

    querySelector(selector) {
      return selector === "#app" ? this.#root : null;
    }
  }

  const rootNode = new TestElement("div");
  rootNode.setAttribute("id", "app");
  globalThis.Node = TestNode;
  globalThis.document = new TestDocument(rootNode);

  return rootNode;
}
