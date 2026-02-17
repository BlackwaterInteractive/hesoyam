/**
 * Hesoyam Discord RP Server
 *
 * Monitors Discord Rich Presence for connected users and tracks
 * gaming sessions in Supabase.
 */

import { logger } from './utils/logger.js';
import { testConnection } from './supabase/client.js';
import { connectToDiscord, disconnectFromDiscord } from './discord/client.js';
import { sessionTracker } from './services/session-tracker.js';

class HesoyamDiscordRPServer {
  private isShuttingDown = false;

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      this.displayBanner();

      // Test Supabase connection
      logger.info('Testing Supabase connection...');
      const connected = await testConnection();
      if (!connected) {
        throw new Error('Failed to connect to Supabase');
      }

      // Connect to Discord
      logger.info('Connecting to Discord...');
      await connectToDiscord();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.success('Hesoyam Discord RP Server started successfully');
    } catch (error) {
      logger.error('Failed to start server', error);
      process.exit(1);
    }
  }

  /**
   * Display startup banner
   */
  private displayBanner(): void {
    console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║        Hesoyam Discord RP Server                      ║
║        Gaming Activity Tracker via Discord            ║
║                                                       ║
║        https://hesoyam.gg                             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
    `);
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string): Promise<void> => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info(`Received ${signal}, shutting down gracefully...`);

      try {
        // Close all active sessions in the database before shutting down
        await sessionTracker.closeAllSessions();

        // Disconnect from Discord
        await disconnectFromDiscord();

        logger.success('Server stopped successfully');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error);
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection', reason);
      shutdown('unhandledRejection');
    });
  }
}

// Start the server
const server = new HesoyamDiscordRPServer();
server.start();
