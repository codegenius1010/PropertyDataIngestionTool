const pool = require('../config/database');

class LoadService {
  /**
   * Create a new load record
   */
  async createLoad(filename, filePath, uploadedBy = 'system') {
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO loads (filename, file_path, status, uploaded_by)
        VALUES (?, ?, 'processing', ?)
      `;

      const [result] = await connection.execute(query, [filename, filePath, uploadedBy]);
      return result.insertId;
    } finally {
      connection.release();
    }
  }

  /**
   * Update load with results
   */
  async updateLoadResults(loadId, successCount, failureCount, status = 'completed', errorMessage = null) {
    const connection = await pool.getConnection();
    try {
      const query = `
        UPDATE loads 
        SET successful_records = ?, 
            failed_records = ?, 
            total_records = ?,
            status = ?, 
            error_message = ?,
            completed_at = NOW()
        WHERE id = ?
      `;

      await connection.execute(query, [
        successCount,
        failureCount,
        successCount + failureCount,
        status,
        errorMessage,
        loadId
      ]);
    } finally {
      connection.release();
    }
  }

  /**
   * Get all loads with pagination
   */
  async getLoads(limit = 50, offset = 0) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT 
          id, filename, total_records, successful_records, failed_records,
          status, created_at, completed_at, uploaded_by
        FROM loads
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const [loads] = await connection.execute(query, [limit, offset]);
      
      // Get total count
      const [countResult] = await connection.execute('SELECT COUNT(*) as total FROM loads');
      
      return {
        data: loads,
        total: countResult[0].total,
        limit,
        offset
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Get load by ID
   */
  async getLoadById(loadId) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT 
          id, filename, file_path, total_records, successful_records, 
          failed_records, status, error_message, created_at, completed_at, uploaded_by
        FROM loads
        WHERE id = ?
      `;

      const [results] = await connection.execute(query, [loadId]);
      return results[0] || null;
    } finally {
      connection.release();
    }
  }

  /**
   * Get properties for a specific load
   */
  async getLoadProperties(loadId, limit = 100, offset = 0) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT *
        FROM properties
        WHERE load_id = ?
        LIMIT ? OFFSET ?
      `;

      const [properties] = await connection.execute(query, [loadId, limit, offset]);
      
      // Get count
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM properties WHERE load_id = ?',
        [loadId]
      );

      return {
        data: properties,
        total: countResult[0].total,
        limit,
        offset
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Get automations log for a load
   */
  async getLoadAutomations(loadId, limit = 100, offset = 0) {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT 
          id, property_id, agent_email, agent_phone, automation_type,
          status, created_at, sent_at
        FROM ghl_automations_log
        WHERE load_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `;

      const [automations] = await connection.execute(query, [loadId, limit, offset]);
      
      // Get count
      const [countResult] = await connection.execute(
        'SELECT COUNT(*) as total FROM ghl_automations_log WHERE load_id = ?',
        [loadId]
      );

      return {
        data: automations,
        total: countResult[0].total,
        limit,
        offset
      };
    } finally {
      connection.release();
    }
  }

  /**
   * Get load statistics
   */
  async getLoadStats() {
    const connection = await pool.getConnection();
    try {
      const query = `
        SELECT 
          COUNT(*) as total_loads,
          SUM(total_records) as total_properties,
          SUM(successful_records) as successful_properties,
          SUM(failed_records) as failed_properties
        FROM loads
      `;

      const [stats] = await connection.execute(query);
      return stats[0];
    } finally {
      connection.release();
    }
  }
}

module.exports = new LoadService();
