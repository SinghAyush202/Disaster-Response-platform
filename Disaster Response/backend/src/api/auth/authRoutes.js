const express = require('express');
const { authenticate } = require('../../utils/authMiddleware');
const logger = require('../../utils/logger');

const router = express.Router();

/**
 * @route GET /api/auth/me
 * @desc Get details of the currently authenticated user.
 * @access Public (mocked - requires x-user-id header)
 * @returns {object} User object
 */
router.get('/me', authenticate, (req, res) => {
    try {
        // req.user is populated by the authenticate middleware
        logger.info(`User details requested for ${req.user.id}`);
        res.status(200).json({
            message: 'Authenticated successfully (mock)',
            user: req.user
        });
    } catch (error) {
        logger.error('Error in /api/auth/me:', error);
        res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;