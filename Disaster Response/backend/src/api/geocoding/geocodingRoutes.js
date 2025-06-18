// const express = require('express');
// const supabase = require('../../config/supabase');
// const logger = require('../../utils/logger');
// const { authenticate, authorize } = require('../../utils/authMiddleware');
// const { extractLocationFromDescription } = require('../../services/geminiService');
// const { geocodeLocation } = require('../../services/mappingService');
// const { getSocketIO } = require('../../socket'); // For emitting real-time updates

// const router = express.Router();

// /**
//  * @route POST /api/geocode
//  * @desc Extract location from text description using Gemini and convert to lat/lon using mapping service.
//  * Then updates the disaster record's 'location' field.
//  * @access Private (admin, contributor)
//  * @body {string} disasterId - The ID of the disaster to update.
//  * @body {string} description - The text description to extract location from.
//  * @returns {object} Updated disaster record with location data.
//  */
// router.post('/', authenticate, authorize(['admin', 'contributor']), async (req, res) => {
//     const { disasterId, description } = req.body;
//     const userId = req.user.id;

//     if (!disasterId || !description) {
//         logger.warn('Validation error: Missing disasterId or description for geocoding.', { body: req.body, user: userId });
//         return res.status(400).json({ message: 'Missing required fields: disasterId and description.' });
//     }

//     try {
//         // Step 1: Extract location name using mock Gemini API
//         const extractedLocationName = await extractLocationFromDescription(description);
//         logger.info(`Extracted location "${extractedLocationName}" for disaster ${disasterId} using Gemini.`);

//         if (!extractedLocationName || extractedLocationName === "Unknown Location") {
//             logger.warn(`Could not extract a valid location for disaster ${disasterId} from description.`);
//             return res.status(400).json({ message: 'Could not extract a valid location from the provided description.' });
//         }

//         // Step 2: Convert location name to lat/lon using mock Mapping Service
//         const coords = await geocodeLocation(extractedLocationName);
//         logger.info(`Geocoded "${extractedLocationName}" to ${JSON.stringify(coords)}.`);

//         if (!coords || typeof coords.lat === 'undefined' || typeof coords.lon === 'undefined') {
//             logger.warn(`Could not geocode location "${extractedLocationName}" for disaster ${disasterId}.`);
//             return res.status(400).json({ message: 'Could not geocode the extracted location.' });
//         }

//         // Step 3: Update the disaster record in Supabase with the new location (GEOGRAPHY type)
//         // PostgreSQL ST_SetSRID(ST_Point(lon, lat), 4326) is used for GEOGRAPHY type
//         const { data, error } = await supabase
//             .from('disasters')
//             .update({
//                 location_name: extractedLocationName,
//                 location: `ST_SetSRID(ST_Point(${coords.lon}, ${coords.lat}), 4326)` // Use ST_Point(longitude, latitude)
//             })
//             .eq('id', disasterId)
//             .select();

//         if (error) {
//             logger.error(`Error updating disaster ${disasterId} with geocoded location:`, error);
//             return res.status(500).json({ message: 'Error updating disaster with geocoded location.', error: error.message });
//         }

//         const updatedDisaster = data[0];
//         if (!updatedDisaster) {
//             logger.warn(`Geocoding failed: Disaster ${disasterId} not found for update.`);
//             return res.status(404).json({ message: 'Disaster not found for updating geocoded location.' });
//         }

//         logger.info('Disaster location updated successfully.', {
//             disasterId: disasterId,
//             location: `${updatedDisaster.location_name} (${coords.lat}, ${coords.lon})`
//         });

//         // Emit real-time update that disaster location has been updated
//         const io = getSocketIO();
//         io.emit('disaster_updated', { type: 'location_updated', disaster: updatedDisaster });

//         res.status(200).json(updatedDisaster);

//     } catch (err) {
//         logger.error(`Unexpected error in POST /api/geocode:`, err);
//         res.status(500).json({ message: 'Internal server error during geocoding.' });
//     }
// });

