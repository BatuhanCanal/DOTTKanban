'use strict';

/**
 * Planka'nin "GET /api/boards/:id" cevabini isleyen yardimcilar.
 *
 * Planka bu tek cagrida board'un lists / labels / cards / cardLabels /
 * taskLists / tasks verisini birlikte doner. Buradaki iki fonksiyon ayni ham
 * veriyi iki farkli amac icin sekillendirir:
 *   - normalizeBoard : arayuzun (kategori/durum gorunumu) ihtiyaci olan sade yapi
 *   - buildSnapshot  : sablon olarak saklanacak, ID icermeyen yapi
 */

const byPosition = (a, b) => (a.position ?? 0) - (b.position ?? 0);

/** Bir listeyi "kaynak alanina gore" gruplayip Map dondurur. */
function groupBy(items, key) {
  const map = new Map();

  for (const item of items || []) {
    const groupKey = item[key];

    if (!map.has(groupKey)) {
      map.set(groupKey, []);
    }

    map.get(groupKey).push(item);
  }

  return map;
}

/**
 * Board'un gercek (kullanicinin gordugu) listeleri. Planka her board'a
 * "archive" ve "trash" adinda iki sistem listesi ekler; onlari disarida birakiriz.
 */
const activeLists = (included) => (included.lists || []).filter((list) => list.type === 'active').sort(byPosition);

function normalizeBoard(boardResponse) {
  const board = boardResponse.item;
  const included = boardResponse.included || {};

  const lists = activeLists(included);
  const listIds = new Set(lists.map((list) => list.id));
  const listPositionById = new Map(lists.map((list, index) => [list.id, index]));

  const labels = [...(included.labels || [])].sort(byPosition);
  const cardLabelsByCardId = groupBy(included.cardLabels, 'cardId');
  const cardMembershipsByCardId = groupBy(included.cardMemberships, 'cardId');
  const taskListsByCardId = groupBy(included.taskLists, 'cardId');
  const tasksByTaskListId = groupBy(included.tasks, 'taskListId');

  const cards = (included.cards || [])
    .filter((card) => listIds.has(card.listId))
    .sort((a, b) => {
      const listDiff = listPositionById.get(a.listId) - listPositionById.get(b.listId);
      return listDiff !== 0 ? listDiff : byPosition(a, b);
    })
    .map((card) => {
      const tasks = (taskListsByCardId.get(card.id) || []).flatMap(
        (taskList) => tasksByTaskListId.get(taskList.id) || [],
      );

      return {
        id: card.id,
        name: card.name,
        description: card.description,
        dueDate: card.dueDate,
        isDueCompleted: card.isDueCompleted,
        listId: card.listId,
        position: card.position,
        type: card.type,
        labelIds: (cardLabelsByCardId.get(card.id) || []).map((cardLabel) => cardLabel.labelId),
        memberUserIds: (cardMembershipsByCardId.get(card.id) || []).map(
          (membership) => membership.userId,
        ),
        tasksTotal: tasks.length,
        tasksCompleted: tasks.filter((task) => task.isCompleted).length,
      };
    });

  const project = (included.projects || [])[0];

  return {
    board: {
      id: board.id,
      name: board.name,
      projectId: board.projectId,
      projectName: project ? project.name : null,
    },
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      color: list.color,
      position: list.position,
    })),
    labels: labels.map((label) => ({
      id: label.id,
      name: label.name,
      color: label.color,
      position: label.position,
    })),
    users: (included.users || []).map((user) => ({
      id: user.id,
      name: user.name,
      username: user.username,
    })),
    cards,
  };
}

/**
 * Board'un yapisini ID icermeyen bir "sablon" haline cevirir.
 *
 * ID yerine index kullanilir (listIndex, labelIndexes); boylece sablon baska bir
 * projede/board'da yeniden kurulabilir. Bilerek DISARIDA birakilanlar:
 *   - son tarihler (gecmis bir etkinligin tarihi yeni etkinlikte anlamsiz),
 *   - gorev isaretleri (yeni etkinlikte her sey bastan yapilacak),
 *   - uye atamalari, yorumlar, ekler (kisiye/ana ozel veri).
 */
function buildSnapshot(boardResponse) {
  const board = boardResponse.item;
  const included = boardResponse.included || {};

  const lists = activeLists(included);
  const listIndexById = new Map(lists.map((list, index) => [list.id, index]));

  const labels = [...(included.labels || [])].sort(byPosition);
  const labelIndexById = new Map(labels.map((label, index) => [label.id, index]));

  const cardLabelsByCardId = groupBy(included.cardLabels, 'cardId');
  const taskListsByCardId = groupBy(included.taskLists, 'cardId');
  const tasksByTaskListId = groupBy(included.tasks, 'taskListId');

  const cards = (included.cards || [])
    .filter((card) => listIndexById.has(card.listId))
    .sort(byPosition)
    .map((card) => ({
      name: card.name,
      description: card.description || null,
      type: card.type || 'project',
      listIndex: listIndexById.get(card.listId),
      labelIndexes: (cardLabelsByCardId.get(card.id) || [])
        .map((cardLabel) => labelIndexById.get(cardLabel.labelId))
        .filter((index) => index !== undefined),
      taskLists: (taskListsByCardId.get(card.id) || []).sort(byPosition).map((taskList) => ({
        name: taskList.name,
        showOnFrontOfCard: taskList.showOnFrontOfCard,
        tasks: (tasksByTaskListId.get(taskList.id) || [])
          .sort(byPosition)
          .map((task) => ({ name: task.name })),
      })),
    }));

  return {
    version: 1,
    board: { name: board.name },
    lists: lists.map((list) => ({ name: list.name, color: list.color })),
    labels: labels.map((label) => ({ name: label.name, color: label.color })),
    cards,
  };
}

module.exports = { normalizeBoard, buildSnapshot, byPosition };
