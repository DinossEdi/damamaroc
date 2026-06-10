// db.js - Client-Side database client with Vercel Blob API and LocalStorage fallback

class DamaDBClient {
  constructor() {
    this.USERS_KEY = 'dama_morocco_users';
    this.CURRENT_USER_KEY = 'dama_morocco_current_user';
    this.mode = 'offline-local'; // default until initialized
    this.initialized = false;
    this.currentUser = null;

    // Default mock data to seed if local database is empty
    this.MOCK_USERS = {
      youssef: {
        username: "Youssef",
        score: 240,
        wins: 15,
        losses: 4,
        draws: 1,
        gamesPlayed: 20
      },
      fatima: {
        username: "Fatima",
        score: 185,
        wins: 11,
        losses: 3,
        draws: 2,
        gamesPlayed: 16
      },
      karim: {
        username: "Karim",
        score: 150,
        wins: 8,
        losses: 2,
        draws: 0,
        gamesPlayed: 10
      },
      amine: {
        username: "Amine",
        score: 120,
        wins: 6,
        losses: 4,
        draws: 1,
        gamesPlayed: 11
      }
    };
  }

  // Detect which mode to run in
  async init() {
    if (this.initialized) return;

    try {
      const response = await fetch('/api/db');
      const data = await response.json();
      if (data && data.status === 'fallback') {
        this.mode = 'offline-local';
        console.log("DamaDB: Vercel Blob not linked. Running in Offline LocalStorage mode.");
      } else {
        this.mode = 'vercel-blob';
        console.log("DamaDB: Running in Cloud Vercel Blob mode.");
      }
    } catch (e) {
      this.mode = 'offline-local';
      console.log("DamaDB: /api/db endpoint not found. Running in Offline LocalStorage mode.");
    }

    // Seed local database if empty and we are in offline mode
    if (this.mode === 'offline-local') {
      const localUsers = localStorage.getItem(this.USERS_KEY);
      if (!localUsers) {
        // Hash mock passwords locally on first run
        const seeded = {};
        for (const [key, val] of Object.entries(this.MOCK_USERS)) {
          const hash = await this.hashPasswordLocal("12345");
          seeded[key] = {
            ...val,
            passwordHash: hash
          };
        }
        localStorage.setItem(this.USERS_KEY, JSON.stringify(seeded));
      }
    }

    // Load active session
    this.loadSession();
    this.initialized = true;
  }

  // SHA-256 Hashing helper using Browser standard Web Crypto API (used for LocalStorage mode)
  async hashPasswordLocal(password) {
    const msgUint8 = new TextEncoder().encode(password + "damamaroc_secure_salt_2026!");
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  loadSession() {
    const session = localStorage.getItem(this.CURRENT_USER_KEY);
    if (!session) {
      this.currentUser = null;
      return;
    }

    if (this.mode === 'offline-local') {
      const users = this.getLocalUsers();
      this.currentUser = users[session.toLowerCase()] || null;
    } else {
      // In cloud mode, load the cached user profile from localStorage session
      // (will verify with server on score updates)
      try {
        this.currentUser = JSON.parse(session);
      } catch (e) {
        this.currentUser = null;
        localStorage.removeItem(this.CURRENT_USER_KEY);
      }
    }
  }

  // === LOCAL STORAGE HELPERS ===
  getLocalUsers() {
    const data = localStorage.getItem(this.USERS_KEY);
    return data ? JSON.parse(data) : {};
  }

  saveLocalUsers(users) {
    localStorage.setItem(this.USERS_KEY, JSON.stringify(users));
  }

  // === EXPOSED INTERFACE ===

  getCurrentUser() {
    return this.currentUser;
  }

  getMode() {
    return this.mode;
  }

  async register(username, password) {
    const cleanUsername = username.trim();
    if (this.mode === 'offline-local') {
      const key = cleanUsername.toLowerCase();
      const users = this.getLocalUsers();
      if (users[key]) {
        return { status: 'error', message: 'Username is already taken.' };
      }

      const passwordHash = await this.hashPasswordLocal(password);
      const newUser = {
        username: cleanUsername,
        passwordHash,
        score: 100,
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0
      };

      users[key] = newUser;
      this.saveLocalUsers(users);

      const userClean = { ...newUser };
      delete userClean.passwordHash;
      return { status: 'success', user: userClean };
    } else {
      // Cloud Vercel Blob mode
      try {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'register', username: cleanUsername, password })
        });
        return await response.json();
      } catch (err) {
        return { status: 'error', message: 'Cloud database connection error.' };
      }
    }
  }

  async login(username, password) {
    const cleanUsername = username.trim();
    if (this.mode === 'offline-local') {
      const key = cleanUsername.toLowerCase();
      const users = this.getLocalUsers();
      const user = users[key];

      if (!user) {
        return { status: 'error', message: 'User not found.' };
      }

      const passwordHash = await this.hashPasswordLocal(password);
      if (user.passwordHash !== passwordHash) {
        return { status: 'error', message: 'Incorrect password.' };
      }

      const userClean = { ...user };
      delete userClean.passwordHash;
      this.currentUser = userClean;
      localStorage.setItem(this.CURRENT_USER_KEY, userClean.username);

      return { status: 'success', user: userClean };
    } else {
      // Cloud Vercel Blob mode
      try {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', username: cleanUsername, password })
        });
        const data = await response.json();
        if (data.status === 'success') {
          this.currentUser = data.user;
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data.user));
        }
        return data;
      } catch (err) {
        return { status: 'error', message: 'Cloud database connection error.' };
      }
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(this.CURRENT_USER_KEY);
  }

  async updateScore(points, isWin, isLoss, isDraw) {
    if (!this.currentUser) return { status: 'error', message: 'No user logged in.' };

    const username = this.currentUser.username;

    if (this.mode === 'offline-local') {
      const key = username.toLowerCase();
      const users = this.getLocalUsers();
      const user = users[key];

      if (!user) {
        return { status: 'error', message: 'User not found.' };
      }

      user.score = Math.max(0, user.score + points);
      user.gamesPlayed += 1;
      if (isWin) user.wins += 1;
      if (isLoss) user.losses += 1;
      if (isDraw) user.draws += 1;

      users[key] = user;
      this.saveLocalUsers(users);

      const userClean = { ...user };
      delete userClean.passwordHash;
      this.currentUser = userClean;

      return { status: 'success', user: userClean };
    } else {
      // Cloud Vercel Blob mode
      try {
        const response = await fetch('/api/db', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'updateScore', username, points, isWin, isLoss, isDraw })
        });
        const data = await response.json();
        if (data.status === 'success') {
          this.currentUser = data.user;
          localStorage.setItem(this.CURRENT_USER_KEY, JSON.stringify(data.user));
        }
        return data;
      } catch (err) {
        return { status: 'error', message: 'Cloud database sync failed.' };
      }
    }
  }

  async getLeaderboard() {
    if (this.mode === 'offline-local') {
      const users = this.getLocalUsers();
      const leaderboard = Object.values(users)
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
      return { status: 'success', leaderboard };
    } else {
      // Cloud Vercel Blob mode
      try {
        const response = await fetch('/api/db');
        return await response.json();
      } catch (err) {
        return { status: 'error', leaderboard: [] };
      }
    }
  }
}

export const db = new DamaDBClient();
