const express = require('express');
const logger = require('../../utils/logger');
const { authenticate, authorize } = require('../../utils/authMiddleware');
const { fetchSocialMediaReports } = require('../../services/socialMediaService');
const { getSocketIO } = require('../../socket'); // For emitting real-time updates

const router = express.Router();

/**
 * @route GET /api/disasters/:disasterId/social-media
 * @desc Fetch social media reports for a specific disaster.
 * @access Public
 * @param {string} disasterId - The ID of the disaster.
 * @query {string} [query] - Optional keyword to filter social media posts.
 * @returns {object[]} Array of social media reports.
 */
router.get('/:disasterId/social-media', async (req, res) => {
    const { disasterId } = req.params;
    const { query } = req.query; // Optional query parameter for filtering

    try {
        logger.info(`Fetching social media reports for disaster ${disasterId} with query "${query || 'none'}".`);
        const reports = await fetchSocialMediaReports(disasterId, query);

        // In a real application, you might continuously poll or use webhooks
        // to get new data, then emit 'social_media_updated'.
        // For this mock, we simply return what's fetched.
        // We'll simulate real-time updates from a background process or other events.

        logger.info(`Found ${reports.length} social media reports for disaster ${disasterId}.`);
        res.status(200).json(reports);
    } catch (err) {
        logger.error(`Unexpected error in GET /api/disasters/:disasterId/social-media for ${disasterId}:`, err);
        res.status(500).json({ message: 'Internal server error while fetching social media reports.' });
    }
});

module.exports = router;