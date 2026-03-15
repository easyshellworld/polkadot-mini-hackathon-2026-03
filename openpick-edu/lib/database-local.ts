import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

// Define interfaces for database records
interface User {
  id: number;
  wallet_address: string;
  score: number;
  entries_count: number;
  first_interaction: string | null;
  last_interaction: string | null;
}

interface ProjectItem {
  projectId: number;
  itemName: string;
  score: number;
  count: number;
  createdAt: string;
}

interface UserProjectEntry {
  id: number;
  userId: number;
  projectId: number;
  completedCount: number;
  firstInteraction: string;
  lastInteraction: string;
  createdAt: string;
  updatedAt: string;
}

// Database connection
let db: Database | null = null;

// Initialize database
export const initDatabase = async () => {
  if (db) return db;

  // 根据环境变量选择数据库类型
  const dbType = process.env.DATABASE_TYPE || 'memory';
  const filename = dbType === 'memory' ? ':memory:' : './leaderboard.db';

  db = await open({
    filename,
    driver: sqlite3.Database
  });

  // Create users table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      wallet_address TEXT UNIQUE NOT NULL,
      score INTEGER DEFAULT 0,
      entries_count INTEGER DEFAULT 0,
      first_interaction DATETIME,
      last_interaction DATETIME
    );
  `);

  // Create project_items table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS project_items (
      projectId INTEGER PRIMARY KEY AUTOINCREMENT,
      itemName TEXT NOT NULL,
      score INTEGER NOT NULL,
      count INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create user_project_entries table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS user_project_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      projectId INTEGER NOT NULL,
      completedCount INTEGER DEFAULT 0,
      firstInteraction DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastInteraction DATETIME DEFAULT CURRENT_TIMESTAMP,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id),
      FOREIGN KEY (projectId) REFERENCES project_items(projectId),
      UNIQUE(userId, projectId)
    );
  `);

  // Create indexes for performance
  await db.exec(`
    -- users table indexes
    CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);
    CREATE INDEX IF NOT EXISTS idx_users_score_last_interaction ON users(score DESC, last_interaction DESC);
    CREATE INDEX IF NOT EXISTS idx_users_last_interaction ON users(last_interaction DESC);
    
    -- project_items table indexes
    CREATE INDEX IF NOT EXISTS idx_project_items_item_name ON project_items(itemName);
    CREATE INDEX IF NOT EXISTS idx_project_items_name_score ON project_items(itemName, score DESC);
    
    -- user_project_entries table indexes
    CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_id ON user_project_entries(userId);
    CREATE INDEX IF NOT EXISTS idx_user_project_entries_project_id ON user_project_entries(projectId);
    CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_project ON user_project_entries(userId, projectId);
    CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_project_count ON user_project_entries(userId, projectId, completedCount DESC);
    CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_project_time ON user_project_entries(userId, projectId, updatedAt DESC);
  `);

  // 检查是否已有数据，如果没有则添加示例数据
  const projectCount = await db.get('SELECT COUNT(*) as count FROM project_items');
  if (projectCount.count === 0) {
    // 添加示例项目数据
    await db.run(`
      INSERT INTO project_items (itemName, score, count) VALUES
      ('whatIsNFT', 10, 1),
      ('nftUseCases', 10, 1),
      ('mintMyNFT', 20, 1),
      ('mintNextNFT', 10, 2)
    `);
  }

  return db;
};

// Format wallet address to 0x123***89
const formatAddress = (address: string): string => {
  if (address.length < 10) return address;
  return `${address.slice(0, 5)}***${address.slice(-4)}`;
};

// Format timestamp to "5min ago" format
const formatTimeAgo = (timestamp: string): string => {
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return `${diffInSeconds}s ago`;
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}min ago`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h ago`;
  } else {
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }
};

// Format date to "2024.2.1" format
const formatDate = (timestamp: string): string => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
};

