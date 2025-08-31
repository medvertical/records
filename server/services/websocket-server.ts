import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export class ValidationWebSocketServer {
  private wss: WebSocketServer;
  private clients: Set<WebSocket> = new Set();

  constructor(server: Server) {
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/validation'
    });

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('WebSocket client connected for validation updates');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial status
      this.sendToClient(ws, {
        type: 'status',
        data: { connected: true }
      });
    });
  }

  private sendToClient(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
        this.clients.delete(ws);
      }
    }
  }

  broadcastProgress(progress: any) {
    const message = {
      type: 'validation_progress',
      data: progress
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  broadcastValidationStart() {
    const message = {
      type: 'validation_started',
      data: { timestamp: new Date().toISOString() }
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  broadcastValidationStopped() {
    const message = {
      type: 'validation_stopped',
      data: { timestamp: new Date().toISOString() }
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  broadcastValidationPaused() {
    const message = {
      type: 'validation_paused',
      data: { timestamp: new Date().toISOString() }
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  broadcastMessage(message: string) {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          console.error('Error broadcasting message:', error);
          this.clients.delete(client);
        }
      }
    });
  }

  broadcastValidationComplete(progress: any) {
    const message = {
      type: 'validation_complete',
      data: progress
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  broadcastError(error: string) {
    const message = {
      type: 'validation_error',
      data: { error, timestamp: new Date().toISOString() }
    };

    this.clients.forEach(client => {
      this.sendToClient(client, message);
    });
  }

  // Add alias methods for compatibility with old code
  broadcastValidationProgress(progress: any) {
    this.broadcastProgress(progress);
  }
}

export let validationWebSocket: ValidationWebSocketServer;

export function initializeWebSocket(server: Server) {
  validationWebSocket = new ValidationWebSocketServer(server);
  return validationWebSocket;
}