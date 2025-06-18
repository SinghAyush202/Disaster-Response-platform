const express = require('express');
const supabase = require('../../config/supabase');
const logger = require('../../utils/logger');
const { authenticate, authorize } = require('../../utils/authMiddleware');
const { geocodeLocation } = require('../../services/mappingService'); // To geocode resource location_name
const { getSocketIO } = require('../../socket'); // For emitting real-time updates

const router = express.Router();

/**
 * @route POST /api/disasters/:disasterId/resources
 * @desc Add a new resource for a specific disaster.
 * @access Private (admin, contributor)
 * @param {string} disasterId - The ID of the disaster.
 * @body {string} name - Name of the resource (e.g., "Red Cross Shelter").
 * @body {string} location_name - Human-readable location (e.g., "Lower East Side, NYC").
 * @body {string} type - Type of resource (e.g., "shelter", "food", "medical").
 * @returns {object} New resource record.
 */
router.post('/:disasterId/resources', authenticate, authorize(['admin', 'contributor']), async (req, res) => {
    const { disasterId } = req.params;
    const { name, location_name, type } = req.body;
    const userId = req.user.id;

    if (!name || !location_name || !type) {
        logger.warn('Validation error: Missing resource fields.', { body: req.body, user: userId, disasterId: disasterId });
        return res.status(400).json({ message: 'Missing required fields: name, location_name, type.' });
    }

    try {
        // Geocode the location_name to lat/lon
        const coords = await geocodeLocation(location_name);
        if (!coords || typeof coords.lat === 'undefined' || typeof coords.lon === 'undefined') {
            logger.warn(`Could not geocode resource location "${location_name}" for disaster ${disasterId}.`);
            return res.status(400).json({ message: 'Could not geocode the provided resource location.' });
        }

        const { data, error } = await supabase
            .from('resources')
            .insert({
                disaster_id: disasterId,
                name,
                location_name,
                type,
                location: `ST_SetSRID(ST_Point(${coords.lon}, ${coords.lat}), 4326)`
            })
            .select();

        if (error) {
            logger.error(`Error adding resource for disaster ${disasterId}:`, error);
            return res.status(500).json({ message: 'Error adding resource.', error: error.message });
        }

        const newResource = data[0];
        logger.info('Resource added successfully.', { resourceId: newResource.id, disasterId: disasterId, location: location_name });

        // Emit real-time update
        const io = getSocketIO();
        io.emit('resources_updated', { type: 'created', disasterId: disasterId, resource: newResource });

        res.status(201).json(newResource);
    } catch (err) {
        logger.error(`Unexpected error in POST /api/disasters/:disasterId/resources for ${disasterId}:`, err);
        res.status(500).json({ message: 'Internal server error while adding resource.' });
    }
});


/**
 * @route GET /api/disasters/:disasterId/resources
 * @desc Get resources for a specific disaster, with optional geospatial lookup.
 * @access Public
 * @param {string} disasterId - The ID of the disaster.
 * @query {number} [lat] - Latitude for geospatial query.
 * @query {number} [lon] - Longitude for geospatial query.
 * @query {number} [radius=10000] - Radius in meters for geospatial query (default 10km).
 * @query {string} [type] - Optional filter by resource type (e.g., 'shelter').
 * @returns {object[]} Array of resource records.
 */
router.get('/:disasterId/resources', async (req, res) => {
    const { disasterId } = req.params;
    const { lat, lon, radius = 10000, type } = req.query; // radius in meters

    try {
        let query = supabase
            .from('resources')
            .select('*')
            .eq('disaster_id', disasterId)
            .order('created_at', { ascending: false });

        if (lat && lon) {
            // Validate lat/lon
            const parsedLat = parseFloat(lat);
            const parsedLon = parseFloat(lon);
            const parsedRadius = parseInt(radius, 10);

            if (isNaN(parsedLat) || isNaN(parsedLon) || isNaN(parsedRadius) || parsedRadius <= 0) {
                return res.status(400).json({ message: 'Invalid latitude, longitude, or radius provided.' });
            }

            // Geospatial query: Find resources within a given radius of a point
            // ST_DWithin(geometry A, geometry B, distance_meters, use_spheroid)
            // ST_SetSRID(ST_Point(longitude, latitude), SRID)
            query = query.rpc('find_nearby_resources', {
                disaster_id_param: disasterId,
                target_point: `POINT(${parsedLon} ${parsedLat})`,
                max_distance_meters: parsedRadius
            });
            logger.info(`Fetching resources for disaster ${disasterId} within ${radius}m of (${lat}, ${lon}).`);
        } else {
            logger.info(`Fetching all resources for disaster ${disasterId}.`);
        }

        if (type) {
            query = query.eq('type', type);
            logger.info(`Filtering resources by type: ${type}`);
        }

        const { data, error } = await query;


        if (error) {
            logger.error(`Error fetching resources for disaster ${disasterId}:`, error);
            // Handle specific PostGIS errors if necessary (e.g., invalid geometry)
            return res.status(500).json({ message: 'Error fetching resources.', error: error.message });
        }

        logger.info(`Fetched ${data.length} resources for disaster ${disasterId}.`);
        res.status(200).json(data);
    } catch (err) {
        logger.error(`Unexpected error in GET /api/disasters/:disasterId/resources for ${disasterId}:`, err);
        res.status(500).json({ message: 'Internal server error while fetching resources.' });
    }
});

module.exports = router;