// Get leaderboard data with pagination
export const getLeaderboard = async (
  page: number = 1,
  limit: number = 20,
  sort: string = 'score',
  order: string = 'desc'
) => {
  const database = await initDatabase();
  const offset = (page - 1) * limit;

  // Validate sort field
  const validSortFields = ['score', 'entries_count', 'last_interaction', 'first_interaction'];
  if (!validSortFields.includes(sort)) {
    sort = 'score';
  }

  // Validate order
  const validOrders = ['asc', 'desc'];
  if (!validOrders.includes(order)) {
    order = 'desc';
  }

  // Get total users count
  const totalUsersResult = await database.get<{ count: number }>('SELECT COUNT(*) as count FROM users');
  const totalUsers = totalUsersResult?.count || 0;

  // Get leaderboard data
  const users = await database.all<User[]>(`
    SELECT id, wallet_address, score, entries_count, first_interaction, last_interaction
    FROM users
    ORDER BY ${sort} ${order}, last_interaction DESC
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  // Format leaderboard data
  const leaderboard = users.map((user: User, index: number) => ({
    rank: offset + index + 1,
    walletAddress: formatAddress(user.wallet_address),
    originalAddress: user.wallet_address,
    score: user.score,
    entriesCount: user.entries_count,
    lastInteraction: user.last_interaction ? formatTimeAgo(user.last_interaction) : '-',
    firstInteraction: user.first_interaction ? formatDate(user.first_interaction) : '-'
  }));

  const totalPages = Math.ceil(totalUsers / limit);

  return {
    leaderboard,
    pagination: {
      currentPage: page,
      totalPages,
      totalUsers,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// Get user by wallet address
export const getUserByAddress = async (walletAddress: string) => {
  const database = await initDatabase();
  return await database.get<User>('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
};

// Update user score and learning data
export const updateUserScore = async (
  walletAddress: string,
  projectId: string,
  scoreChange: number
) => {
  const database = await initDatabase();
  const now = new Date().toISOString();

  // Start transaction
  await database.run('BEGIN TRANSACTION');

  try {
    // Check if user exists
    let user = await database.get<User>('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);

    if (!user) {
      // Create new user
      await database.run(
        `INSERT INTO users (wallet_address, score, entries_count, first_interaction, last_interaction)
         VALUES (?, ?, ?, ?, ?)`,
        [walletAddress, scoreChange, 1, now, now]
      );

      user = await database.get<User>('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    } else {
      // Update existing user
      const newScore = user.score + scoreChange;
      const newEntriesCount = user.entries_count + 1;

      await database.run(
        `UPDATE users SET 
         score = ?, 
         entries_count = ?, 
         last_interaction = ?
         WHERE id = ?`,
        [newScore, newEntriesCount, now, user.id]
      );

      user = { ...user, score: newScore, entries_count: newEntriesCount, last_interaction: now };
    }

    // Commit transaction
    await database.run('COMMIT');

    return {
      userId: user!.id,
      newScore: user!.score,
      entriesCount: user!.entries_count
    };
  } catch (error) {
    // Rollback transaction
    await database.run('ROLLBACK');
    throw error;
  }
};

// Search users by wallet address
export const searchUsers = async (searchTerm: string, page: number = 1, limit: number = 20) => {
  const database = await initDatabase();
  const offset = (page - 1) * limit;

  // Get total search results count
  const totalUsersResult = await database.get<{ count: number }>(
    'SELECT COUNT(*) as count FROM users WHERE wallet_address LIKE ?',
    [`%${searchTerm}%`]
  );
  const totalUsers = totalUsersResult?.count || 0;

  // Get search results
  const users = await database.all<User[]>(
    `SELECT id, wallet_address, score, entries_count, first_interaction, last_interaction
     FROM users
     WHERE wallet_address LIKE ?
     ORDER BY score DESC, last_interaction DESC
     LIMIT ? OFFSET ?`,
    [`%${searchTerm}%`, limit, offset]
  );

  // Format search results
  const leaderboard = users.map((user, index) => ({
    rank: offset + index + 1,
    walletAddress: formatAddress(user.wallet_address),
    originalAddress: user.wallet_address,
    score: user.score,
    entriesCount: user.entries_count,
    lastInteraction: user.last_interaction ? formatTimeAgo(user.last_interaction) : '-',
    firstInteraction: user.first_interaction ? formatDate(user.first_interaction) : '-'
  }));

  const totalPages = Math.ceil(totalUsers / limit);

  return {
    leaderboard,
    pagination: {
      currentPage: page,
      totalPages,
      totalUsers,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// Get all project items
export const getProjectItems = async (
  page: number = 1,
  limit: number = 50,
  sort: string = 'projectId',
  order: string = 'asc'
) => {
  const database = await initDatabase();
  const offset = (page - 1) * limit;

  // Validate sort field
  const validSortFields = ['projectId', 'itemName', 'score', 'createdAt'];
  if (!validSortFields.includes(sort)) {
    sort = 'projectId';
  }

  // Validate order
  const validOrders = ['asc', 'desc'];
  if (!validOrders.includes(order)) {
    order = 'asc';
  }

  // Get total project items count
  const totalItemsResult = await database.get<{ count: number }>('SELECT COUNT(*) as count FROM project_items');
  const totalItems = totalItemsResult?.count || 0;

  // Get project items data
  const projectItems = await database.all<ProjectItem>(`
    SELECT projectId, itemName, score, count, createdAt
    FROM project_items
    ORDER BY ${sort} ${order}
    LIMIT ? OFFSET ?
  `, [limit, offset]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    projectItems,
    pagination: {
      currentPage: page,
      totalPages,
      totalItems,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// Add a new project item
export const addProjectItem = async (itemName: string, score: number, count: number) => {
  const database = await initDatabase();
  
  const result = await database.run(
    `INSERT INTO project_items (itemName, score, count)
     VALUES (?, ?, ?)`,
    [itemName, score, count]
  );

  return await database.get<ProjectItem>(
    `SELECT projectId, itemName, score, count, createdAt
     FROM project_items
     WHERE projectId = ?`,
    [result.lastID]
  );
};

// Update an existing project item
export const updateProjectItem = async (projectId: number, updates: Partial<ProjectItem>) => {
  const database = await initDatabase();
  
  // Build update query
  const setClauses: string[] = [];
  const params: any[] = [];
  
  if (updates.itemName !== undefined) {
    setClauses.push('itemName = ?');
    params.push(updates.itemName);
  }
  
  if (updates.score !== undefined) {
    setClauses.push('score = ?');
    params.push(updates.score);
  }
  
  if (updates.count !== undefined) {
    setClauses.push('count = ?');
    params.push(updates.count);
  }
  
  if (setClauses.length === 0) {
    // No updates, return current item
    return await database.get<ProjectItem>(
      `SELECT projectId, itemName, score, count, createdAt
       FROM project_items
       WHERE projectId = ?`,
      [projectId]
    );
  }
  
  params.push(projectId);
  
  await database.run(
    `UPDATE project_items SET ${setClauses.join(', ')}
     WHERE projectId = ?`,
    params
  );

  return await database.get<ProjectItem>(
    `SELECT projectId, itemName, score, count, createdAt
     FROM project_items
     WHERE projectId = ?`,
    [projectId]
  );
};

// Delete a project item
export const deleteProjectItem = async (projectId: number) => {
  const database = await initDatabase();
  
  // First, delete any user project entries referencing this project item
  await database.run(
    `DELETE FROM user_project_entries WHERE projectId = ?`,
    [projectId]
  );
  
  const projectItem = await database.get<ProjectItem>(
    `SELECT projectId, itemName FROM project_items WHERE projectId = ?`,
    [projectId]
  );
  
  if (!projectItem) {
    return null;
  }
  
  // Now delete the project item
  await database.run(
    `DELETE FROM project_items WHERE projectId = ?`,
    [projectId]
  );
  
  return projectItem;
};

// Get user project entries
export const getUserProjectEntries = async (
  userId: number,
  projectId?: number,
  page: number = 1,
  limit: number = 50
) => {
  const database = await initDatabase();
  const offset = (page - 1) * limit;
  
  let query = `
    SELECT upe.id, upe.userId, upe.projectId, pi.itemName, upe.completedCount, upe.firstInteraction, upe.lastInteraction, upe.createdAt, upe.updatedAt
    FROM user_project_entries upe
    JOIN project_items pi ON upe.projectId = pi.projectId
    WHERE upe.userId = ?
  `;
  
  const params: any[] = [userId];
  
  if (projectId !== undefined) {
    query += ' AND upe.projectId = ?';
    params.push(projectId);
  }
  
  query += `
    ORDER BY upe.lastInteraction DESC
    LIMIT ? OFFSET ?
  `;
  params.push(limit, offset);
  
  // Get total entries count
  let countQuery = `
    SELECT COUNT(*) as count FROM user_project_entries
    WHERE userId = ?
  `;
  
  const countParams: any[] = [userId];
  
  if (projectId !== undefined) {
    countQuery += ' AND projectId = ?';
    countParams.push(projectId);
  }
  
  const totalEntriesResult = await database.get<{ count: number }>(countQuery, countParams);
  const totalEntries = totalEntriesResult?.count || 0;
  
  // Get entries
  const entries = await database.all<any>(query, params);
  
  const totalPages = Math.ceil(totalEntries / limit);
  
  return {
    entries,
    pagination: {
      currentPage: page,
      totalPages,
      totalEntries,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
};

// Update user project entry
export const updateUserProjectEntry = async (walletAddress: string, projectId: number) => {
  const database = await initDatabase();
  const now = new Date().toISOString();
  
  // Start transaction
  await database.run('BEGIN TRANSACTION');
  
  try {
    // Check if user exists
    let user = await database.get<User>('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    
    if (!user) {
      // Create new user
      await database.run(
        `INSERT INTO users (wallet_address, score, entries_count, first_interaction, last_interaction)
         VALUES (?, 0, 0, ?, ?)`,
        [walletAddress, now, now]
      );
      
      user = await database.get<User>('SELECT * FROM users WHERE wallet_address = ?', [walletAddress]);
    }
    
    // Get project item
    const projectItem = await database.get<ProjectItem>(
      `SELECT projectId, score, count FROM project_items WHERE projectId = ?`,
      [projectId]
    );
    
    if (!projectItem) {
      throw new Error('Project not found');
    }
    
    // Check user's current entry for this project
    const currentEntry = await database.get<UserProjectEntry>(
      `SELECT * FROM user_project_entries
       WHERE userId = ? AND projectId = ?`,
      [user!.id, projectId]
    );
    
    let newCompletedCount = 0;
    let canComplete = false;
    
    if (currentEntry) {
      // User has already interacted with this project
      newCompletedCount = currentEntry.completedCount + 1;
      canComplete = newCompletedCount <= projectItem.count;
    } else {
      // First interaction with this project
      newCompletedCount = 1;
      canComplete = newCompletedCount <= projectItem.count;
    }
    
    if (!canComplete) {
      // Rollback transaction since we're not making any changes
      await database.run('ROLLBACK');
      
      // Return special response indicating limit reached but no error
      return {
        userId: user!.id,
        newScore: user!.score, // No score change
        entriesCount: user!.entries_count, // No entries count change
        completedCount: currentEntry ? currentEntry.completedCount : 0, // No change in completed count
        limitReached: true // Special flag indicating limit was reached
      };
    }
    
    // Update or insert user project entry
    if (currentEntry) {
      // Update existing entry
      await database.run(
        `UPDATE user_project_entries SET
         completedCount = ?, 
         lastInteraction = ?,
         updatedAt = ?
         WHERE id = ?`,
        [newCompletedCount, now, now, currentEntry.id]
      );
    } else {
      // Insert new entry
      await database.run(
        `INSERT INTO user_project_entries (userId, projectId, completedCount, firstInteraction, lastInteraction)
         VALUES (?, ?, ?, ?, ?)`,
        [user!.id, projectId, newCompletedCount, now, now]
      );
    }
    
    // Update user's score and entries count
    const newScore = user!.score + projectItem.score;
    const newEntriesCount = user!.entries_count + 1;
    
    await database.run(
      `UPDATE users SET
       score = ?, 
       entries_count = ?, 
       last_interaction = ?
       WHERE id = ?`,
      [newScore, newEntriesCount, now, user!.id]
    );
    
    // Commit transaction
    await database.run('COMMIT');
    
    return {
      userId: user!.id,
      newScore,
      entriesCount: newEntriesCount,
      completedCount: newCompletedCount
    };
    
  } catch (error) {
    // Rollback transaction
    await database.run('ROLLBACK');
    throw error;
  }
};

// Get user project entry by wallet address and project name
export const getUserProjectEntryByAddress = async (walletAddress: string, itemName: string) => {
  const database = await initDatabase();
  
  const result = await database.get<any>(
    `SELECT upe.*, pi.score as projectScore
     FROM user_project_entries upe
     JOIN users u ON upe.userId = u.id
     JOIN project_items pi ON upe.projectId = pi.projectId
     WHERE u.wallet_address = ? AND pi.itemName = ?`,
    [walletAddress, itemName]
  );
  
  return result;
};

// Get project item by name
export const getProjectItemByName = async (itemName: string) => {
  const database = await initDatabase();
  
  return await database.get<ProjectItem>(
    `SELECT projectId, itemName, score, count, createdAt
     FROM project_items
     WHERE itemName = ?`,
    [itemName]
  );
};
