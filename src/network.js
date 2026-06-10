// network.js - Moroccan Dama WebRTC P2P Connection Manager

import { Peer } from 'peerjs';

class DamaNetwork {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.myId = '';
    this.isHost = false;
    
    // Callbacks to communicate with UI
    this.onStatusChange = null;     // (statusText, isError)
    this.onPeerIdGenerated = null;  // (id)
    this.onConnected = null;        // (role: 'host' | 'client')
    this.onDataReceived = null;     // (type, payload)
    this.onDisconnected = null;     // ()
  }

  // Initialize PeerJS
  init() {
    if (this.peer) return;

    this.updateStatus("Connecting to matchmaking server...", false);

    // Create a new Peer connection to PeerJS cloud server
    // Default server is peerjs cloud, free signaling
    this.peer = new Peer();

    this.peer.on('open', (id) => {
      this.myId = id;
      this.updateStatus("Ready. Waiting for partner.", false);
      if (this.onPeerIdGenerated) {
        this.onPeerIdGenerated(id);
      }
    });

    // Handle incoming connections (We are the HOST)
    this.peer.on('connection', (connection) => {
      // If we already have a connection, close it to accept the new one
      if (this.conn) {
        this.conn.close();
      }

      this.conn = connection;
      this.isHost = true;
      this.bindConnectionEvents();
      this.updateStatus("Incoming connection...", false);
    });

    this.peer.on('error', (err) => {
      console.error("PeerJS error:", err);
      let errMsg = "Matchmaking server error.";
      if (err.type === 'peer-not-found') {
        errMsg = "Opponent ID not found. Check spelling.";
      } else if (err.type === 'network') {
        errMsg = "Network error. Check connection.";
      } else if (err.type === 'server-error') {
        errMsg = "Could not connect to signalling server.";
      }
      this.updateStatus(errMsg, true);
    });
  }

  // Connect to another player (We are the CLIENT/GUEST)
  connect(opponentId) {
    if (!this.peer) {
      this.init();
    }

    if (!opponentId || opponentId.trim() === '') {
      this.updateStatus("Please enter a valid Opponent ID.", true);
      return;
    }

    this.updateStatus(`Connecting to ${opponentId}...`, false);
    this.isHost = false;

    // Connect to peer
    this.conn = this.peer.connect(opponentId.trim(), {
      reliable: true
    });

    this.bindConnectionEvents();
  }

  // Bind WebRTC connection data channel events
  bindConnectionEvents() {
    if (!this.conn) return;

    this.conn.on('open', () => {
      this.updateStatus("Connected!", false);
      if (this.onConnected) {
        this.onConnected(this.isHost ? 'host' : 'client');
      }
    });

    this.conn.on('data', (data) => {
      if (this.onDataReceived && data && data.type) {
        this.onDataReceived(data.type, data.payload);
      }
    });

    this.conn.on('close', () => {
      this.updateStatus("Opponent disconnected.", true);
      if (this.onDisconnected) {
        this.onDisconnected();
      }
      this.cleanup();
    });

    this.conn.on('error', (err) => {
      console.error("Connection data channel error:", err);
      this.updateStatus("Connection error.", true);
      if (this.onDisconnected) {
        this.onDisconnected();
      }
      this.cleanup();
    });
  }

  // Transmit payload to the other peer
  send(type, payload) {
    if (this.conn && this.conn.open) {
      this.conn.send({ type, payload });
      return true;
    }
    return false;
  }

  updateStatus(msg, isError = false) {
    if (this.onStatusChange) {
      this.onStatusChange(msg, isError);
    }
  }

  cleanup() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
  }

  // Fully shut down
  close() {
    this.cleanup();
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.myId = '';
    this.isHost = false;
  }
}

export const network = new DamaNetwork();
