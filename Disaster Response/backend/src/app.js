// src/app.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const logger = require('./utils/logger');
const { initSocket } = require('./socket');

// Import API routes
const authRoutes = require('./api/auth/authRoutes');
const disasterRoutes = require('./api/disasters/disasterRoutes');
const geocodingRoutes = require('./api/geocoding/geocodingRoutes');

// Import nested routes
const socialMediaRoutes = require('./api/socialMedia/socialMediaRoutes');
const reportRoutes = require('./api/reports/reportRoutes');
const resourceRoutes = require('./api/resources/resourceRoutes');
const updateRoutes = require('./api/updates/updateRoutes');
const verificationRoutes = require('./api/verification/verificationRoutes');

const app = express();
const server = http.createServer(app);
const io = initSocket(server); // Initialize Socket.IO with the HTTP server

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all origins
app.use(express.json()); // Parse JSON request bodies

// Root route
app.get('/', (req, res) => {
    res.status(200).send('Disaster Response Backend API is running!');
});

// Primary API Routes
app.use('/api/auth', authRoutes);
app.use('/api/disasters', disasterRoutes);
app.use('/api/geocode', geocodingRoutes);

// Mount nested routes under /api/disasters/:disasterId
// These routes will receive `disasterId` as a parameter
app.use('/api/disasters', socialMediaRoutes); // Handles /api/disasters/:disasterId/social-media
app.use('/api/disasters', reportRoutes);     // Handles /api/disasters/:disasterId/reports
app.use('/api/disasters', resourceRoutes);   // Handles /api/disasters/:disasterId/resources
app.use('/api/disasters', updateRoutes);     // Handles /api/disasters/:disasterId/official-updates
app.use('/api/disasters', verificationRoutes);// Handles /api/disasters/:disasterId/reports/:reportId/verify-image

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack, path: req.path });
    res.status(500).json({ message: 'An internal server error occurred.' });
});

// Start the server
server.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
    logger.info(`Access the API at http://localhost:${PORT}`);
});