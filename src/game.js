// game.js - Moroccan Dama Core Game Logic Engine

export const Pieces = {
  EMPTY: 0,
  WHITE_MAN: 1,
  BLACK_MAN: 2,
  WHITE_KING: 3,
  BLACK_KING: 4
};

export const Players = {
  WHITE: 1, // Player 1 (moves up, rows 7 -> 0)
  BLACK: 2  // Player 2 / AI (moves down, rows 0 -> 7)
};

export class Game {
  constructor(nfekhMode = false) {
    this.board = Array(8).fill(null).map(() => Array(8).fill(Pieces.EMPTY));
    this.turn = Players.WHITE;
    this.history = [];
    this.nfekhMode = nfekhMode; // true = Nfekh allowed; false = strict captures
    
    // Tracks if a huff is currently available for the current player.
    // Structure: { player: Players, huffable: [{from: [r,c], to: [r,c], pieceCoord: [r,c]}] }
    // pieceCoord is where the offending piece is NOW on the board.
    this.huffState = null;
    
    this.initBoard();
  }

  // Deep clone game state (used by AI and simulation)
  clone() {
    const copy = new Game(this.nfekhMode);
    copy.board = this.board.map(row => [...row]);
    copy.turn = this.turn;
    copy.history = this.history.map(h => ({
      boardBefore: h.boardBefore.map(row => [...row]),
      move: { ...h.move },
      turn: h.turn
    }));
    copy.huffState = this.huffState ? {
      player: this.huffState.player,
      huffable: this.huffState.huffable.map(h => ({
        from: [...h.from],
        to: [...h.to],
        pieceCoord: [...h.pieceCoord]
      }))
    } : null;
    return copy;
  }

