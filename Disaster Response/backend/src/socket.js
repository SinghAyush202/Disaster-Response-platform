const { Server } = require('socket.io');
const logger = require('./utils/logger');

let io;

/**
 * Initializes Socket.IO server.
 * @param {object} httpServer - The HTTP server instance.
 */
function initSocket(httpServer) {
    if (io) {
        logger.warn('Socket.IO already initialized.');
        return io;
    }

    io = new Server(httpServer, {
        cors: {
            origin: "*", // Allow all origins for simplicity in development
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        logger.info(`A user connected: ${socket.id}`);

        socket.on('disconnect', () => {
            logger.info(`User disconnected: ${socket.id}`);
        });

        // Example of a custom event listener
        socket.on('join_room', (room) => {
            socket.join(room);
            logger.info(`User ${socket.id} joined room: ${room}`);
        });
    });

    logger.info('Socket.IO server initialized.');
    return io;
}

/**
 * Gets the Socket.IO server instance.
 * @returns {Server} - The Socket.IO server instance.
 */
function getSocketIO() {
    if (!io) {
        logger.error('Socket.IO not initialized. Call initSocket first.');
        throw new Error('Socket.IO not initialized.');
    }
    return io;
}

module.exports = {
    initSocket,
    getSocketIO
};