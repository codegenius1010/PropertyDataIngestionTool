const loadService = require('../services/loadService');

class LoadsController {
  /**
   * Get all loads with pagination
   */
  async getLoads(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;

      const result = await loadService.getLoads(limit, offset);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch loads',
        message: error.message
      });
    }
  }

  /**
   * Get single load by ID
   */
  async getLoadById(req, res) {
    try {
      const { loadId } = req.params;
      const load = await loadService.getLoadById(loadId);

      if (!load) {
        return res.status(404).json({
          error: 'Load not found'
        });
      }

      res.json(load);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch load',
        message: error.message
      });
    }
  }

  /**
   * Get properties for a load
   */
  async getLoadProperties(req, res) {
    try {
      const { loadId } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;

      const result = await loadService.getLoadProperties(loadId, limit, offset);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch properties',
        message: error.message
      });
    }
  }

  /**
   * Get automations log for a load
   */
  async getLoadAutomations(req, res) {
    try {
      const { loadId } = req.params;
      const limit = parseInt(req.query.limit) || 100;
      const offset = parseInt(req.query.offset) || 0;

      const result = await loadService.getLoadAutomations(loadId, limit, offset);
      res.json(result);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch automations',
        message: error.message
      });
    }
  }

  /**
   * Get load statistics
   */
  async getLoadStats(req, res) {
    try {
      const stats = await loadService.getLoadStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to fetch statistics',
        message: error.message
      });
    }
  }
}

module.exports = new LoadsController();
