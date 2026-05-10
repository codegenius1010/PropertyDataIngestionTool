const axios = require('axios');
const pool = require('../config/database');

class GoHighLevelService {
  constructor() {
    this.apiKey = process.env.GHL_API_KEY;
    this.locationId = process.env.GHL_LOCATION_ID;
    this.baseUrl = 'https://api.gohighlevel.com/v1';
  }

  /**
   * Send automation trigger to GoHighLevel for a property/agent
   */
  async triggerAutomation(property, loadId, automationType = 'email') {
    try {
      const logEntry = {
        property_id: property.id,
        load_id: loadId,
        agent_email: property.agent_email,
        agent_phone: property.agent_phone,
        automation_type: automationType,
        status: 'pending'
      };

      // Log the automation trigger
      await this.logAutomation(logEntry);

      // Trigger based on type
      let response;
      if (automationType === 'email') {
        response = await this.sendEmail(property);
      } else if (automationType === 'sms') {
        response = await this.sendSMS(property);
      } else if (automationType === 'webhook') {
        response = await this.triggerWebhook(property);
      }

      // Update log with response
      await this.updateAutomationLog(logEntry, response, 'sent');
      return response;
    } catch (error) {
      console.error('GoHighLevel automation error:', error);
      await this.updateAutomationLog(logEntry, null, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Send email via GoHighLevel
   */
  async sendEmail(property) {
    try {
      const payload = {
        to: property.agent_email,
        subject: `New Property Lead: ${property.address}`,
        body: this.buildEmailBody(property),
        locationId: this.locationId
      };

      const response = await axios.post(
        `${this.baseUrl}/contacts/bulk-email`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }

  /**
   * Send SMS via GoHighLevel
   */
  async sendSMS(property) {
    try {
      if (!property.agent_phone) {
        throw new Error('Agent phone number not available');
      }

      const payload = {
        to: property.agent_phone,
        body: this.buildSMSBody(property),
        locationId: this.locationId
      };

      const response = await axios.post(
        `${this.baseUrl}/contacts/bulk-sms`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      throw new Error(`Failed to send SMS: ${error.message}`);
    }
  }

  /**
   * Trigger webhook automation
   */
  async triggerWebhook(property) {
    try {
      const payload = {
        property: property,
        eventType: 'new_property_lead',
        timestamp: new Date().toISOString()
      };

      // Get webhook URL from environment
      const webhookUrl = process.env.GHL_WEBHOOK_URL;
      if (!webhookUrl) {
        throw new Error('GHL_WEBHOOK_URL not configured');
      }

      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      return response.data;
    } catch (error) {
      throw new Error(`Failed to trigger webhook: ${error.message}`);
    }
  }

  /**
   * Build email body template
   */
  buildEmailBody(property) {
    return `
      <h2>New Property Lead</h2>
      <p><strong>Address:</strong> ${property.address}, ${property.city}, ${property.state} ${property.zip_code}</p>
      <p><strong>Price:</strong> $${property.property_price?.toLocaleString()}</p>
      <p><strong>Bedrooms:</strong> ${property.bedrooms} | <strong>Bathrooms:</strong> ${property.bathrooms}</p>
      <p><strong>Square Feet:</strong> ${property.square_feet?.toLocaleString()}</p>
      <p><strong>MLS ID:</strong> ${property.mls_id}</p>
      <p><strong>Days on Market:</strong> ${property.days_on_market}</p>
      <p><strong>Status:</strong> ${property.status}</p>
    `;
  }

  /**
   * Build SMS body template
   */
  buildSMSBody(property) {
    return `New Lead: ${property.address}, ${property.city}. $${property.property_price?.toLocaleString()} | ${property.bedrooms}BD/${property.bathrooms}BA | MLS: ${property.mls_id}`;
  }

  /**
   * Log automation to database
   */
  async logAutomation(logEntry) {
    const connection = await pool.getConnection();
    try {
      const query = `
        INSERT INTO ghl_automations_log (
          property_id, load_id, agent_email, agent_phone, 
          automation_type, status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      await connection.execute(query, [
        logEntry.property_id,
        logEntry.load_id,
        logEntry.agent_email,
        logEntry.agent_phone,
        logEntry.automation_type,
        logEntry.status
      ]);
    } finally {
      connection.release();
    }
  }

  /**
   * Update automation log with response
   */
  async updateAutomationLog(logEntry, response, status, errorMessage = null) {
    const connection = await pool.getConnection();
    try {
      const query = `
        UPDATE ghl_automations_log 
        SET status = ?, 
            ghl_response = ?, 
            error_message = ?,
            sent_at = NOW()
        WHERE property_id = ? 
        AND load_id = ? 
        AND automation_type = ?
        ORDER BY id DESC 
        LIMIT 1
      `;

      await connection.execute(query, [
        status,
        response ? JSON.stringify(response) : null,
        errorMessage,
        logEntry.property_id,
        logEntry.load_id,
        logEntry.automation_type
      ]);
    } finally {
      connection.release();
    }
  }
}

module.exports = new GoHighLevelService();
