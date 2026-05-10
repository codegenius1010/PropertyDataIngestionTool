const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { triggerWebhook } = require('../services/goHighLevel');

/**
 * GET /api/properties
 * Retrieve all properties from database
 */
router.get('/', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const query = `
      SELECT 
        id, mls_id, address, city, state, zip_code, 
        living_square_feet, year_built, bedrooms, bathrooms, units_count,
        listing_price, property_type,
        agent_name, agent_first_name, agent_last_name, agent_email, agent_phone,
        ghl_sync_status, ghl_sync_date, ghl_error_message, sync_enabled,
        created_at, updated_at
      FROM properties
      ORDER BY created_at DESC
    `;

    const [properties] = await connection.execute(query);
    res.json(properties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/properties/:id
 * Retrieve a single property by ID
 */
router.get('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const query = `SELECT * FROM properties WHERE id = ?`;
    const [properties] = await connection.execute(query, [req.params.id]);

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(properties[0]);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/properties/:id/sync-ghl
 * Push a single property to GoHighLevel via webhook
 */
router.post('/:id/sync-ghl', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Fetch the property
    const [properties] = await connection.execute(
      'SELECT * FROM properties WHERE id = ?',
      [req.params.id]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = properties[0];

    // Check if sync is enabled for this property
    if (property.sync_enabled === false || property.sync_enabled === 0) {
      return res.status(400).json({ 
        error: 'This property is marked "Do Not Sync" and cannot be synced with GHL',
        sync_enabled: false
      });
    }

    // Prepare payload for GoHighLevel webhook
    const payload = {
      id: property.id,
      mls_id: property.mls_id,
      address: property.address,
      city: property.city,
      state: property.state,
      zip_code: property.zip_code,
      county: property.county,
      property_type: property.property_type,
      bedrooms: property.bedrooms,
      bathrooms: property.bathrooms,
      living_square_feet: property.living_square_feet,
      year_built: property.year_built,
      lot_acres: property.lot_acres,
      lot_square_feet: property.lot_square_feet,
      listing_status: property.listing_status,
      listing_price: property.listing_price,
      days_on_market: property.days_on_market,
      agent_name: property.agent_name,
      agent_email: property.agent_email,
      agent_phone: property.agent_phone,
      owner1_first_name: property.owner1_first_name,
      owner1_last_name: property.owner1_last_name,
      market_value: property.market_value,
      estimated_equity: property.estimated_equity,
      last_sale_date: property.last_sale_date,
      last_sale_amount: property.last_sale_amount
    };

    // Send to GoHighLevel webhook
    const result = await triggerWebhook(payload);

    // Update property status in database
    const updateQuery = `
      UPDATE properties
      SET ghl_sync_status = 'synced', ghl_sync_date = NOW()
      WHERE id = ?
    `;
    await connection.execute(updateQuery, [req.params.id]);

    res.json({
      success: true,
      message: 'Property pushed to GoHighLevel successfully',
      webhook_response: result
    });
  } catch (error) {
    console.error('Error syncing property to GHL:', error);

    // Update property status as failed in database
    try {
      const errorMessage = error.message || 'Unknown error';
      const updateQuery = `
        UPDATE properties
        SET ghl_sync_status = 'failed', ghl_error_message = ?
        WHERE id = ?
      `;
      await connection.execute(updateQuery, [errorMessage, req.params.id]);
    } catch (updateError) {
      console.error('Error updating property status:', updateError);
    }

    res.status(500).json({
      error: error.message || 'Failed to sync property to GoHighLevel'
    });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/properties/sync-ghl/batch
 * Push multiple properties to GoHighLevel
 */
router.post('/sync-ghl/batch', async (req, res) => {
  const { propertyIds } = req.body;
  const connection = await pool.getConnection();

  if (!propertyIds || !Array.isArray(propertyIds)) {
    return res.status(400).json({ error: 'propertyIds must be an array' });
  }

  try {
    const results = {
      success: [],
      failed: []
    };

    for (const propertyId of propertyIds) {
      try {
        // Fetch the property
        const [properties] = await connection.execute(
          'SELECT * FROM properties WHERE id = ?',
          [propertyId]
        );

        if (properties.length === 0) {
          results.failed.push({
            id: propertyId,
            error: 'Property not found'
          });
          continue;
        }

        const property = properties[0];

        // Prepare payload
        const payload = {
          id: property.id,
          mls_id: property.mls_id,
          address: property.address,
          city: property.city,
          state: property.state,
          zip_code: property.zip_code,
          property_type: property.property_type,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          listing_price: property.listing_price,
          agent_name: property.agent_name,
          agent_email: property.agent_email
        };

        // Send to webhook
        await triggerWebhook(payload);

        // Update status
        await connection.execute(
          'UPDATE properties SET ghl_sync_status = ?, ghl_sync_date = NOW() WHERE id = ?',
          ['synced', propertyId]
        );

        results.success.push(propertyId);
      } catch (error) {
        results.failed.push({
          id: propertyId,
          error: error.message
        });

        // Update status as failed
        await connection.execute(
          'UPDATE properties SET ghl_sync_status = ?, ghl_error_message = ? WHERE id = ?',
          ['failed', error.message, propertyId]
        );
      }
    }

    res.json({
      success: true,
      results,
      summary: {
        total: propertyIds.length,
        synced: results.success.length,
        failed: results.failed.length
      }
    });
  } catch (error) {
    console.error('Error in batch sync:', error);
    res.status(500).json({ error: 'Batch sync operation failed' });
  } finally {
    connection.release();
  }
});

/**
 * DELETE /api/properties/:id
 * Delete a property from database
 */
router.delete('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Check if property exists
    const [properties] = await connection.execute(
      'SELECT id, address FROM properties WHERE id = ?',
      [req.params.id]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const property = properties[0];

    // Delete the property
    const deleteQuery = `DELETE FROM properties WHERE id = ?`;
    await connection.execute(deleteQuery, [req.params.id]);

    res.json({
      success: true,
      message: `Property "${property.address}" deleted successfully`,
      deletedId: req.params.id
    });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/properties/sync-all
 * Sync all unsynced properties to GoHighLevel
 */
router.post('/sync-all', async (req, res) => {
  const connection = await pool.getConnection();

  try {
    // Fetch all unsynced properties that have sync enabled
    const [properties] = await connection.execute(
      `SELECT * FROM properties WHERE ghl_sync_status != 'synced' AND sync_enabled != 0 ORDER BY created_at DESC`
    );

    if (properties.length === 0) {
      return res.json({
        success: true,
        message: 'No unsynced properties found',
        results: {
          success: [],
          failed: []
        },
        summary: {
          total: 0,
          synced: 0,
          failed: 0
        }
      });
    }

    const results = {
      success: [],
      failed: []
    };

    // Sync each property
    for (const property of properties) {
      // Skip properties with sync disabled
      if (property.sync_enabled === false || property.sync_enabled === 0) {
        continue;
      }

      try {
        // Prepare payload for GoHighLevel webhook
        const payload = {
          id: property.id,
          mls_id: property.mls_id,
          address: property.address,
          city: property.city,
          state: property.state,
          zip_code: property.zip_code,
          county: property.county,
          property_type: property.property_type,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          living_square_feet: property.living_square_feet,
          year_built: property.year_built,
          lot_acres: property.lot_acres,
          lot_square_feet: property.lot_square_feet,
          listing_status: property.listing_status,
          listing_price: property.listing_price,
          days_on_market: property.days_on_market,
          agent_name: property.agent_name,
          agent_email: property.agent_email,
          agent_phone: property.agent_phone,
          owner1_first_name: property.owner1_first_name,
          owner1_last_name: property.owner1_last_name,
          market_value: property.market_value,
          estimated_equity: property.estimated_equity,
          last_sale_date: property.last_sale_date,
          last_sale_amount: property.last_sale_amount
        };

        // Send to webhook
        await triggerWebhook(payload);

        // Update status
        await connection.execute(
          'UPDATE properties SET ghl_sync_status = ?, ghl_sync_date = NOW() WHERE id = ?',
          ['synced', property.id]
        );

        results.success.push(property.id);
      } catch (error) {
        results.failed.push({
          id: property.id,
          address: property.address,
          error: error.message
        });

        // Update status as failed
        await connection.execute(
          'UPDATE properties SET ghl_sync_status = ?, ghl_error_message = ? WHERE id = ?',
          ['failed', error.message, property.id]
        );
      }
    }

    res.json({
      success: true,
      message: `Sync-all operation completed. ${results.success.length} succeeded, ${results.failed.length} failed.`,
      results,
      summary: {
        total: properties.length,
        synced: results.success.length,
        failed: results.failed.length
      }
    });
  } catch (error) {
    console.error('Error in sync-all:', error);
    res.status(500).json({ error: 'Sync-all operation failed' });
  } finally {
    connection.release();
  }
});

/**
 * PATCH /api/properties/:id/sync-enabled
 * Update sync_enabled status for a property
 */
router.patch('/:id/sync-enabled', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { sync_enabled } = req.body;

    if (typeof sync_enabled !== 'boolean') {
      return res.status(400).json({ error: 'sync_enabled must be a boolean value' });
    }

    // Check if property exists
    const [properties] = await connection.execute(
      'SELECT id, address FROM properties WHERE id = ?',
      [req.params.id]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Update sync_enabled status
    await connection.execute(
      'UPDATE properties SET sync_enabled = ? WHERE id = ?',
      [sync_enabled, req.params.id]
    );

    res.json({
      success: true,
      message: `Property sync status updated to ${sync_enabled ? 'enabled' : 'disabled'}`,
      id: req.params.id,
      sync_enabled
    });
  } catch (error) {
    console.error('Error updating sync status:', error);
    res.status(500).json({ error: 'Failed to update sync status' });
  } finally {
    connection.release();
  }
});

/**
 * PATCH /api/properties/:id
 * Update property details
 */
router.patch('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Check if property exists
    const [properties] = await connection.execute(
      'SELECT id FROM properties WHERE id = ?',
      [req.params.id]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // List of updatable fields
    const updatableFields = [
      'mls_id', 'address', 'city', 'state', 'zip_code', 'county',
      'bedrooms', 'bathrooms', 'living_square_feet', 'lot_acres', 'lot_square_feet',
      'year_built', 'property_type', 'stories',
      'listing_price', 'listing_status', 'days_on_market', 'last_updated',
      'market_value', 'estimated_equity',
      'agent_name', 'agent_email', 'agent_phone',
      'owner1_first_name', 'owner1_last_name', 'owner_occupied', 'brokerage_name'
    ];

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    for (const field of updatableFields) {
      if (field in req.body) {
        updateFields.push(`${field} = ?`);
        updateValues.push(req.body[field]);
      }
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateValues.push(req.params.id);

    const updateQuery = `
      UPDATE properties
      SET ${updateFields.join(', ')}, updated_at = NOW()
      WHERE id = ?
    `;

    await connection.execute(updateQuery, updateValues);

    // Fetch and return updated property
    const [updatedProperties] = await connection.execute(
      'SELECT * FROM properties WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Property updated successfully',
      property: updatedProperties[0]
    });
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property', details: error.message });
  } finally {
    connection.release();
  }
});

module.exports = router;
