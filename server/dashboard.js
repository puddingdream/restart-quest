function newestFirst(a, b) {
  return b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);
}

export function projectDashboard(snapshot) {
  if (snapshot.schemaVersion !== 1 || !Array.isArray(snapshot.quests)) {
    throw new Error('Invalid dashboard snapshot');
  }

  const counts = { pending: 0, completed: 0, failed: 0, redesigned: 0 };
  const byId = new Map();
  const children = new Map();
  const roots = [];
  for (const quest of snapshot.quests) {
    if (!quest || byId.has(quest.id) ||
        !['pending', 'completed', 'failed'].includes(quest.status)) {
      throw new Error('Invalid dashboard quest');
    }
    byId.set(quest.id, quest);
    counts[quest.status]++;
    if (quest.parentQuestId === null) roots.push(quest);
    else {
      counts.redesigned++;
      if (children.has(quest.parentQuestId)) throw new Error('Duplicate dashboard child');
      children.set(quest.parentQuestId, quest);
    }
  }

  const visited = new Set();
  const histories = roots.sort(newestFirst).map((root) => {
    if (root.rootQuestId !== root.id) throw new Error('Invalid dashboard root');
    const quests = [];
    let current = root;
    while (current) {
      if (visited.has(current.id) || current.rootQuestId !== root.id ||
          (current !== root && !byId.has(current.parentQuestId))) {
        throw new Error('Invalid dashboard chain');
      }
      visited.add(current.id);
      quests.push(current);
      current = children.get(current.id);
    }
    return { rootQuestId: root.id, quests };
  });
  if (visited.size !== snapshot.quests.length) throw new Error('Incomplete dashboard history');

  const leaves = histories.map((history) => history.quests.at(-1));
  const categories = [
    ['resume', (quest) => quest.status === 'pending'],
    ['redesign', (quest) => quest.status === 'failed' && quest.estimatedMinutes > 1],
    ['rest_or_create', (quest) => quest.status === 'failed' && quest.estimatedMinutes === 1],
  ];
  for (const [kind, eligible] of categories) {
    const quest = leaves.filter(eligible).sort(newestFirst)[0];
    if (quest) {
      return { counts, histories, nextAction: {
        kind, questId: quest.id, rootQuestId: quest.rootQuestId,
      } };
    }
  }
  return { counts, histories, nextAction: {
    kind: 'create', questId: null, rootQuestId: null,
  } };
}
