// src/api/verification/verificationRoutes.js
const express = require('express');
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const { authenticate, authorize } = require('../../utils/authMiddleware');
const { verifyImage } = require('../../services/geminiService');
const { getSocketIO } = require('../../socket'); // For emitting real-time updates

const router = express.Router();

/**
 * @route POST /api/disasters/:disasterId/reports/:reportId/verify-image
 * @desc Analyze a user-uploaded image for authenticity using Gemini API.
 * Updates the report's verification_status.
 * @access Private (admin, contributor)
 * @param {string} disasterId - The ID of the disaster.
 * @param {string} reportId - The ID of the report containing the image.
 * @body {string} imageUrl - The URL of the image to verify.
 * @returns {object} Updated report record with verification status.
 */
router.post('/:disasterId/reports/:reportId/verify-image', authenticate, authorize(['admin', 'contributor']), async (req, res) => {
    const { disasterId, reportId } = req.params;
    const { imageUrl } = req.body;
    const userId = req.user.id;

    if (!imageUrl) {
        logger.warn('Validation error: Missing imageUrl for image verification.', { body: req.body, user: userId, disasterId: disasterId, reportId: reportId });
        return res.status(400).json({ message: 'Image URL is required for verification.' });
    }

    try {
        // Step 1: Call mock Gemini API for image verification
        const verificationResult = await verifyImage(imageUrl);
        logger.info(`Image verification result for report ${reportId}: ${JSON.stringify(verificationResult)}`);

        // Step 2: Update the report's verification status in Supabase
        const { data, error } = await supabase
            .from('reports')
            .update({ verification_status: verificationResult.status })
            .eq('id', reportId)
            .eq('disaster_id', disasterId)
            .select();

        if (error) {
            logger.error(`Error updating report ${reportId} verification status:`, error);
            return res.status(500).json({ message: 'Error updating report verification status.', error: error.message });
        }

        const updatedReport = data[0];
        if (!updatedReport) {
            logger.warn(`Image verification failed: Report ${reportId} not found for update.`);
            return res.status(404).json({ message: 'Report not found for image verification update.' });
        }

        logger.info('Report verification status updated successfully.', {
            reportId: reportId,
            status: updatedReport.verification_status,
            geminiMessage: verificationResult.message
        });

        // Emit real-time update
        const io = getSocketIO();
        io.emit('report_updated', { type: 'verification_status_updated', report: updatedReport });

        res.status(200).json({ ...updatedReport, gemini_message: verificationResult.message });

    } catch (err) {
        logger.error(`Unexpected error in POST /api/disasters/:disasterId/reports/:reportId/verify-image:`, err);
        res.status(500).json({ message: 'Internal server error during image verification.' });
    }
});

module.exports = router;
