import { put, list } from '@vercel/blob';
import crypto from 'crypto';

const SALT = "damamaroc_secure_salt_2026!";
const DB_FILENAME = "damamaroc-db.json";

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

// Initial mock database to populate the leaderboard immediately on startup
const MOCK_USERS = {
  youssef: {
    username: "Youssef",
    passwordHash: hashPassword("12345"),
    score: 240,
    wins: 15,
    losses: 4,
    draws: 1,
    gamesPlayed: 20
  },
  fatima: {
    username: "Fatima",
    passwordHash: hashPassword("12345"),
    score: 185,
    wins: 11,
    losses: 3,
    draws: 2,
    gamesPlayed: 16
  },
  karim: {
    username: "Karim",
    passwordHash: hashPassword("12345"),
    score: 150,
    wins: 8,
    losses: 2,
    draws: 0,
    gamesPlayed: 10
  },
  amine: {
    username: "Amine",
    passwordHash: hashPassword("12345"),
    score: 120,
    wins: 6,
    losses: 4,
    draws: 1,
    gamesPlayed: 11
  }
};

// Helper to fetch the db from Vercel Blob
async function loadDatabase() {
  try {
    const { blobs } = await list();
    const dbBlob = blobs.find(b => b.pathname === DB_FILENAME);
    if (!dbBlob) {
      // Initialize if not exists
      await saveDatabase(MOCK_USERS);
      return MOCK_USERS;
    }
    const response = await fetch(dbBlob.url);
    const users = await response.json();
    return users;
  } catch (err) {
    console.error("Error loading database:", err);
    return MOCK_USERS; // fallback to mock if error
  }
}

// Helper to save db to Vercel Blob
async function saveDatabase(users) {
  const dataStr = JSON.stringify(users, null, 2);
  await put(DB_FILENAME, dataStr, {
    access: 'public',
    addRandomSuffix: false
  });
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // If no environment variable is found, signal fallback to LocalStorage
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(200).json({
      status: 'fallback',
      message: 'BLOB_READ_WRITE_TOKEN is missing.'
    });
  }

  try {
    const db = await loadDatabase();

    if (req.method === 'GET') {
      // Return sorted leaderboard for public consumption
      const leaderboard = Object.values(db)
        .sort((a, b) => b.score - a.score || b.wins - a.wins)
        .map(u => ({
          username: u.username,
          score: u.score,
          wins: u.wins,
          losses: u.losses,
          draws: u.draws,
          gamesPlayed: u.gamesPlayed
        }))
        .slice(0, 10);

      return res.status(200).json({ status: 'success', leaderboard });
    }

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch(e) {
          return res.status(400).json({ status: 'error', message: 'Invalid JSON body' });
        }
      }

      const { action } = body;

      if (action === 'register') {
        const { username, password } = body;
        if (!username || !password) {
          return res.status(400).json({ status: 'error', message: 'Username and password are required.' });
        }
        const cleanUsername = username.trim();
        if (cleanUsername.length < 3) {
          return res.status(400).json({ status: 'error', message: 'Username must be at least 3 characters.' });
        }
        if (password.length < 4) {
          return res.status(400).json({ status: 'error', message: 'Password must be at least 4 characters.' });
        }

        const key = cleanUsername.toLowerCase();
        if (db[key]) {
          return res.status(200).json({ status: 'error', message: 'Username is already taken.' });
        }

        const passwordHash = hashPassword(password);
        db[key] = {
          username: cleanUsername,
          passwordHash,
          score: 100, // starting score
          wins: 0,
          losses: 0,
          draws: 0,
          gamesPlayed: 0
        };

        await saveDatabase(db);
        const userClean = { ...db[key] };
        delete userClean.passwordHash;

        return res.status(200).json({ status: 'success', user: userClean });
      }

      if (action === 'login') {
        const { username, password } = body;
        if (!username || !password) {
          return res.status(400).json({ status: 'error', message: 'Username and password are required.' });
        }
        const key = username.trim().toLowerCase();
        const user = db[key];

        if (!user) {
          return res.status(200).json({ status: 'error', message: 'User not found.' });
        }

        const passwordHash = hashPassword(password);
        if (user.passwordHash !== passwordHash) {
          return res.status(200).json({ status: 'error', message: 'Incorrect password.' });
        }

        const userClean = { ...user };
        delete userClean.passwordHash;

        return res.status(200).json({ status: 'success', user: userClean });
      }

      if (action === 'updateScore') {
        const { username, points, isWin, isLoss, isDraw } = body;
        if (!username) {
          return res.status(400).json({ status: 'error', message: 'Username is required.' });
        }
        const key = username.trim().toLowerCase();
        const user = db[key];

        if (!user) {
          return res.status(200).json({ status: 'error', message: 'User not found.' });
        }

        user.score = Math.max(0, user.score + points);
        user.gamesPlayed += 1;
        if (isWin) user.wins += 1;
        if (isLoss) user.losses += 1;
        if (isDraw) user.draws += 1;

        await saveDatabase(db);
        const userClean = { ...user };
        delete userClean.passwordHash;

        return res.status(200).json({ status: 'success', user: userClean });
      }

      return res.status(400).json({ status: 'error', message: `Unknown action: ${action}` });
    }

    return res.status(405).json({ status: 'error', message: 'Method Not Allowed' });
  } catch (err) {
    console.error("Serverless handler error:", err);
    return res.status(500).json({ status: 'error', message: err.message });
  }
}
