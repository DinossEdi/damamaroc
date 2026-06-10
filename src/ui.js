// ui.js - Moroccan Dama UI Controller

import { Game, Players, Pieces } from './game.js';
import { DamaAI } from './ai.js';
import { audio } from './audio.js';
import { network } from './network.js';
import { db } from './db.js';

class DamaUI {
  constructor() {
    this.game = null;
    this.ai = new DamaAI('medium');
    
    // UI Selection States
    this.selectedPiece = null; // { r, c }
    this.validMoves = [];      // Moves for the active player
    this.huffingSelectionMode = false;
    this.animating = false;    // Lock input during slide transitions
    
    // Setup Settings
    this.gameMode = 'ai';      // 'ai' | 'pvp'
    this.playerColor = Players.WHITE; // Players.WHITE | Players.BLACK
    this.aiDifficulty = 'medium';     // 'easy' | 'medium' | 'hard'
    this.nfekhEnabled = false;        // Huffing rules
    this.showSuggestions = true;      // Move recommendations toggle
    this.scoreUpdated = false;        // Prevent double rating payouts
    
    // Remote opponent details
    this.opponentUsername = "Opponent";
    this.activeAuthTab = "login";     // 'login' | 'register'
    
    // Current Color Theme
    this.themes = ['default', 'sahara', 'atlas'];
    this.themeIndex = 0;

    // Cache DOM Elements
    this.dom = {};
  }

  async init() {
    this.cacheElements();
    this.bindEvents();
    this.loadSettings();
    this.renderInitialBoard();
    this.setupNetworkCallbacks();
    
    // Initialize user database
    await db.init();
    this.updateAuthUI();
    this.refreshLeaderboard();
    
    // Run engine tests in developer console
    try {
      Game.test();
    } catch(e) {
      console.error("Self-test failed:", e);
    }
  }

  cacheElements() {
    this.dom.setupScreen = document.getElementById('setup-screen');
    this.dom.gameScreen = document.getElementById('game-screen');
    
    // Setup controls
    this.dom.btnStart = document.getElementById('btn-start-game');
    this.dom.modeGroup = document.getElementById('mode-group');
    this.dom.difficultyGroup = document.getElementById('difficulty-group');
    this.dom.difficultyContainer = document.getElementById('difficulty-group-container');
    this.dom.colorGroup = document.getElementById('color-group');
    this.dom.colorContainer = document.getElementById('color-group-container');
    this.dom.nfekhGroup = document.getElementById('nfekh-group');
    this.dom.nfekhGroupContainer = document.getElementById('nfekh-group-container');
    this.dom.nfekhDesc = document.getElementById('nfekh-desc');
    this.dom.suggestionsGroup = document.getElementById('suggestions-group');

    // Online Lobby controls
    this.dom.onlineLobbyGroup = document.getElementById('online-lobby-group');
    this.dom.localPeerId = document.getElementById('local-peer-id');
    this.dom.btnCopyId = document.getElementById('btn-copy-id');
    this.dom.hostStatus = document.getElementById('host-status');
    this.dom.opponentPeerId = document.getElementById('opponent-peer-id');
    this.dom.btnConnectPeer = document.getElementById('btn-connect-peer');
    this.dom.joinStatus = document.getElementById('join-status');

    // Gameplay dashboard
    this.dom.boardGrid = document.getElementById('board-grid');
    this.dom.piecesOverlay = document.getElementById('pieces-overlay');
    this.dom.turnDisplay = document.getElementById('turn-display');
    this.dom.nameWhite = document.getElementById('name-white');
    this.dom.nameBlack = document.getElementById('name-black');
    this.dom.capturedWhite = document.getElementById('captured-by-white');
    this.dom.capturedBlack = document.getElementById('captured-by-black');
    this.dom.playerWhiteInfo = document.getElementById('player-white-info');
    this.dom.playerBlackInfo = document.getElementById('player-black-info');

    // Action buttons
    this.dom.btnNfekh = document.getElementById('btn-nfekh');
    this.dom.btnUndo = document.getElementById('btn-undo');
    this.dom.btnMenu = document.getElementById('btn-menu');
    this.dom.btnRules = document.getElementById('btn-rules');
    this.dom.btnTheme = document.getElementById('btn-theme');
    this.dom.btnMute = document.getElementById('btn-mute');

    // Overlays
    this.dom.gameoverOverlay = document.getElementById('gameover-overlay');
    this.dom.gameoverTitle = document.getElementById('gameover-title');
    this.dom.gameoverReason = document.getElementById('gameover-reason');
    this.dom.btnGameoverRestart = document.getElementById('btn-gameover-restart');

    // Account & Leaderboard controls
    this.dom.dbStatusBadge = document.getElementById('db-status-badge');
    this.dom.dbStatusText = document.getElementById('db-status-text');
    this.dom.authView = document.getElementById('auth-view');
    this.dom.profileView = document.getElementById('profile-view');
    this.dom.btnTabLogin = document.getElementById('btn-tab-login');
    this.dom.btnTabRegister = document.getElementById('btn-tab-register');
    this.dom.authForm = document.getElementById('auth-form');
    this.dom.authUsername = document.getElementById('auth-username');
    this.dom.authPassword = document.getElementById('auth-password');
    this.dom.btnAuthSubmit = document.getElementById('btn-auth-submit');
    this.dom.authMessage = document.getElementById('auth-message');
    this.dom.btnGuestPlay = document.getElementById('btn-guest-play');
    this.dom.profileUsername = document.getElementById('profile-username');
    this.dom.statScore = document.getElementById('stat-score');
    this.dom.statRecord = document.getElementById('stat-record');
    this.dom.statWinrate = document.getElementById('stat-winrate');
    this.dom.btnLogout = document.getElementById('btn-logout');
    this.dom.leaderboardList = document.getElementById('leaderboard-list');

    this.dom.rulesOverlay = document.getElementById('rules-overlay');
    this.dom.btnCloseRules = document.getElementById('btn-close-rules');

    // History Log
    this.dom.historyList = document.getElementById('history-list');
    
    // Particle layer
    this.dom.particleLayer = document.getElementById('particle-layer');
  }