// module.exports = router;


// src/api/geocoding/geocodingRoutes.js
const express = require('express');
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const { authenticate, authorize } = require('../../utils/authMiddleware');
const { extractLocationFromDescription } = require('../../services/geminiService');
const { geocodeLocation } = require('../../services/mappingService');
const { getSocketIO } = require('../../socket'); // For emitting real-time updates

const router = express.Router();

/**
 * @route POST /api/geocode
 * @desc Extract location from text description using Gemini and convert to lat/lon using mapping service.
 * Then updates the disaster record's 'location' field.
 * @access Private (admin, contributor)
 * @body {string} disasterId - The ID of the disaster to update.
 * @body {string} description - The text description to extract location from.
 * @returns {object} Updated disaster record with location data.
 */
router.post('/', authenticate, authorize(['admin', 'contributor']), async (req, res) => {
    const { disasterId, description } = req.body;
    const userId = req.user.id;

    if (!disasterId || !description) {
        logger.warn('Validation error: Missing disasterId or description for geocoding.', { body: req.body, user: userId });
        return res.status(400).json({ message: 'Missing required fields: disasterId and description.' });
    }

    try {
        // Step 1: Extract location name using mock Gemini API
        const extractedLocationName = await extractLocationFromDescription(description);
        logger.info(`Extracted location "${extractedLocationName}" for disaster ${disasterId} using Gemini.`);

        if (!extractedLocationName || extractedLocationName === "Unknown Location") {
            logger.warn(`Could not extract a valid location for disaster ${disasterId} from description.`);
            return res.status(400).json({ message: 'Could not extract a valid location from the provided description.' });
        }

        // Step 2: Convert location name to lat/lon using mock Mapping Service
        const coords = await geocodeLocation(extractedLocationName);
        logger.info(`Geocoded "${extractedLocationName}" to ${JSON.stringify(coords)}.`);

        if (!coords || typeof coords.lat === 'undefined' || typeof coords.lon === 'undefined') {
            logger.warn(`Could not geocode location "${extractedLocationName}" for disaster ${disasterId}.`);
            return res.status(400).json({ message: 'Could not geocode the extracted location.' });
        }

        // --- FIX START ---
        // Construct the WKT (Well-Known Text) string for a POINT geometry.
        // Supabase will automatically handle the SRID if the column is GEOGRAPHY(Point, 4326)
        // and you pass a valid WKT string.
        const pointWkt = `POINT(${coords.lon} ${coords.lat})`; // Format is POINT(longitude latitude)
        // --- FIX END ---

        // Step 3: Update the disaster record in Supabase with the new location
        const { data, error } = await supabase
            .from('disasters')
            .update({
                location_name: extractedLocationName,
                location: pointWkt // Use the correctly formatted WKT string
            })
            .eq('id', disasterId)
            .select();

        if (error) {
            logger.error(`Error updating disaster ${disasterId} with geocoded location:`, error);
            return res.status(500).json({ message: 'Error updating disaster with geocoded location.', error: error.message });
        }

        const updatedDisaster = data[0];
        if (!updatedDisaster) {
            logger.warn(`Geocoding failed: Disaster ${disasterId} not found for update.`);
            return res.status(404).json({ message: 'Disaster not found for updating geocoded location.' });
        }

        logger.info('Disaster location updated successfully.', {
            disasterId: disasterId,
            location: `${updatedDisaster.location_name} (${coords.lat}, ${coords.lon})`
        });

        // Emit real-time update that disaster location has been updated
        const io = getSocketIO();
        io.emit('disaster_updated', { type: 'location_updated', disaster: updatedDisaster });

        res.status(200).json(updatedDisaster);

    } catch (err) {
        logger.error(`Unexpected error in POST /api/geocode:`, err);
        res.status(500).json({ message: 'Internal server error during geocoding.' });
    }
});

module.exports = router;