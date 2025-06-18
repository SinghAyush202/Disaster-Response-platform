const express = require('express');
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs if needed for mock data
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const { authenticate, authorize } = require('../../utils/authMiddleware');
const { getSocketIO } = require('../../socket'); // For emitting real-time updates

const router = express.Router();

/**
 * Helper function to add audit trail entry.
 * @param {Array} currentAuditTrail - The existing audit trail array.
 * @param {string} action - The action performed (e.g., 'create', 'update', 'delete').
 * @param {string} userId - The ID of the user performing the action.
 * @returns {Array} - The updated audit trail array.
 */
const addAuditEntry = (currentAuditTrail, action, userId) => {
    const newEntry = {
        action: action,
        user_id: userId,
        timestamp: new Date().toISOString()
    };
    return Array.isArray(currentAuditTrail) ? [...currentAuditTrail, newEntry] : [newEntry];
};

/**
 * @route POST /api/disasters
 * @desc Create a new disaster record.
 * @access Private (admin, contributor)
 * @body {string} title
 * @body {string} location_name
 * @body {string} description
 * @body {string[]} tags
 * @returns {object} New disaster record
 */
router.post('/', authenticate, authorize(['admin', 'contributor']), async (req, res) => {
    const { title, location_name, description, tags } = req.body;
    const owner_id = req.user.id; // Get owner_id from authenticated user

    // Basic validation
    if (!title || !location_name || !description || !Array.isArray(tags) || tags.length === 0) {
        logger.warn('Validation error: Missing or invalid fields for disaster creation.', { body: req.body, user: req.user.id });
        return res.status(400).json({ message: 'Missing required fields: title, location_name, description, tags.' });
    }

    try {
        // Location will be updated later via geocoding API, for now it's null
        const audit_trail = addAuditEntry([], 'create', owner_id);

        const { data, error } = await supabase
            .from('disasters')
            .insert({ title, location_name, description, tags, owner_id, audit_trail })
            .select();

        if (error) {
            logger.error('Error creating disaster:', error);
            return res.status(500).json({ message: 'Error creating disaster.', error: error.message });
        }

        const newDisaster = data[0];
        logger.info('Disaster created successfully.', { disasterId: newDisaster.id, title: newDisaster.title, owner: owner_id });

        // Emit real-time update
        const io = getSocketIO();
        io.emit('disaster_updated', { type: 'created', disaster: newDisaster });

        res.status(201).json(newDisaster);
    } catch (err) {
        logger.error('Unexpected error in POST /api/disasters:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route GET /api/disasters
 * @desc Get all disaster records, with optional tag filtering.
 * @access Public
 * @query {string} tag - Filter disasters by a specific tag.
 * @returns {object[]} Array of disaster records
 */
router.get('/', async (req, res) => {
    const { tag } = req.query;

    try {
        let query = supabase.from('disasters').select('*');

        if (tag) {
            query = query.contains('tags', [tag]); // Use .contains for array column
            logger.info(`Fetching disasters filtered by tag: ${tag}`);
        } else {
            logger.info('Fetching all disaster records.');
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) {
            logger.error('Error fetching disasters:', error);
            return res.status(500).json({ message: 'Error fetching disasters.', error: error.message });
        }

        logger.info(`Fetched ${data.length} disasters.`);
        res.status(200).json(data);
    } catch (err) {
        logger.error('Unexpected error in GET /api/disasters:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route GET /api/disasters/:id
 * @desc Get a single disaster record by ID.
 * @access Public
 * @param {string} id - The UUID of the disaster.
 * @returns {object} Disaster record
 */
router.get('/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const { data, error } = await supabase
            .from('disasters')
            .select('*')
            .eq('id', id)
            .single();

        if (error && error.code === 'PGRST116') { // No rows found
            logger.warn(`Disaster not found with ID: ${id}`);
            return res.status(404).json({ message: 'Disaster not found.' });
        }
        if (error) {
            logger.error(`Error fetching disaster with ID ${id}:`, error);
            return res.status(500).json({ message: 'Error fetching disaster.', error: error.message });
        }

        logger.info(`Fetched disaster with ID: ${id}`);
        res.status(200).json(data);
    } catch (err) {
        logger.error(`Unexpected error in GET /api/disasters/${id}:`, err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});


/**
 * @route PUT /api/disasters/:id
 * @desc Update an existing disaster record.
 * @access Private (admin, owner)
 * @param {string} id - The UUID of the disaster.
 * @body {string} [title]
 * @body {string} [location_name]
 * @body {string} [description]
 * @body {string[]} [tags]
 * @returns {object} Updated disaster record
 */
router.put('/:id', authenticate, authorize(['admin', 'contributor']), async (req, res) => {
    const { id } = req.params;
    const { title, location_name, description, tags } = req.body;
    const updaterId = req.user.id;

    if (Object.keys(req.body).length === 0) {
        return res.status(400).json({ message: 'No fields provided for update.' });
    }

    try {
        // First, fetch the existing disaster to check ownership and current audit trail
        const { data: existingDisaster, error: fetchError } = await supabase
            .from('disasters')
            .select('owner_id, audit_trail')
            .eq('id', id)
            .single();

        if (fetchError && fetchError.code === 'PGRST116') {
            logger.warn(`Update failed: Disaster not found with ID: ${id}`);
            return res.status(404).json({ message: 'Disaster not found.' });
        }
        if (fetchError) {
            logger.error(`Error fetching disaster for update with ID ${id}:`, fetchError);
            return res.status(500).json({ message: 'Error checking disaster for update.', error: fetchError.message });
        }

        // Authorization check: Only admin or the owner can update
        if (req.user.roles.includes('admin') || existingDisaster.owner_id === updaterId) {
            const currentAuditTrail = existingDisaster.audit_trail || [];
            const updatedAuditTrail = addAuditEntry(currentAuditTrail, 'update', updaterId);

            const updatePayload = { audit_trail: updatedAuditTrail };
            if (title) updatePayload.title = title;
            if (location_name) updatePayload.location_name = location_name;
            if (description) updatePayload.description = description;
            if (Array.isArray(tags)) updatePayload.tags = tags;

            const { data, error } = await supabase
                .from('disasters')
                .update(updatePayload)
                .eq('id', id)
                .select();

            if (error) {
                logger.error(`Error updating disaster with ID ${id}:`, error);
                return res.status(500).json({ message: 'Error updating disaster.', error: error.message });
            }

            const updatedDisaster = data[0];
            logger.info('Disaster updated successfully.', { disasterId: id, updater: updaterId });

            // Emit real-time update
            const io = getSocketIO();
            io.emit('disaster_updated', { type: 'updated', disaster: updatedDisaster });

            res.status(200).json(updatedDisaster);
        } else {
            logger.warn(`Authorization denied: User ${updaterId} tried to update disaster ${id} (owner: ${existingDisaster.owner_id}).`);
            return res.status(403).json({ message: 'Forbidden: You do not have permission to update this disaster.' });
        }
    } catch (err) {
        logger.error(`Unexpected error in PUT /api/disasters/${id}:`, err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

/**
 * @route DELETE /api/disasters/:id
 * @desc Delete a disaster record.
 * @access Private (admin, owner)
 * @param {string} id - The UUID of the disaster.
 * @returns {object} Success message
 */
router.delete('/:id', authenticate, authorize(['admin', 'contributor']), async (req, res) => {
    const { id } = req.params;
    const deleterId = req.user.id;

    try {
        // First, fetch the existing disaster to check ownership
        const { data: existingDisaster, error: fetchError } = await supabase
            .from('disasters')
            .select('owner_id')
            .eq('id', id)
            .single();

        if (fetchError && fetchError.code === 'PGRST116') {
            logger.warn(`Deletion failed: Disaster not found with ID: ${id}`);
            return res.status(404).json({ message: 'Disaster not found.' });
        }
        if (fetchError) {
            logger.error(`Error fetching disaster for deletion with ID ${id}:`, fetchError);
            return res.status(500).json({ message: 'Error checking disaster for deletion.', error: fetchError.message });
        }

        // Authorization check: Only admin or the owner can delete
        if (req.user.roles.includes('admin') || existingDisaster.owner_id === deleterId) {
            const { error } = await supabase
                .from('disasters')
                .delete()
                .eq('id', id);

            if (error) {
                logger.error(`Error deleting disaster with ID ${id}:`, error);
                return res.status(500).json({ message: 'Error deleting disaster.', error: error.message });
            }

            logger.info('Disaster deleted successfully.', { disasterId: id, deleter: deleterId });

            // Emit real-time update
            const io = getSocketIO();
            io.emit('disaster_updated', { type: 'deleted', disasterId: id });

            res.status(200).json({ message: 'Disaster deleted successfully.' });
        } else {
            logger.warn(`Authorization denied: User ${deleterId} tried to delete disaster ${id} (owner: ${existingDisaster.owner_id}).`);
            return res.status(403).json({ message: 'Forbidden: You do not have permission to delete this disaster.' });
        }
    } catch (err) {
        logger.error(`Unexpected error in DELETE /api/disasters/${id}:`, err);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;