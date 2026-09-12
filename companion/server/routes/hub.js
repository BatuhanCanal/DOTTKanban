'use strict';

/** Ana sayfa: birimler (Planka projeleri) ve icindeki etkinlikler (board'lar). */

const planka = require('../planka');
const { requireAuth } = require('../auth');
const { asyncRoute } = require('../http');

module.exports = (app) => {
  app.get(
    '/api/hub',
    requireAuth,
    asyncRoute(async (req, res) => {
      const response = await planka.getProjects(req.plankaToken);
      const included = response.included || {};

      const boardsByProjectId = new Map();

      for (const board of included.boards || []) {
        if (!boardsByProjectId.has(board.projectId)) {
          boardsByProjectId.set(board.projectId, []);
        }

        boardsByProjectId.get(board.projectId).push({
          id: board.id,
          name: board.name,
          position: board.position,
        });
      }

      const projects = (response.items || [])
        .map((project) => ({
          id: project.id,
          name: project.name,
          description: project.description,
          boards: (boardsByProjectId.get(project.id) || []).sort(
            (a, b) => (a.position ?? 0) - (b.position ?? 0),
          ),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

      res.json({ projects });
    }),
  );
};
