const express = require('express');
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const { authenticate, authorize } = require('../../utils/authMiddleware');
const { getSocketIO } = require('../../socket'); // For emitting real-time updates

const router = express.Router();

/**
 * @route POST /api/disasters/:disasterId/reports
 * @desc Submit a new report for a specific disaster.
 * @access Private (citizen, contributor)
 * @param {string} disasterId - The ID of the disaster the report is for.
 * @body {string} content - The content of the report.
 * @body {string} [image_url] - Optional URL to an image related to the report.
 * @returns {object} New report record.
 */
router.post('/:disasterId/reports', authenticate, authorize(['citizen', 'contributor']), async (req, res) => {
    const { disasterId } = req.params;
    const { content, image_url } = req.body;
    const user_id = req.user.id; // User ID from authenticated user

    if (!content) {
        logger.warn('Validation error: Missing report content.', { body: req.body, user: user_id, disasterId: disasterId });
        return res.status(400).json({ message: 'Report content is required.' });
    }

    try {
        const { data, error } = await supabase
            .from('reports')
            .insert({ disaster_id: disasterId, user_id, content, image_url, verification_status: 'pending' })
            .select();

        if (error) {
            logger.error(`Error submitting report for disaster ${disasterId}:`, error);
            return res.status(500).json({ message: 'Error submitting report.', error: error.message });
        }

        const newReport = data[0];
        logger.info('Report submitted successfully.', { reportId: newReport.id, disasterId: disasterId, userId: user_id });

        // Emit real-time update
        const io = getSocketIO();
        io.emit('report_created', { disasterId: disasterId, report: newReport });

        res.status(201).json(newReport);
    } catch (err) {
        logger.error(`Unexpected error in POST /api/disasters/:disasterId/reports for ${disasterId}:`, err);
        res.status(500).json({ message: 'Internal server error while submitting report.' });
    }
});

/**
 * @route GET /api/disasters/:disasterId/reports
 * @desc Get all reports for a specific disaster.
 * @access Public
 * @param {string} disasterId - The ID of the disaster.
 * @returns {object[]} Array of report records.
 */
router.get('/:disasterId/reports', async (req, res) => {
    const { disasterId } = req.params;

    try {
        const { data, error } = await supabase
            .from('reports')
            .select('*')
            .eq('disaster_id', disasterId)
            .order('created_at', { ascending: false });

        if (error) {
            logger.error(`Error fetching reports for disaster ${disasterId}:`, error);
            return res.status(500).json({ message: 'Error fetching reports.', error: error.message });
        }

        logger.info(`Fetched ${data.length} reports for disaster ${disasterId}.`);
        res.status(200).json(data);
    } catch (err) {
        logger.error(`Unexpected error in GET /api/disasters/:disasterId/reports for ${disasterId}:`, err);
        res.status(500).json({ message: 'Internal server error while fetching reports.' });
    }
});

// Add PUT/DELETE for reports if needed, with appropriate authorization
// For example, an admin might update verification_status of a report.

module.exports = router;