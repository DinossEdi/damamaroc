// ai.js - Moroccan Dama AI Opponent Engine

import { Pieces, Players, Game } from './game.js';

export class DamaAI {
  constructor(difficulty = 'medium') {
    this.difficulty = difficulty; // 'easy', 'medium', 'hard'
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  // Decides whether to perform a Huff (Nfekh) or make a regular move.
  // Returns: { type: 'huff', r, c } OR { type: 'move', move }
  getBestAction(game) {
    const player = game.turn;

    // 1. Check if a huff (Nfekh) is available for the AI
    if (game.huffState && game.huffState.player === player && game.huffState.huffable.length > 0) {
      let shouldHuff = false;
      const roll = Math.random();

      if (this.difficulty === 'easy' && roll < 0.3) {
        shouldHuff = true;
      } else if (this.difficulty === 'medium' && roll < 0.7) {
        shouldHuff = true;
      } else if (this.difficulty === 'hard') {
        shouldHuff = true;
      }

      if (shouldHuff) {
        // AI chooses one of the huffable pieces to remove (e.g., the first one)
        const target = game.huffState.huffable[0].pieceCoord;
        return {
          type: 'huff',
          r: target[0],
          c: target[1]
        };
      } else {
        // AI ignores the huff opportunity. We must clear it to make a normal move.
        game.clearHuffState();
      }
    }

    // 2. Generate and select best normal move
    const moves = game.getValidMoves();
    if (moves.length === 0) return null; // No moves available (handled by game over check)

    // Easy mode: 35% chance to pick a random move, else search depth 1
    if (this.difficulty === 'easy') {
      if (Math.random() < 0.35) {
        const randomMove = moves[Math.floor(Math.random() * moves.length)];
        return { type: 'move', move: randomMove };
      }
      return { type: 'move', move: this.searchBestMove(game, 1) };
    }

    // Medium mode: search depth 3
    if (this.difficulty === 'medium') {
      return { type: 'move', move: this.searchBestMove(game, 3) };
    }

    // Hard mode: search depth 5
    if (this.difficulty === 'hard') {
      return { type: 'move', move: this.searchBestMove(game, 5) };
    }

    // Fallback
    return { type: 'move', move: moves[0] };
  }

  // Uses Minimax with Alpha-Beta pruning to find the best move
  searchBestMove(game, depth) {
    const moves = game.getValidMoves();
    if (moves.length === 0) return null;
    if (moves.length === 1) return moves[0];

    const player = game.turn;
    let bestMove = null;
    let bestValue = (player === Players.WHITE) ? -Infinity : Infinity;

    // Sort moves to improve pruning: captures first, then others
    const sortedMoves = this.sortMoves(moves);

    for (const move of sortedMoves) {
      const simulatedGame = game.clone();
      simulatedGame.makeMove(move);

      // Evaluate the resulting state
      const val = this.minimax(simulatedGame, depth - 1, -Infinity, Infinity, player === Players.BLACK);

      if (player === Players.WHITE) {
        if (val > bestValue) {
          bestValue = val;
          bestMove = move;
        }
      } else {
        if (val < bestValue) {
          bestValue = val;
          bestMove = move;
        }
      }
    }

    return bestMove || moves[0];
  }

  // Minimax search with Alpha-Beta pruning
  minimax(game, depth, alpha, beta, isMaximizing) {
    const gameOver = game.checkGameOver();
    if (gameOver.status !== 'active') {
      if (gameOver.status === 'draw') return 0;
      // If White wins, value is +10000; if Black wins, value is -10000
      return gameOver.status === 'white_win' ? 10000 : -10000;
    }

    if (depth === 0) {
      return this.evaluateBoard(game.board);
    }

    const moves = game.getValidMoves();
    if (moves.length === 0) {
      // Current player is blocked and loses
      return isMaximizing ? -10000 : 10000;
    }

    const sortedMoves = this.sortMoves(moves);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of sortedMoves) {
        const simulatedGame = game.clone();
        simulatedGame.makeMove(move);
        const evaluation = this.minimax(simulatedGame, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break; // Beta cut-off
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of sortedMoves) {
        const simulatedGame = game.clone();
        simulatedGame.makeMove(move);
        const evaluation = this.minimax(simulatedGame, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break; // Alpha cut-off
      }
      return minEval;
    }
  }

  // Prioritize captures and promotions for pruning efficiency
  sortMoves(moves) {
    return [...moves].sort((a, b) => {
      // 1. Capture priority
      const aCaps = a.captured ? a.captured.length : 0;
      const bCaps = b.captured ? b.captured.length : 0;
      if (aCaps !== bCaps) {
        return bCaps - aCaps; // Descending
      }

      // 2. Promotion priority (move ends on rank 0 for White or 7 for Black)
      const aPromotes = a.path[a.path.length - 1][0] === 0 || a.path[a.path.length - 1][0] === 7;
      const bPromotes = b.path[b.path.length - 1][0] === 0 || b.path[b.path.length - 1][0] === 7;
      if (aPromotes && !bPromotes) return -1;
      if (!aPromotes && bPromotes) return 1;

      return 0;
    });
  }

  // Heuristic evaluation of the board
  // Returns positive scores for White advantage, negative for Black advantage
  evaluateBoard(board) {
    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];

        if (piece === Pieces.EMPTY) continue;

        let pieceVal = 0;
        let posVal = 0;

        if (piece === Pieces.WHITE_MAN) {
          pieceVal = 100;
          // Advancement bonus: closer to row 0 is better
          posVal = (7 - r) * 5;
          // Center control bonus
          posVal += (4 - Math.abs(c - 3.5)) * 4;
          // Back row defense bonus
          if (r === 7) posVal += 10;
          
          score += (pieceVal + posVal);
        } 
        else if (piece === Pieces.WHITE_KING) {
          pieceVal = 300;
          // Kings benefit from center board freedom
          posVal = (4 - Math.abs(r - 3.5)) * 5 + (4 - Math.abs(c - 3.5)) * 5;
          
          score += (pieceVal + posVal);
        } 
        else if (piece === Pieces.BLACK_MAN) {
          pieceVal = -100;
          // Advancement bonus: closer to row 7 is better
          posVal = r * 5;
          // Center control bonus
          posVal += (4 - Math.abs(c - 3.5)) * 4;
          // Back row defense bonus
          if (r === 0) posVal += 10;
          
          score -= (pieceVal + posVal); // subtract because it is Black
        } 
        else if (piece === Pieces.BLACK_KING) {
          pieceVal = -300;
          posVal = (4 - Math.abs(r - 3.5)) * 5 + (4 - Math.abs(c - 3.5)) * 5;
          
          score -= (pieceVal + posVal); // subtract because it is Black
        }
      }
    }

    return score;
  }
}