  bindEvents() {
    // Setup Radio Buttons Toggles
    this.setupRadioButtonGroup(this.dom.modeGroup, (val) => {
      this.gameMode = val;
      if (val === 'pvp') {
        this.dom.difficultyContainer.style.display = 'none';
        this.dom.colorContainer.style.display = 'none';
        this.dom.onlineLobbyGroup.style.display = 'none';
        this.dom.btnStart.style.display = 'block';
        this.dom.nfekhGroupContainer.style.display = 'block';
        network.close();
      } else if (val === 'online') {
        this.dom.difficultyContainer.style.display = 'none';
        this.dom.colorContainer.style.display = 'none';
        this.dom.onlineLobbyGroup.style.display = 'block';
        this.dom.btnStart.style.display = 'none';
        this.dom.nfekhGroupContainer.style.display = 'block'; // Host can still toggle!
        network.init();
      } else {
        this.dom.difficultyContainer.style.display = 'block';
        this.dom.colorContainer.style.display = 'block';
        this.dom.onlineLobbyGroup.style.display = 'none';
        this.dom.btnStart.style.display = 'block';
        this.dom.nfekhGroupContainer.style.display = 'block';
        network.close();
      }
    });

    this.setupRadioButtonGroup(this.dom.difficultyGroup, (val) => {
      this.aiDifficulty = val;
      this.ai.setDifficulty(val);
    });

    this.setupRadioButtonGroup(this.dom.colorGroup, (val) => {
      this.playerColor = (val === 'white') ? Players.WHITE : Players.BLACK;
    });

    this.setupRadioButtonGroup(this.dom.nfekhGroup, (val) => {
      this.nfekhEnabled = (val === 'true');
      this.dom.nfekhDesc.innerHTML = this.nfekhEnabled 
        ? "Nfekh: Missed captures are allowed but opponent can 'huff' (remove) the offending piece."
        : "Strict: Valid moves are restricted to jumps if a capture is available.";
        
      // If we are host of online match, sync settings with the guest
      if (this.gameMode === 'online' && network.conn && network.isHost) {
        network.send('settings', { nfekhMode: this.nfekhEnabled });
      }
    });

    // Start Button
    this.dom.btnStart.addEventListener('click', () => {
      // Audio engine initialization triggers on user click
      audio.init();
      this.startNewMatch();
    });

    // Lobby Buttons
    this.dom.btnCopyId.addEventListener('click', () => this.copyPeerId());
    this.dom.btnConnectPeer.addEventListener('click', () => this.connectToPeer());

    // Gameplay Sidebar actions
    this.dom.btnUndo.addEventListener('click', () => this.handleUndo());
    this.dom.btnMenu.addEventListener('click', () => this.goToMainMenu());
    this.dom.btnRules.addEventListener('click', () => this.dom.rulesOverlay.classList.add('active'));
    this.dom.btnCloseRules.addEventListener('click', () => this.dom.rulesOverlay.classList.remove('active'));
    
    // Game Over actions
    this.dom.btnGameoverRestart.addEventListener('click', () => {
      this.dom.gameoverOverlay.classList.remove('active');
      this.startNewMatch();
    });

    // Traditional Nfekh! Huffing Action
    this.dom.btnNfekh.addEventListener('click', () => this.toggleNfekhMode());

    // Settings
    this.dom.btnTheme.addEventListener('click', () => this.rotateTheme());
    this.dom.btnMute.addEventListener('click', () => this.toggleMute());

    // Move Suggestions
    this.setupRadioButtonGroup(this.dom.suggestionsGroup, (val) => {
      this.showSuggestions = (val === 'true');
    });

    // Account Tab Toggles
    this.dom.btnTabLogin.addEventListener('click', () => this.switchAuthTab('login'));
    this.dom.btnTabRegister.addEventListener('click', () => this.switchAuthTab('register'));

    // Auth Submission
    this.dom.authForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleAuthSubmit();
    });

    // Play as Guest
    this.dom.btnGuestPlay.addEventListener('click', () => this.handlePlayAsGuest());

    // Logout
    this.dom.btnLogout.addEventListener('click', () => this.handleLogout());
  }

  // Helper to set up styled toggle button sets
  setupRadioButtonGroup(groupEl, callback) {
    const buttons = groupEl.querySelectorAll('.btn-radio');
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        callback(btn.dataset.value);
        audio.playMove(); // short interface click
      });
    });
  }

  loadSettings() {
    // Theme
    const savedTheme = localStorage.getItem('dama-theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      this.themeIndex = this.themes.indexOf(savedTheme);
      if (this.themeIndex === -1) this.themeIndex = 0;
    }
    this.updateThemeButtonLabel();

    // Mute
    const savedMuted = localStorage.getItem('dama-muted') === 'true';
    if (savedMuted) {
      audio.toggleMute();
      this.updateMuteButtonLabel();
    }
  }

  rotateTheme() {
    this.themeIndex = (this.themeIndex + 1) % this.themes.length;
    const nextTheme = this.themes[this.themeIndex];
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('dama-theme', nextTheme);
    this.updateThemeButtonLabel();
    audio.playMove();
  }

  updateThemeButtonLabel() {
    const themeName = this.themes[this.themeIndex];
    const capitalized = themeName.charAt(0).toUpperCase() + themeName.slice(1);
    this.dom.btnTheme.innerHTML = `Theme: ${capitalized}`;
  }

  toggleMute() {
    const isMuted = audio.toggleMute();
    localStorage.setItem('dama-muted', isMuted);
    this.updateMuteButtonLabel();
    if (!isMuted) audio.playMove();
  }

  updateMuteButtonLabel() {
    this.dom.btnMute.innerHTML = audio.isMuted() ? "Unmute" : "Mute";
  }

  startNewMatch() {
    this.game = new Game(this.nfekhEnabled);
    this.selectedPiece = null;
    this.validMoves = [];
    this.huffingSelectionMode = false;
    this.animating = false;
    this.scoreUpdated = false; // Reset score updated tracker

    // Apply AI difficulty setting
    this.ai.setDifficulty(this.aiDifficulty);

    const myName = db.getCurrentUser() ? db.getCurrentUser().username : "Guest";

    // Style layout names
    if (this.gameMode === 'pvp') {
      this.dom.nameWhite.innerHTML = "Player 1";
      this.dom.nameBlack.innerHTML = "Player 2";
    } else {
      this.dom.nameWhite.innerHTML = (this.playerColor === Players.WHITE) ? myName : "Computer";
      this.dom.nameBlack.innerHTML = (this.playerColor === Players.BLACK) ? myName : "Computer";
    }

    // Toggle active screen classes
    this.dom.setupScreen.classList.remove('active');
    this.dom.gameScreen.classList.add('active');

    this.dom.historyList.innerHTML = "";
    this.dom.btnNfekh.classList.remove('active', 'huffing-mode');

    this.renderInitialBoard();
    this.redrawBoard();

    // If Computer moves first (Computer is White, Player is Red)
    if (this.gameMode === 'ai' && this.playerColor === Players.BLACK && this.game.turn === Players.WHITE) {
      this.triggerAIMove();
    }
  }

  goToMainMenu() {
    this.dom.gameScreen.classList.remove('active');
    this.dom.setupScreen.classList.add('active');
    audio.playMove();
  }

  // Draw the static squares grid (re-created per match for perspective)
  renderInitialBoard() {
    this.dom.boardGrid.innerHTML = "";
    const flip = (this.gameMode !== 'pvp' && this.playerColor === Players.BLACK);

    for (let sr = 0; sr < 8; sr++) {
      for (let sc = 0; sc < 8; sc++) {
        const r = flip ? (7 - sr) : sr;
        const c = flip ? (7 - sc) : sc;

        const square = document.createElement('div');
        const isLight = (r + c) % 2 === 0;
        
        square.className = `square ${isLight ? 'light' : 'dark'}`;
        square.dataset.row = r;
        square.dataset.col = c;

        // Add coordinate tags (A-H, 1-8) along bottom and left ranks of screen
        if (sr === 7) { // Bottom row of screen
          const fileLabel = document.createElement('span');
          fileLabel.className = 'coord-label file';
          fileLabel.innerHTML = String.fromCharCode(65 + c); // A-H
          square.appendChild(fileLabel);
        }
        if (sc === 0) { // Left file of screen
          const rankLabel = document.createElement('span');
          rankLabel.className = 'coord-label rank';
          rankLabel.innerHTML = 8 - r; // 1-8
          square.appendChild(rankLabel);
        }

        // Add click listener to square for movement destinations
        square.addEventListener('click', () => this.handleSquareClick(r, c));
        this.dom.boardGrid.appendChild(square);
      }
    }
  }

  // Main board redraw. Re-populates pieces and updates game status elements.
  redrawBoard() {
    // Re-render board grid squares to align click events with perspective
    this.renderInitialBoard();

    // Clear pieces
    this.dom.piecesOverlay.innerHTML = "";
    const flip = (this.gameMode !== 'pvp' && this.playerColor === Players.BLACK);
    
    // Redraw all pieces from game state
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const pieceVal = this.game.board[r][c];
        if (pieceVal !== Pieces.EMPTY) {
          const pieceEl = document.createElement('div');
          const isWhite = pieceVal === Pieces.WHITE_MAN || pieceVal === Pieces.WHITE_KING;
          const isKing = pieceVal === Pieces.WHITE_KING || pieceVal === Pieces.BLACK_KING;

          pieceEl.className = `piece ${isWhite ? 'white' : 'black'} ${isKing ? 'king' : ''}`;
          pieceEl.dataset.row = r;
          pieceEl.dataset.col = c;
          
          // Calculate screen coordinates based on perspective
          const sr = flip ? (7 - r) : r;
          const sc = flip ? (7 - c) : c;
          
          pieceEl.style.top = `${sr * 12.5}%`;
          pieceEl.style.left = `${sc * 12.5}%`;

          // Add click listener
          pieceEl.addEventListener('click', (e) => {
            e.stopPropagation(); // Avoid triggering square click
            this.handlePieceClick(r, c);
          });

          this.dom.piecesOverlay.appendChild(pieceEl);
        }
      }
    }

    this.updateDashboard();
    this.clearHighlights();
    this.updateNfekhButton();
  }

  updateDashboard() {
    const turn = this.game.turn;

    // Display turn text
    if (this.gameMode === 'ai') {
      const isPlayerTurn = (turn === this.playerColor);
      this.dom.turnDisplay.innerHTML = isPlayerTurn ? "Your Turn" : "Computer is Thinking...";
    } else if (this.gameMode === 'online') {
      const isPlayerTurn = (turn === this.playerColor);
      this.dom.turnDisplay.innerHTML = isPlayerTurn ? "Your Turn" : "Opponent's Turn";
    } else {
      this.dom.turnDisplay.innerHTML = (turn === Players.WHITE) ? "White's Turn" : "Red's Turn";
    }

    // Highlight active player card
    if (turn === Players.WHITE) {
      this.dom.playerWhiteInfo.classList.add('active');
      this.dom.playerBlackInfo.classList.remove('active');
    } else {
      this.dom.playerBlackInfo.classList.add('active');
      this.dom.playerWhiteInfo.classList.remove('active');
    }

    // Update captured piece trays (we start with 12 and count how many remain)
    let whiteCount = 0;
    let blackCount = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.game.board[r][c];
        if (piece === Pieces.WHITE_MAN || piece === Pieces.WHITE_KING) whiteCount++;
        if (piece === Pieces.BLACK_MAN || piece === Pieces.BLACK_KING) blackCount++;
      }
    }

    const capturedWhiteCount = 12 - blackCount; // pieces White has captured
    const capturedBlackCount = 12 - whiteCount; // pieces Black has captured

    this.dom.capturedWhite.innerHTML = "";
    for (let i = 0; i < capturedWhiteCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'captured-mini black';
      this.dom.capturedWhite.appendChild(dot);
    }

    this.dom.capturedBlack.innerHTML = "";
    for (let i = 0; i < capturedBlackCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'captured-mini white';
      this.dom.capturedBlack.appendChild(dot);
    }
  }

  updateNfekhButton() {
    const isPlayerTurn = (this.gameMode === 'pvp') || 
                         (this.gameMode === 'ai' && this.game.turn === this.playerColor) ||
                         (this.gameMode === 'online' && this.game.turn === this.playerColor);
    const huffAvailable = this.game.huffState && this.game.huffState.player === this.game.turn && this.game.huffState.huffable.length > 0;

    if (huffAvailable && isPlayerTurn) {
      this.dom.btnNfekh.classList.add('active');
    } else {
      this.dom.btnNfekh.classList.remove('active', 'huffing-mode');
      this.huffingSelectionMode = false;
    }
  }

  // Highlight available pieces that can huff when Nfekh button is toggled
  toggleNfekhMode() {
    if (!this.game.huffState) return;

    this.huffingSelectionMode = !this.huffingSelectionMode;
    
    if (this.huffingSelectionMode) {
      this.dom.btnNfekh.classList.add('huffing-mode');
      this.clearHighlights();
      this.selectedPiece = null;

      // Add glow overlay class `.huffable` to offending opponent pieces
      this.game.huffState.huffable.forEach(h => {
        const pieceEl = this.getPieceEl(h.pieceCoord[0], h.pieceCoord[1]);
        if (pieceEl) {
          pieceEl.classList.add('huffable');
        }
      });
    } else {
      this.dom.btnNfekh.classList.remove('huffing-mode');
      this.removeHuffableGlows();
    }
    audio.playMove();
  }

  removeHuffableGlows() {
    const pieces = this.dom.piecesOverlay.querySelectorAll('.piece');
    pieces.forEach(p => p.classList.remove('huffable'));
  }

  clearHighlights() {
    const squares = this.dom.boardGrid.querySelectorAll('.square');
    squares.forEach(sq => {
      sq.classList.remove('highlight-selected', 'highlight-move', 'highlight-capture');
    });
    
    const pieces = this.dom.piecesOverlay.querySelectorAll('.piece');
    pieces.forEach(p => p.classList.remove('selected'));
  }

  // Handles clicking a piece
  handlePieceClick(r, c) {
    if (this.animating) return;

    // 1. If in Nfekh selection mode: clicking an opponent's huffable piece
    if (this.huffingSelectionMode) {
      const isHuffTarget = this.game.huffState.huffable.some(h => h.pieceCoord[0] === r && h.pieceCoord[1] === c);
      if (isHuffTarget) {
        this.executeHuff(r, c);
      }
      return;
    }

    // Normal Piece Selection
    const turn = this.game.turn;
    const clickedPiece = this.game.getPiece(r, c);

    // Verify it's the current player's own piece
    if (!this.game.isOwnPiece(clickedPiece, turn)) return;

    // Check if this is a human's turn (either local PvP, AI Player's turn, or Online Player's turn)
    const isHumanTurn = (this.gameMode === 'pvp') || 
                        (this.gameMode === 'ai' && turn === this.playerColor) ||
                        (this.gameMode === 'online' && turn === this.playerColor);
    if (!isHumanTurn) return;

    // Select the piece
    this.clearHighlights();
    this.selectedPiece = { r, c };

    const clickedPieceEl = this.getPieceEl(r, c);
    if (clickedPieceEl) clickedPieceEl.classList.add('selected');

    // Highlight selected cell
    const selectedSquare = this.getSquareEl(r, c);
    if (selectedSquare) selectedSquare.classList.add('highlight-selected');

    // Get legal moves for this piece
    this.validMoves = this.game.getValidMoves().filter(m => m.path[0][0] === r && m.path[0][1] === c);

    // Highlight destinations if suggestions are enabled
    if (this.showSuggestions) {
      this.validMoves.forEach(move => {
        const dest = move.path[move.path.length - 1];
        const sq = this.getSquareEl(dest[0], dest[1]);
        if (sq) {
          if (move.captured.length > 0) {
            sq.classList.add('highlight-capture');
          } else {
            sq.classList.add('highlight-move');
          }
        }
      });
    }

    audio.playMove(); // scrap slide click
  }

  // Handles clicking a square
  handleSquareClick(r, c) {
    if (this.animating || !this.selectedPiece) return;

    // Check if square is highlighted as a move destination
    const selectedMove = this.validMoves.find(m => {
      const dest = m.path[m.path.length - 1];
      return dest[0] === r && dest[1] === c;
    });

    if (selectedMove) {
      this.executeMove(selectedMove);
    } else {
      // Deselect if clicking an empty, non-highlighted square
      this.clearHighlights();
      this.selectedPiece = null;
    }
  }

  // Visual move animation, state shift, sound triggers, and turn transitions
  executeMove(move) {
    this.animating = true;
    this.removeHuffableGlows();

    const start = move.path[0];
    const end = move.path[move.path.length - 1];
    
    // Find piece element
    const pieceEl = this.getPieceEl(start[0], start[1]);
    
    if (pieceEl) {
      // Update element attributes so that CSS transition slides it
      pieceEl.dataset.row = end[0];
      pieceEl.dataset.col = end[1];
      
      const flip = (this.gameMode !== 'pvp' && this.playerColor === Players.BLACK);
      const sr = flip ? (7 - end[0]) : end[0];
      const sc = flip ? (7 - end[1]) : end[1];
      
      pieceEl.style.top = `${sr * 12.5}%`;
      pieceEl.style.left = `${sc * 12.5}%`;

      // Animate captured pieces fading out + trigger particles
      if (move.captured.length > 0) {
        move.captured.forEach(cap => {
          const capEl = this.getPieceEl(cap.r, cap.c);
          if (capEl) {
            capEl.style.transform = "scale(0)";
            capEl.style.opacity = "0";
            capEl.style.transition = "transform 0.35s ease, opacity 0.35s ease";
          }
          // Spawn particle spray
          this.spawnParticles(cap.r, cap.c, cap.piece);
        });
      }
    }

    // Play slide or clack sound
    if (move.captured.length > 0) {
      audio.playCapture();
    } else {
      audio.playMove();
    }

    // Wait for slide transition (380ms)
    setTimeout(() => {
      // Execute move in game engine
      const result = this.game.makeMove(move);
      
      if (result.promoted) {
        audio.playPromotion();
      }

      // Log to history
      this.logMoveToHistory(move, result.promoted);

      // Send to opponent if online
      if (this.gameMode === 'online') {
        network.send('move', { move, promoted: result.promoted });
      }

      // Redraw board to lock in coordinates
      this.redrawBoard();
      this.selectedPiece = null;
      this.validMoves = [];
      this.animating = false;

      // Check game over
      const isOver = this.checkGameOver();
      if (!isOver && this.gameMode === 'ai' && this.game.turn !== this.playerColor) {
        this.triggerAIMove();
      }
    }, 380);
  }

  // Executing traditional Huff (Nfekh)
  executeHuff(r, c) {
    this.animating = true;
    
    // Trigger whoosh sound
    audio.playNfekh();

    // Trigger disintegrating particles
    this.spawnParticles(r, c, this.game.board[r][c]);

    const targetEl = this.getPieceEl(r, c);
    if (targetEl) {
      targetEl.style.transform = "scale(0) rotate(180deg)";
      targetEl.style.opacity = "0";
      targetEl.style.transition = "transform 0.45s ease, opacity 0.45s ease";
    }

    setTimeout(() => {
      this.game.huffPiece(r, c);
      this.huffingSelectionMode = false;
      this.dom.btnNfekh.classList.remove('huffing-mode');
      this.removeHuffableGlows();

      // Log huff to history
      this.logHuffToHistory([r, c]);

      // Sync huff online
      if (this.gameMode === 'online') {
        network.send('huff', { r, c });
      }

      this.redrawBoard();
      this.animating = false;

      // After a huff, turn does NOT change! Player plays their normal move.
      // However, if player is blocked now (e.g. no moves left), game over should trigger
      this.checkGameOver();
    }, 450);
  }

  // Triggers AI Minimax search in a delayed task to simulate thinking
  triggerAIMove() {
    this.animating = true;
    this.dom.turnDisplay.innerHTML = "Computer is Thinking...";

    setTimeout(() => {
      const action = this.ai.getBestAction(this.game);

      if (!action) {
        this.animating = false;
        this.checkGameOver();
        return;
      }

      if (action.type === 'huff') {
        // AI executes a huff!
        this.executeAIHuff(action.r, action.c);
      } else if (action.type === 'move') {
        // AI executes a move!
        this.executeAIMove(action.move);
      }
    }, 850); // Natural thinking buffer delay
  }

  executeAIHuff(r, c) {
    audio.playNfekh();
    this.spawnParticles(r, c, this.game.board[r][c]);

    const targetEl = this.getPieceEl(r, c);
    if (targetEl) {
      targetEl.style.transform = "scale(0) rotate(180deg)";
      targetEl.style.opacity = "0";
      targetEl.style.transition = "transform 0.45s ease, opacity 0.45s ease";
    }

    setTimeout(() => {
      this.game.huffPiece(r, c);
      this.logHuffToHistory([r, c], true);
      this.redrawBoard();
      this.animating = false;

      // AI still gets its normal turn after huffing, so trigger AI move search again!
      this.triggerAIMove();
    }, 450);
  }

  executeAIMove(move) {
    const start = move.path[0];
    const end = move.path[move.path.length - 1];
    
    const pieceEl = this.getPieceEl(start[0], start[1]);
    if (pieceEl) {
      pieceEl.dataset.row = end[0];
      pieceEl.dataset.col = end[1];
      
      const flip = (this.gameMode !== 'pvp' && this.playerColor === Players.BLACK);
      const sr = flip ? (7 - end[0]) : end[0];
      const sc = flip ? (7 - end[1]) : end[1];
      
      pieceEl.style.top = `${sr * 12.5}%`;
      pieceEl.style.left = `${sc * 12.5}%`;

      if (move.captured.length > 0) {
        move.captured.forEach(cap => {
          const capEl = this.getPieceEl(cap.r, cap.c);
          if (capEl) {
            capEl.style.transform = "scale(0)";
            capEl.style.opacity = "0";
            capEl.style.transition = "transform 0.35s ease, opacity 0.35s ease";
          }
          this.spawnParticles(cap.r, cap.c, cap.piece);
        });
      }
    }

    if (move.captured.length > 0) {
      audio.playCapture();
    } else {
      audio.playMove();
    }

    setTimeout(() => {
      const result = this.game.makeMove(move);
      
      if (result.promoted) {
        audio.playPromotion();
      }

      this.logMoveToHistory(move, result.promoted, true);
      this.redrawBoard();
      this.animating = false;

      const isOver = this.checkGameOver();
      if (!isOver && this.gameMode === 'ai' && this.game.turn !== this.playerColor) {
        // Safety re-trigger if turns desynced (should not happen)
        this.triggerAIMove();
      }
    }, 380);
  }

  handleUndo() {
    if (this.animating) return;
    if (this.gameMode === 'online') return; // Undo blocked in network play
    
    // In vs AI mode, undoing must revert BOTH the AI's move and the Player's move!
    if (this.gameMode === 'ai') {
      // Revert AI move
      if (this.game.history.length > 0 && this.game.turn === this.playerColor) {
        // AI made the last move
        this.game.undo();
        // Now it's the AI's turn again, so revert player move too
        this.game.undo();
      } else if (this.game.history.length > 0 && this.game.turn !== this.playerColor) {
        // Player is about to play, last move was by player (unusual case, maybe mid-thinking)
        this.game.undo();
      }
    } else {
      // Local PvP mode: revert just one move
      this.game.undo();
    }

    // Re-log history from scratch
    this.reconstructHistoryLog();

    this.selectedPiece = null;
    this.validMoves = [];
    this.huffingSelectionMode = false;
    this.redrawBoard();
    audio.playMove();
  }

  // Redraws the log sidebar based on the game's actual history
  reconstructHistoryLog() {
    this.dom.historyList.innerHTML = "";
    this.game.history.forEach(h => {
      if (h.move.huffed) {
        this.logHuffToHistory(h.move.huffed, h.turn === Players.BLACK);
      } else {
        // Reconstruct promotion flag
        const startVal = h.boardBefore[h.move.path[0][0]][h.move.path[0][1]];
        const endRow = h.move.path[h.move.path.length - 1][0];
        const isMan = startVal === Pieces.WHITE_MAN || startVal === Pieces.BLACK_MAN;
        const promoted = isMan && (endRow === 0 || endRow === 7);
        
        this.logMoveToHistory(h.move, promoted, h.turn === Players.BLACK);
      }
    });
  }

  // Formats coordinates as checkers algebraic notation (A1 - H8)
  formatCell(r, c) {
    const file = String.fromCharCode(65 + c);
    const rank = 8 - r;
    return `${file}${rank}`;
  }

  logMoveToHistory(move, promoted, isBlack = false) {
    const start = move.path[0];
    const end = move.path[move.path.length - 1];
    
    const startCoord = this.formatCell(start[0], start[1]);
    const endCoord = this.formatCell(end[0], end[1]);
    
    const hasCaptured = move.captured.length > 0;
    const separator = hasCaptured ? 'x' : '-';
    
    const moveText = `${startCoord}${separator}${endCoord}`;
    
    let desc = "";
    if (hasCaptured) {
      desc = `Captured ${move.captured.length} piece${move.captured.length > 1 ? 's' : ''}`;
    }
    if (promoted) {
      desc += (desc ? ", " : "") + "Promoted to Dama! 👑";
    }

    const item = document.createElement('div');
    item.className = `history-item ${isBlack ? 'black-turn' : 'white-turn'}`;
    item.innerHTML = `
      <span class="history-item-move">${moveText}</span>
      <span class="history-item-desc">${desc}</span>
    `;

    this.dom.historyList.appendChild(item);
    this.dom.historyList.scrollTop = this.dom.historyList.scrollHeight;
  }

  logHuffToHistory(coord, isBlack = false) {
    const formatted = this.formatCell(coord[0], coord[1]);
    const item = document.createElement('div');
    item.className = `history-item ${isBlack ? 'black-turn' : 'white-turn'}`;
    item.innerHTML = `
      <span class="history-item-move" style="color:#ef4444;">💨 Nfekh!</span>
      <span class="history-item-desc">Huffed piece at ${formatted}</span>
    `;
    this.dom.historyList.appendChild(item);
    this.dom.historyList.scrollTop = this.dom.historyList.scrollHeight;
  }

  spawnParticles(r, c, pieceType) {
    const rect = this.dom.boardGrid.getBoundingClientRect();
    const cellWidth = rect.width / 8;
    const cellHeight = rect.height / 8;
    
    const flip = (this.gameMode !== 'pvp' && this.playerColor === Players.BLACK);
    const sc = flip ? (7 - c) : c;
    const sr = flip ? (7 - r) : r;

    // Absolute position of square center on viewport
    const x = rect.left + window.scrollX + (sc * cellWidth) + (cellWidth / 2);
    const y = rect.top + window.scrollY + (sr * cellHeight) + (cellHeight / 2);

    const isWhite = pieceType === Pieces.WHITE_MAN || pieceType === Pieces.WHITE_KING;
    const particleColor = isWhite ? '#fcfaf2' : '#d65a31';

    for (let i = 0; i < 16; i++) {
      const p = document.createElement('div');
      p.className = 'dust-particle';
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.backgroundColor = particleColor;

      // Random trajectories
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 90;
      const tx = Math.cos(angle) * speed;
      const ty = Math.sin(angle) * speed;

      p.style.setProperty('--tx', `${tx}px`);
      p.style.setProperty('--ty', `${ty}px`);
      p.style.width = `${4 + Math.random() * 5}px`;
      p.style.height = p.style.width;

      this.dom.particleLayer.appendChild(p);

      // Clean up DOM
      setTimeout(() => {
        p.remove();
      }, 600);
    }
  }

  checkGameOver() {
    const over = this.game.checkGameOver();
    if (over.status !== 'active') {
      this.dom.gameoverOverlay.classList.add('active');

      if (over.status === 'white_win') {
        this.dom.gameoverTitle.innerHTML = "White Wins! 🏆";
        this.dom.gameoverReason.innerHTML = over.reason;
        
        if (this.gameMode === 'ai' && this.playerColor === Players.BLACK) {
          audio.playLose();
        } else {
          audio.playWin();
        }
      } 
      else if (over.status === 'black_win') {
        this.dom.gameoverTitle.innerHTML = "Red Wins! 🏆";
        this.dom.gameoverReason.innerHTML = over.reason;

        if (this.gameMode === 'ai' && this.playerColor === Players.WHITE) {
          audio.playLose();
        } else {
          audio.playWin();
        }
      } 
      else {
        this.dom.gameoverTitle.innerHTML = "It's a Draw! 🤝";
        this.dom.gameoverReason.innerHTML = over.reason;
        audio.playWin();
      }

      // Competitive rating scoring payouts
      const user = db.getCurrentUser();
      if (user && !this.scoreUpdated && this.gameMode !== 'pvp') {
        this.scoreUpdated = true;
        
        const myColor = this.playerColor;
        const won = (myColor === Players.WHITE && over.status === 'white_win') || 
                    (myColor === Players.BLACK && over.status === 'black_win');
        const lost = (myColor === Players.WHITE && over.status === 'black_win') || 
                     (myColor === Players.BLACK && over.status === 'white_win');
        const draw = over.status === 'draw';

        let points = 0;
        let isWin = false;
        let isLoss = false;
        let isDraw = false;

        if (this.gameMode === 'ai') {
          if (won) {
            isWin = true;
            points = this.aiDifficulty === 'easy' ? 5 : (this.aiDifficulty === 'medium' ? 10 : 20);
          } else if (lost) {
            isLoss = true;
            points = this.aiDifficulty === 'easy' ? -3 : (this.aiDifficulty === 'medium' ? -5 : -8);
          } else if (draw) {
            isDraw = true;
            points = this.aiDifficulty === 'easy' ? 1 : (this.aiDifficulty === 'medium' ? 2 : 4);
          }
        } else if (this.gameMode === 'online') {
          if (won) {
            isWin = true;
            points = 15;
          } else if (lost) {
            isLoss = true;
            points = -6;
          } else if (draw) {
            isDraw = true;
            points = 3;
          }
        }

        if (points !== 0 || isWin || isLoss || isDraw) {
          db.updateScore(points, isWin, isLoss, isDraw).then((res) => {
            if (res.status === 'success') {
              this.updateAuthUI();
              this.refreshLeaderboard();
              
              const scoreText = points >= 0 ? `+${points}` : `${points}`;
              const badgeClass = points >= 0 ? 'success' : 'error';
              const badgeText = points >= 0 ? `Rating Gain: ${scoreText} pts` : `Rating Loss: ${scoreText} pts`;
              
              this.dom.gameoverReason.innerHTML += `
                <br>
                <div class="auth-message ${badgeClass}" style="display: inline-block; margin-top: 0.75rem; padding: 0.35rem 0.75rem; font-size: 0.75rem;">
                  ${badgeText} &nbsp;|&nbsp; New Score: <strong>${res.user.score}</strong>
                </div>
              `;
            }
          });
        }
      }

      return true;
    }
    return false;
  }

  // DOM query helper for grid cell element
  getSquareEl(r, c) {
    return this.dom.boardGrid.querySelector(`.square[data-row="${r}"][data-col="${c}"]`);
  }

  // DOM query helper for piece element
  getPieceEl(r, c) {
    return this.dom.piecesOverlay.querySelector(`.piece[data-row="${r}"][data-col="${c}"]`);
  }

  // === MULTIPLAYER NETWORK UTILITIES ===

  setupNetworkCallbacks() {
    network.onStatusChange = (msg, isError) => this.handleNetworkStatus(msg, isError);
    network.onPeerIdGenerated = (id) => this.handlePeerIdGenerated(id);
    network.onConnected = (role) => this.handleNetworkConnected(role);
    network.onDataReceived = (type, payload) => this.handleNetworkData(type, payload);
    network.onDisconnected = () => this.handleNetworkDisconnected();
  }

  handleNetworkStatus(msg, isError) {
    const statusClass = isError ? 'lobby-status error' : 'lobby-status';
    
    if (this.dom.hostStatus && this.dom.joinStatus) {
      this.dom.hostStatus.className = statusClass;
      this.dom.hostStatus.innerHTML = msg;
      
      this.dom.joinStatus.className = statusClass;
      this.dom.joinStatus.innerHTML = msg;
    }
  }

  handlePeerIdGenerated(id) {
    if (this.dom.localPeerId) {
      this.dom.localPeerId.innerHTML = id;
    }
  }

  copyPeerId() {
    const id = this.dom.localPeerId.innerHTML;
    if (id && id !== 'Generating ID...') {
      navigator.clipboard.writeText(id)
        .then(() => {
          this.dom.btnCopyId.innerHTML = 'Copied!';
          audio.playMove();
          setTimeout(() => {
            if (this.dom.btnCopyId) this.dom.btnCopyId.innerHTML = 'Copy';
          }, 1500);
        })
        .catch(err => {
          console.error("Clipboard copy failed:", err);
        });
    }
  }

  connectToPeer() {
    const id = this.dom.opponentPeerId.value;
    if (id && id.trim() !== '') {
      audio.init();
      network.connect(id);
    } else {
      this.handleNetworkStatus("Enter an ID first.", true);
    }
  }

  handleNetworkConnected(role) {
    audio.playPromotion();

    const myName = db.getCurrentUser() ? db.getCurrentUser().username : "Guest";
    this.opponentUsername = "Opponent"; // default
    this.scoreUpdated = false;

    if (role === 'host') {
      this.playerColor = Players.WHITE; // Host plays White (first)
      this.dom.nameWhite.innerHTML = myName;
      this.dom.nameBlack.innerHTML = this.opponentUsername;
      
      // Initialize state
      this.game = new Game(this.nfekhEnabled);
      this.selectedPiece = null;
      this.validMoves = [];
      this.huffingSelectionMode = false;
      this.animating = false;

      // Broadcast settings & username to client
      network.send('settings', { nfekhMode: this.nfekhEnabled });
      network.send('username', myName);

      // Start
      this.dom.setupScreen.classList.remove('active');
      this.dom.gameScreen.classList.add('active');
      this.dom.historyList.innerHTML = "";
      this.redrawBoard();
    } else {
      this.playerColor = Players.BLACK; // Guest plays Black (second)
      this.dom.nameWhite.innerHTML = this.opponentUsername;
      this.dom.nameBlack.innerHTML = myName;

      this.game = new Game(false); // temporary until settings arrive
      this.selectedPiece = null;
      this.validMoves = [];
      this.huffingSelectionMode = false;
      this.animating = false;

      // Send username to host
      network.send('username', myName);

      this.dom.setupScreen.classList.remove('active');
      this.dom.gameScreen.classList.add('active');
      this.dom.historyList.innerHTML = "";
      this.redrawBoard();
    }
  }

  handleNetworkData(type, payload) {
    if (type === 'username') {
      this.opponentUsername = payload;
      
      // Update UI names depending on color role
      if (this.playerColor === Players.WHITE) {
        this.dom.nameBlack.innerHTML = this.opponentUsername;
      } else {
        this.dom.nameWhite.innerHTML = this.opponentUsername;
      }
    }
    else if (type === 'settings') {
      // Guest received rule sync from host
      this.nfekhEnabled = payload.nfekhMode;
      this.game.nfekhMode = payload.nfekhMode;
      this.redrawBoard();
    } 
    else if (type === 'move') {
      // Replicate opponent's move
      this.animating = true;
      this.removeHuffableGlows();
      
      const move = payload.move;
      const start = move.path[0];
      const end = move.path[move.path.length - 1];

      const pieceEl = this.getPieceEl(start[0], start[1]);
      if (pieceEl) {
        pieceEl.dataset.row = end[0];
        pieceEl.dataset.col = end[1];
        
        const flip = (this.gameMode !== 'pvp' && this.playerColor === Players.BLACK);
        const sr = flip ? (7 - end[0]) : end[0];
        const sc = flip ? (7 - end[1]) : end[1];
        
        pieceEl.style.top = `${sr * 12.5}%`;
        pieceEl.style.left = `${sc * 12.5}%`;

        if (move.captured.length > 0) {
          move.captured.forEach(cap => {
            const capEl = this.getPieceEl(cap.r, cap.c);
            if (capEl) {
              capEl.style.transform = "scale(0)";
              capEl.style.opacity = "0";
              capEl.style.transition = "transform 0.35s ease, opacity 0.35s ease";
            }
            this.spawnParticles(cap.r, cap.c, cap.piece);
          });
        }
      }

      if (move.captured.length > 0) {
        audio.playCapture();
      } else {
        audio.playMove();
      }

      setTimeout(() => {
        const result = this.game.makeMove(move);
        if (result.promoted) {
          audio.playPromotion();
        }
        
        this.logMoveToHistory(move, result.promoted, this.playerColor === Players.WHITE);
        this.redrawBoard();
        this.animating = false;

        this.checkGameOver();
      }, 380);
    } 
    else if (type === 'huff') {
      // Replicate opponent's huff
      this.animating = true;
      const r = payload.r;
      const c = payload.c;

      audio.playNfekh();
      this.spawnParticles(r, c, this.game.board[r][c]);

      const targetEl = this.getPieceEl(r, c);
      if (targetEl) {
        targetEl.style.transform = "scale(0) rotate(180deg)";
        targetEl.style.opacity = "0";
        targetEl.style.transition = "transform 0.45s ease, opacity 0.45s ease";
      }

      setTimeout(() => {
        this.game.huffPiece(r, c);
        this.logHuffToHistory([r, c], this.playerColor === Players.WHITE);
        this.redrawBoard();
        this.animating = false;
        
        this.checkGameOver();
      }, 450);
    }
  }

  handleNetworkDisconnected() {
    this.dom.gameoverTitle.innerHTML = "Disconnected! 🔌";
    this.dom.gameoverReason.innerHTML = "Opponent disconnected or connection failed.";
    this.dom.gameoverOverlay.classList.add('active');
    audio.playLose();
    network.cleanup();

    // Disconnection win award (if match was active and not already recorded)
    if (this.gameMode === 'online' && this.game.status === 'active' && !this.scoreUpdated) {
      this.scoreUpdated = true;
      const user = db.getCurrentUser();
      if (user) {
        db.updateScore(10, false, false, false).then(() => {
          this.updateAuthUI();
          this.refreshLeaderboard();
        });
      }
    }
  }

  // === USER ACCOUNTS & LEADERBOARD UI HANDLERS ===
  switchAuthTab(tab) {
    this.activeAuthTab = tab;
    if (this.dom.authMessage) this.dom.authMessage.style.display = 'none';
    if (tab === 'login') {
      if (this.dom.btnTabLogin) this.dom.btnTabLogin.classList.add('active');
      if (this.dom.btnTabRegister) this.dom.btnTabRegister.classList.remove('active');
      if (this.dom.btnAuthSubmit) this.dom.btnAuthSubmit.innerHTML = "Log In";
    } else {
      if (this.dom.btnTabLogin) this.dom.btnTabLogin.classList.remove('active');
      if (this.dom.btnTabRegister) this.dom.btnTabRegister.classList.add('active');
      if (this.dom.btnAuthSubmit) this.dom.btnAuthSubmit.innerHTML = "Register";
    }
    audio.playMove();
  }

  async handleAuthSubmit() {
    if (!this.dom.authUsername || !this.dom.authPassword) return;

    const username = this.dom.authUsername.value.trim();
    const password = this.dom.authPassword.value;
    
    if (!username || !password) return;

    if (this.dom.btnAuthSubmit) {
      this.dom.btnAuthSubmit.disabled = true;
      this.dom.btnAuthSubmit.innerHTML = this.activeAuthTab === 'login' ? "Logging in..." : "Registering...";
    }
    if (this.dom.authMessage) this.dom.authMessage.style.display = 'none';

    let res;
    if (this.activeAuthTab === 'login') {
      res = await db.login(username, password);
    } else {
      res = await db.register(username, password);
    }

    if (this.dom.btnAuthSubmit) {
      this.dom.btnAuthSubmit.disabled = false;
      this.dom.btnAuthSubmit.innerHTML = this.activeAuthTab === 'login' ? "Log In" : "Register";
    }

    if (res.status === 'success') {
      this.dom.authUsername.value = "";
      this.dom.authPassword.value = "";
      
      if (this.activeAuthTab === 'register') {
        this.switchAuthTab('login');
        this.showAuthMessage("Registration successful! Please log in.", false);
      } else {
        audio.playPromotion();
        this.updateAuthUI();
        this.refreshLeaderboard();
      }
    } else {
      audio.playLose();
      this.showAuthMessage(res.message, true);
    }
  }

  showAuthMessage(text, isError) {
    if (!this.dom.authMessage) return;
    this.dom.authMessage.innerHTML = text;
    this.dom.authMessage.className = isError ? "auth-message error" : "auth-message success";
    this.dom.authMessage.style.display = 'block';
  }

  handlePlayAsGuest() {
    db.logout();
    audio.playMove();
    this.updateAuthUI();
  }

  handleLogout() {
    db.logout();
    audio.playMove();
    this.updateAuthUI();
    this.refreshLeaderboard();
  }

  updateAuthUI() {
    const user = db.getCurrentUser();
    const mode = db.getMode();
    
    if (this.dom.dbStatusBadge && this.dom.dbStatusText) {
      if (mode === 'vercel-blob') {
        this.dom.dbStatusBadge.className = 'db-status-badge online';
        this.dom.dbStatusText.innerHTML = 'Cloud Active';
      } else {
        this.dom.dbStatusBadge.className = 'db-status-badge offline';
        this.dom.dbStatusText.innerHTML = 'Offline (Local)';
      }
    }

    if (user) {
      if (this.dom.authView && this.dom.profileView) {
        this.dom.authView.classList.remove('active');
        this.dom.profileView.classList.add('active');
      }
      if (this.dom.profileUsername) this.dom.profileUsername.innerHTML = user.username;
      if (this.dom.statScore) this.dom.statScore.innerHTML = user.score;
      if (this.dom.statRecord) this.dom.statRecord.innerHTML = `${user.wins}W - ${user.losses}L`;
      
      const total = user.wins + user.losses + user.draws;
      const rate = total > 0 ? Math.round((user.wins / total) * 100) : 0;
      if (this.dom.statWinrate) this.dom.statWinrate.innerHTML = `${rate}%`;
    } else {
      if (this.dom.authView && this.dom.profileView) {
        this.dom.authView.classList.add('active');
        this.dom.profileView.classList.remove('active');
      }
    }
  }

  async refreshLeaderboard() {
    if (!this.dom.leaderboardList) return;
    const res = await db.getLeaderboard();
    const list = res.leaderboard || [];
    const currentUser = db.getCurrentUser();
    
    this.dom.leaderboardList.innerHTML = "";
    
    if (list.length === 0) {
      this.dom.leaderboardList.innerHTML = `<div class="leaderboard-loader">No rankings yet.</div>`;
      return;
    }
    
    list.forEach((entry, idx) => {
      const isSelf = currentUser && currentUser.username.toLowerCase() === entry.username.toLowerCase();
      const rank = idx + 1;
      
      const row = document.createElement('div');
      row.className = `leaderboard-row rank-${rank} ${isSelf ? 'current-user-row' : ''}`;
      
      row.innerHTML = `
        <div class="leaderboard-rank">${rank}</div>
        <div class="leaderboard-username">${entry.username}</div>
        <div class="leaderboard-stats">
          <div class="leaderboard-score">${entry.score}</div>
          <div class="leaderboard-record">${entry.wins}W - ${entry.losses}L</div>
        </div>
      `;
      
      this.dom.leaderboardList.appendChild(row);
    });
  }
}

export const ui = new DamaUI();