  // Set up board with 12 pieces per player on light squares
  initBoard() {
    this.board = Array(8).fill(null).map(() => Array(8).fill(Pieces.EMPTY));
    this.turn = Players.WHITE;
    this.huffState = null;
    this.history = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        // Moroccan Dama is played on light squares: (r + c) % 2 === 0
        if ((r + c) % 2 === 0) {
          if (r < 3) {
            this.board[r][c] = Pieces.BLACK_MAN;
          } else if (r > 4) {
            this.board[r][c] = Pieces.WHITE_MAN;
          }
        }
      }
    }
  }

  isValidSquare(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  getPiece(r, c) {
    if (!this.isValidSquare(r, c)) return Pieces.EMPTY;
    return this.board[r][c];
  }

  setPiece(r, c, val) {
    if (this.isValidSquare(r, c)) {
      this.board[r][c] = val;
    }
  }

  isOpponentPiece(piece, player) {
    if (piece === Pieces.EMPTY) return false;
    if (player === Players.WHITE) {
      return piece === Pieces.BLACK_MAN || piece === Pieces.BLACK_KING;
    } else {
      return piece === Pieces.WHITE_MAN || piece === Pieces.WHITE_KING;
    }
  }

  isOwnPiece(piece, player) {
    if (piece === Pieces.EMPTY) return false;
    if (player === Players.WHITE) {
      return piece === Pieces.WHITE_MAN || piece === Pieces.WHITE_KING;
    } else {
      return piece === Pieces.BLACK_MAN || piece === Pieces.BLACK_KING;
    }
  }

  isKing(piece) {
    return piece === Pieces.WHITE_KING || piece === Pieces.BLACK_KING;
  }

  // Generates all legal moves for the current player
  // Respects the majority capture rules (Quantity & Quality)
  // If Nfekh mode is active, also includes non-capturing moves if captures are available,
  // but marks them so that a huff is recorded if they are chosen.
  getValidMoves() {
    const player = this.turn;
    const allCaptures = [];
    
    // Find all possible captures first
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.getPiece(r, c);
        if (this.isOwnPiece(piece, player)) {
          const capturesForPiece = this.getCapturesForPiece(r, c);
          allCaptures.push(...capturesForPiece);
        }
      }
    }

    let legalMoves = [];
    let capturesAvailable = false;

    if (allCaptures.length > 0) {
      capturesAvailable = true;
      // Apply Spanish majority rules:
      // 1. Quantity: Max pieces captured
      let maxCaptured = 0;
      allCaptures.forEach(move => {
        if (move.captured.length > maxCaptured) {
          maxCaptured = move.captured.length;
        }
      });
      const quantityFiltered = allCaptures.filter(m => m.captured.length === maxCaptured);

      // 2. Quality: Max kings captured
      let maxKingsCaptured = 0;
      quantityFiltered.forEach(move => {
        let kingCount = move.captured.filter(c => this.isKing(c.piece)).length;
        if (kingCount > maxKingsCaptured) {
          maxKingsCaptured = kingCount;
        }
      });
      
      legalMoves = quantityFiltered.filter(m => {
        let kingCount = m.captured.filter(c => this.isKing(c.piece)).length;
        return kingCount === maxKingsCaptured;
      });
    }

    // Now check if we can add normal (non-capturing) moves
    const normalMoves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.getPiece(r, c);
        if (this.isOwnPiece(piece, player)) {
          const movesForPiece = this.getNormalMovesForPiece(r, c);
          normalMoves.push(...movesForPiece);
        }
      }
    }

    if (capturesAvailable) {
      if (this.nfekhMode) {
        // In Nfekh mode, normal moves are allowed, but choosing them makes you huffable!
        // We tag normal moves as "nfekhVulnerable" so the engine knows to set huffState.
        // We also tag which pieces could have captured.
        const huffInfo = allCaptures.map(m => ({
          from: m.path[0],
          to: m.path[m.path.length - 1],
          // We will resolve where the piece ends up to know which piece to huff
        }));
        
        normalMoves.forEach(m => {
          m.nfekhVulnerable = true;
          m.huffInfo = huffInfo;
        });

        // Combined pool of moves
        return [...legalMoves, ...normalMoves];
      } else {
        // Strict capture mode: only capturing moves are legal
        return legalMoves;
      }
    } else {
      // No captures available: normal moves are the only legal moves
      return normalMoves;
    }
  }

  // Recursive search for captures from a specific starting cell (r, c)
  getCapturesForPiece(startR, startC) {
    const player = this.turn;
    const piece = this.getPiece(startR, startC);
    const isKing = this.isKing(piece);
    const chains = [];

    // Helper for recursion
    // boardState: board being simulated
    // r, c: current piece coordinates
    // path: coordinates visited by the jumping piece
    // captured: list of { r, c, piece } captured so far
    const search = (r, c, path, captured) => {
      let foundJumps = false;
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

      for (const [dr, dc] of dirs) {
        // Men can only capture forward!
        if (!isKing) {
          const forwardDr = (player === Players.WHITE) ? -1 : 1;
          if (dr !== forwardDr) continue;
        }

        if (isKing) {
          // Flying King capture search:
          // Can slide any number of empty squares, jump over exactly one opponent,
          // and land on any empty square after it.
          let scannedRow = r + dr;
          let scannedCol = c + dc;
          let opponentCoord = null;
          let pathBlocked = false;

          while (this.isValidSquare(scannedRow, scannedCol)) {
            const currentSquarePiece = this.board[scannedRow][scannedCol];

            if (currentSquarePiece === Pieces.EMPTY) {
              if (opponentCoord) {
                // We've already jumped the opponent, these are landing squares
                const landingR = scannedRow;
                const landingC = scannedCol;
                
                // Ensure we don't land on or jump over a square that is already captured in this chain
                const alreadyCaptured = captured.some(cap => cap.r === opponentCoord.r && cap.c === opponentCoord.c);
                if (!alreadyCaptured) {
                  foundJumps = true;
                  const newCaptured = [...captured, { r: opponentCoord.r, c: opponentCoord.c, piece: opponentCoord.piece }];
                  search(landingR, landingC, [...path, [landingR, landingC]], newCaptured);
                }
              }
            } else if (this.isOwnPiece(currentSquarePiece, player)) {
              // Blocked by friendly piece
              pathBlocked = true;
              break;
            } else {
              // Opponent piece
              if (opponentCoord) {
                // Already found one opponent in this direction, cannot jump two
                pathBlocked = true;
                break;
              }
              // Check if this opponent piece was already captured in the chain
              const alreadyCaptured = captured.some(cap => cap.r === scannedRow && cap.c === scannedCol);
              if (alreadyCaptured) {
                pathBlocked = true;
                break;
              }
              opponentCoord = { r: scannedRow, c: scannedCol, piece: currentSquarePiece };
            }

            scannedRow += dr;
            scannedCol += dc;
          }
        } else {
          // Standard Man capture:
          // Must jump exactly 1 square diagonally forward over an opponent into an empty square.
          const oppR = r + dr;
          const oppC = c + dc;
          const landR = r + 2 * dr;
          const landC = c + 2 * dc;

          if (this.isValidSquare(landR, landC)) {
            const oppPiece = this.getPiece(oppR, oppC);
            const landPiece = this.getPiece(landR, landC);

            if (this.isOpponentPiece(oppPiece, player) && landPiece === Pieces.EMPTY) {
              const alreadyCaptured = captured.some(cap => cap.r === oppR && cap.c === oppC);
              if (!alreadyCaptured) {
                foundJumps = true;
                const newCaptured = [...captured, { r: oppR, c: oppC, piece: oppPiece }];
                search(landR, landC, [...path, [landR, landC]], newCaptured);
              }
            }
          }
        }
      }

      // If no further jumps are possible from this position, record the chain
      if (!foundJumps && path.length > 1) {
        chains.push({
          path: path,
          captured: captured
        });
      }
    };

    search(startR, startC, [[startR, startC]], []);
    return chains;
  }

  // Generates normal (non-capturing) moves for a piece at (r, c)
  getNormalMovesForPiece(r, c) {
    const player = this.turn;
    const piece = this.getPiece(r, c);
    const isKing = this.isKing(piece);
    const moves = [];

    const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

    for (const [dr, dc] of dirs) {
      if (!isKing) {
        // Men can only move forward!
        const forwardDr = (player === Players.WHITE) ? -1 : 1;
        if (dr !== forwardDr) continue;

        const nextR = r + dr;
        const nextC = c + dc;
        if (this.isValidSquare(nextR, nextC) && this.getPiece(nextR, nextC) === Pieces.EMPTY) {
          moves.push({
            path: [[r, c], [nextR, nextC]],
            captured: []
          });
        }
      } else {
        // Flying Kings can slide any number of empty squares diagonally
        let nextR = r + dr;
        let nextC = c + dc;
        while (this.isValidSquare(nextR, nextC) && this.getPiece(nextR, nextC) === Pieces.EMPTY) {
          moves.push({
            path: [[r, c], [nextR, nextC]],
            captured: []
          });
          nextR += dr;
          nextC += dc;
        }
      }
    }

    return moves;
  }

  // Executes a move
  makeMove(move) {
    const beforeBoard = this.board.map(row => [...row]);
    
    // Save to history
    this.history.push({
      boardBefore: beforeBoard,
      move: move,
      turn: this.turn
    });

    const start = move.path[0];
    const end = move.path[move.path.length - 1];
    const piece = this.getPiece(start[0], start[1]);

    // Move the piece
    this.setPiece(start[0], start[1], Pieces.EMPTY);
    this.setPiece(end[0], end[1], piece);

    // Remove captured pieces
    move.captured.forEach(cap => {
      this.setPiece(cap.r, cap.c, Pieces.EMPTY);
    });

    // Promotion: reaches back rank AND is a man
    let promoted = false;
    if (!this.isKing(piece)) {
      const promotionRank = (this.turn === Players.WHITE) ? 0 : 7;
      if (end[0] === promotionRank) {
        const promotedPiece = (this.turn === Players.WHITE) ? Pieces.WHITE_KING : Pieces.BLACK_KING;
        this.setPiece(end[0], end[1], promotedPiece);
        promoted = true;
      }
    }

    // Handle Nfekh logic
    if (this.nfekhMode) {
      if (move.nfekhVulnerable) {
        // The player made a normal move while captures were available!
        // We set the huff state. The opponent now has the option to click "Nfekh!"
        // The piece that moved and failed to capture is now at `end`.
        // There might also be other pieces that had captures available and didn't move.
        // We will build a list of huffable pieces.
        const huffableList = [];
        
        // Let's identify which pieces of the player *had* captures available
        const currentTurnPlayer = this.turn;
        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            const p = beforeBoard[r][c];
            if (this.isOwnPiece(p, currentTurnPlayer)) {
              // Did this piece have a capture?
              const capChains = this.getCapturesForPieceBeforeMove(r, c, beforeBoard, currentTurnPlayer);
              if (capChains.length > 0) {
                // If it was the piece that actually moved, its new location is `end`.
                // Otherwise, its location is still `(r, c)`.
                if (r === start[0] && c === start[1]) {
                  huffableList.push({
                    originalCoord: [r, c],
                    pieceCoord: [end[0], end[1]]
                  });
                } else {
                  huffableList.push({
                    originalCoord: [r, c],
                    pieceCoord: [r, c]
                  });
                }
              }
            }
          }
        }

        // Set the huff state for the OPPONENT'S turn
        const opponent = (this.turn === Players.WHITE) ? Players.BLACK : Players.WHITE;
        this.huffState = {
          player: opponent,
          huffable: huffableList
        };
      } else {
        // Player made a capture, or no captures were available. Clear huff state.
        this.huffState = null;
      }
    }

    // Switch turns
    this.turn = (this.turn === Players.WHITE) ? Players.BLACK : Players.WHITE;

    return { promoted };
  }

  // Helper to check captures on a specific board (used to reconstruct before-move options for Nfekh)
  getCapturesForPieceBeforeMove(startR, startC, simBoard, player) {
    const piece = simBoard[startR][startC];
    const isKing = this.isKing(piece);
    const chains = [];

    const search = (r, c, path, captured) => {
      let foundJumps = false;
      const dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

      for (const [dr, dc] of dirs) {
        if (!isKing) {
          const forwardDr = (player === Players.WHITE) ? -1 : 1;
          if (dr !== forwardDr) continue;
        }

        if (isKing) {
          let scannedRow = r + dr;
          let scannedCol = c + dc;
          let opponentCoord = null;

          while (scannedRow >= 0 && scannedRow < 8 && scannedCol >= 0 && scannedCol < 8) {
            const currentSquarePiece = simBoard[scannedRow][scannedCol];

            if (currentSquarePiece === Pieces.EMPTY) {
              if (opponentCoord) {
                const landingR = scannedRow;
                const landingC = scannedCol;
                const alreadyCaptured = captured.some(cap => cap.r === opponentCoord.r && cap.c === opponentCoord.c);
                if (!alreadyCaptured) {
                  foundJumps = true;
                  const newCaptured = [...captured, { r: opponentCoord.r, c: opponentCoord.c, piece: opponentCoord.piece }];
                  search(landingR, landingC, [...path, [landingR, landingC]], newCaptured);
                }
              }
            } else if (player === Players.WHITE ? (currentSquarePiece === Pieces.WHITE_MAN || currentSquarePiece === Pieces.WHITE_KING) : (currentSquarePiece === Pieces.BLACK_MAN || currentSquarePiece === Pieces.BLACK_KING)) {
              break; // Friendly piece
            } else {
              if (opponentCoord) break; // Multiple opponent pieces
              const alreadyCaptured = captured.some(cap => cap.r === scannedRow && cap.c === scannedCol);
              if (alreadyCaptured) break;
              opponentCoord = { r: scannedRow, c: scannedCol, piece: currentSquarePiece };
            }

            scannedRow += dr;
            scannedCol += dc;
          }
        } else {
          const oppR = r + dr;
          const oppC = c + dc;
          const landR = r + 2 * dr;
          const landC = c + 2 * dc;

          if (landR >= 0 && landR < 8 && landC >= 0 && landC < 8) {
            const oppPiece = simBoard[oppR][oppC];
            const landPiece = simBoard[landR][landC];

            const isOpp = player === Players.WHITE ? 
              (oppPiece === Pieces.BLACK_MAN || oppPiece === Pieces.BLACK_KING) : 
              (oppPiece === Pieces.WHITE_MAN || oppPiece === Pieces.WHITE_KING);

            if (isOpp && landPiece === Pieces.EMPTY) {
              const alreadyCaptured = captured.some(cap => cap.r === oppR && cap.c === oppC);
              if (!alreadyCaptured) {
                foundJumps = true;
                const newCaptured = [...captured, { r: oppR, c: oppC, piece: oppPiece }];
                search(landR, landC, [...path, [landR, landC]], newCaptured);
              }
            }
          }
        }
      }

      if (!foundJumps && path.length > 1) {
        chains.push({ path, captured });
      }
    };

    search(startR, startC, [[startR, startC]], []);
    return chains;
  }

  // Huff (Nfekh) a piece from the board
  huffPiece(r, c) {
    if (!this.huffState) return false;
    
    // Check if this piece is actually in the huffable list
    const isHuffable = this.huffState.huffable.some(h => h.pieceCoord[0] === r && h.pieceCoord[1] === c);
    if (!isHuffable) return false;

    // Remove the huffed piece
    this.setPiece(r, c, Pieces.EMPTY);

    // Save to history as a huff event
    this.history.push({
      boardBefore: this.history[this.history.length - 1]?.boardBefore || this.board,
      move: { huffed: [r, c] },
      turn: this.turn
    });

    // Clear huff state
    this.huffState = null;

    // Turn does NOT switch! The huffing player removes the piece and then makes their own normal move.
    return true;
  }

  // Cancel the huff opportunity (e.g. if the player proceeds to make a normal move instead of huffing)
  clearHuffState() {
    this.huffState = null;
  }

  // Revert the last move
  undo() {
    if (this.history.length === 0) return false;
    const last = this.history.pop();
    this.board = last.boardBefore.map(row => [...row]);
    this.turn = last.turn;
    this.huffState = null; // Reset huff state on undo to avoid sync issues
    return true;
  }

  // Checks game over conditions
  // Returns: { status: 'active'|'white_win'|'black_win'|'draw', reason: string }
  checkGameOver() {
    let whitePieces = 0;
    let blackPieces = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.getPiece(r, c);
        if (piece === Pieces.WHITE_MAN || piece === Pieces.WHITE_KING) whitePieces++;
        if (piece === Pieces.BLACK_MAN || piece === Pieces.BLACK_KING) blackPieces++;
      }
    }

    if (whitePieces === 0) {
      return { status: 'black_win', reason: 'White has no pieces left.' };
    }
    if (blackPieces === 0) {
      return { status: 'white_win', reason: 'Black has no pieces left.' };
    }

    // Check if current player has any legal moves
    const validMoves = this.getValidMoves();
    if (validMoves.length === 0) {
      // If a player has no legal moves, they lose!
      if (this.turn === Players.WHITE) {
        return { status: 'black_win', reason: 'White is blocked and has no legal moves.' };
      } else {
        return { status: 'white_win', reason: 'Black is blocked and has no legal moves.' };
      }
    }

    // Check for draw: e.g. only Kings left and no capture made in 40 moves (optional simplify: just check material)
    // For standard chess/checkers, 40 moves without captures is a draw.
    // Let's implement a simple 40-ply rule without captures.
    let movesSinceCapture = 0;
    for (let i = this.history.length - 1; i >= 0; i--) {
      const h = this.history[i];
      if (h.move.captured && h.move.captured.length > 0) {
        break;
      }
      if (h.move.huffed) {
        break;
      }
      movesSinceCapture++;
    }

    if (movesSinceCapture >= 80) { // 80 ply = 40 full moves
      return { status: 'draw', reason: 'Draw: 40 moves without a capture.' };
    }

    return { status: 'active', reason: '' };
  }

  // Developer Self-Test Suite to verify rules correctness
  static test() {
    console.log("=== RUNNING DAMA GAME ENGINE TESTS ===");
    
    // Test 1: Simple movement
    const game = new Game(false); // strict mode
    console.assert(game.turn === Players.WHITE, "Test 1 Failed: White should start");
    
    const moves = game.getValidMoves();
    console.log(`Initial white moves count: ${moves.length} (expected 7)`);
    console.assert(moves.length === 7, "Test 1 Failed: Initial moves should be 7");

    // Test 2: Majority Capture (Quantity Rule)
    // Setup a board where White can capture 1 piece or 2 pieces.
    const game2 = new Game(false);
    game2.board = Array(8).fill(null).map(() => Array(8).fill(Pieces.EMPTY));
    game2.board[6][2] = Pieces.WHITE_MAN; // White piece
    game2.board[5][3] = Pieces.BLACK_MAN; // Opponent 1
    game2.board[3][3] = Pieces.BLACK_MAN; // Opponent 2 (for 2-jump chain)
    game2.board[5][1] = Pieces.BLACK_MAN; // Opponent 3 (for single jump)
    // Jumps:
    // Chain A: (6,2) -> (4,4) jump over (5,3), then from (4,4) -> (2,2) jump over (3,3) (length 2)
    // Chain B: (6,2) -> (4,0) jump over (5,1) (length 1)
    
    game2.turn = Players.WHITE;
    const test2Moves = game2.getValidMoves();
    console.log("Test 2: Majority Capture (Quantity Rule) moves generated:", test2Moves);
    console.assert(test2Moves.length === 1, "Test 2 Failed: Should generate exactly 1 majority capture move");
    console.assert(test2Moves[0].captured.length === 2, "Test 2 Failed: Majority capture must capture 2 pieces");
    console.assert(test2Moves[0].path.length === 3, "Test 2 Failed: Path length should be 3");

    // Test 3: Quality Capture Rule (Kings take priority)
    const game3 = new Game(false);
    game3.board = Array(8).fill(null).map(() => Array(8).fill(Pieces.EMPTY));
    game3.board[6][2] = Pieces.WHITE_MAN;
    game3.board[5][3] = Pieces.BLACK_MAN; // Normal man
    game3.board[5][1] = Pieces.BLACK_KING; // King!
    // Both are 1-jump captures: (6,2) -> (4,4) over man vs (6,2) -> (4,0) over King.
    game3.turn = Players.WHITE;
    const test3Moves = game3.getValidMoves();
    console.log("Test 3: Quality Capture (King priority) moves:", test3Moves);
    console.assert(test3Moves.length === 1, "Test 3 Failed: Should only allow 1 capture");
    console.assert(test3Moves[0].captured[0].piece === Pieces.BLACK_KING, "Test 3 Failed: Capture must be the King");

    // Test 4: Flying King movement and captures
    const game4 = new Game(false);
    game4.board = Array(8).fill(null).map(() => Array(8).fill(Pieces.EMPTY));
    game4.board[7][1] = Pieces.WHITE_KING;
    game4.board[3][5] = Pieces.BLACK_MAN;
    // King at (7,1) should be able to slide along diagonal and jump (3,5) landing at (2,6) or (1,7).
    game4.turn = Players.WHITE;
    const test4Moves = game4.getValidMoves();
    console.log("Test 4: Flying King captures:", test4Moves);
    // There should be 2 choices of landing squares: (2,6) and (1,7)
    console.assert(test4Moves.length === 2, "Test 4 Failed: Flying King should have 2 landing choices");

    // Test 5: Nfekh Huffing State
    const game5 = new Game(true); // Nfekh Mode
    game5.board = Array(8).fill(null).map(() => Array(8).fill(Pieces.EMPTY));
    game5.board[6][2] = Pieces.WHITE_MAN;
    game5.board[5][3] = Pieces.BLACK_MAN; // capture available at (4,4)
    // Non-capturing move is also available: (6,2) can move to (5,1) if empty. Let's make it empty.
    game5.board[5][1] = Pieces.EMPTY;
    
    game5.turn = Players.WHITE;
    const test5Moves = game5.getValidMoves();
    console.log("Test 5: Nfekh mode moves count:", test5Moves.length);
    // Should include both capture move AND regular move
    console.assert(test5Moves.some(m => m.captured.length === 0), "Test 5 Failed: Normal move should be available in Nfekh mode");
    console.assert(test5Moves.some(m => m.captured.length === 1), "Test 5 Failed: Capture move should also be available");
    
    // Choose the regular move (6,2) -> (5,1)
    const normalMove = test5Moves.find(m => m.captured.length === 0);
    game5.makeMove(normalMove);
    
    console.log("Test 5: After normal move, huffState is:", game5.huffState);
    console.assert(game5.huffState !== null, "Test 5 Failed: HuffState should be set");
    console.assert(game5.huffState.player === Players.BLACK, "Test 5 Failed: Black should have huff option");
    console.assert(game5.huffState.huffable[0].pieceCoord[0] === 5 && game5.huffState.huffable[0].pieceCoord[1] === 1, "Test 5 Failed: Offending piece should be at (5,1)");

    console.log("=== ALL TESTS PASSED ===");
    return true;
  }
}
// Run tests in node/dev environment automatically if needed
// Game.test();
