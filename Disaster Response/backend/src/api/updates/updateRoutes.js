const express = require('express');
const logger = require('../../utils/logger');
const { fetchOfficialUpdates } = require('../../services/webScrapingService');
const { getSocketIO } = require('../../socket'); // For emitting real-time updates

const router = express.Router();

/**
 * @route GET /api/disasters/:disasterId/official-updates
 * @desc Fetch official updates from government/relief websites for a specific disaster.
 * @access Public
 * @param {string} disasterId - The ID of the disaster (used for logging/context, not direct filtering in mock).
 * @query {string} [source] - Optional source to filter updates (e.g., 'fema', 'redcross').
 * @returns {object[]} Array of official updates.
 */
router.get('/:disasterId/official-updates', async (req, res) => {
    const { disasterId } = req.params;
    const { source } = req.query; // Optional source parameter

    try {
        let updates = [];
        if (source) {
            logger.info(`Fetching official updates for disaster ${disasterId} from source: ${source}.`);
            updates = await fetchOfficialUpdates(source);
        } else {
            // If no source specified, fetch from all mock sources or a default
            logger.info(`Fetching official updates for disaster ${disasterId} from all available mock sources.`);
            const femaUpdates = await fetchOfficialUpdates('fema');
            const redCrossUpdates = await fetchOfficialUpdates('redcross');
            updates = [...femaUpdates, ...redCrossUpdates];
        }

        // In a real scenario, these would ideally be filtered by relevance to disasterId
        // For this mock, we just return the general updates from the specified source(s).

        logger.info(`Found ${updates.length} official updates for disaster ${disasterId}.`);
        res.status(200).json(updates);
    } catch (err) {
        logger.error(`Unexpected error in GET /api/disasters/:disasterId/official-updates for ${disasterId}:`, err);
        res.status(500).json({ message: 'Internal server error while fetching official updates.' });
    }
});

module.exports = router;