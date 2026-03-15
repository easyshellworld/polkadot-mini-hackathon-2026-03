import { createClient } from '@libsql/client';

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

// Database client
let client: ReturnType<typeof createClient> | null = null;

// Type definitions for query results
export interface ResultSet {
  columns: string[];
  rows: any[][];
  rowsAffected: number;
  lastInsertRowid?: number;
}

// Initialize database
export const initDatabase = async () => {
  if (client) return client;

  // Use environment variables for Turso configuration
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || 'file:leaderboard.db';
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;

  try {
    client = createClient({
      url,
      authToken,
    });

    // Create tables if they don't exist
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT UNIQUE NOT NULL,
        score INTEGER DEFAULT 0,
        entries_count INTEGER DEFAULT 0,
        first_interaction DATETIME,
        last_interaction DATETIME
      );
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS project_items (
        projectId INTEGER PRIMARY KEY AUTOINCREMENT,
        itemName TEXT NOT NULL,
        score INTEGER NOT NULL,
        count INTEGER NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.execute(`
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
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_wallet_address ON users(wallet_address);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_score_last_interaction ON users(score DESC, last_interaction DESC);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_users_last_interaction ON users(last_interaction DESC);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_project_items_item_name ON project_items(itemName);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_project_items_name_score ON project_items(itemName, score DESC);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_id ON user_project_entries(userId);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_project_entries_project_id ON user_project_entries(projectId);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_project ON user_project_entries(userId, projectId);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_project_count ON user_project_entries(userId, projectId, completedCount DESC);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_user_project_entries_user_project_time ON user_project_entries(userId, projectId, updatedAt DESC);`);

    // Create counselors table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS counselors (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        skills TEXT NOT NULL,
        remark TEXT,
        price_usd REAL DEFAULT 10.0,
        telegram TEXT,
        wechat TEXT,
        wallet_address TEXT NOT NULL,
        served_times INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      );
    `);

    // Create counselor_orders table
    await client.execute(`
      CREATE TABLE IF NOT EXISTS counselor_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        counselor_id INTEGER NOT NULL,
        counselor_wallet_address TEXT NOT NULL,
        user_wallet_address TEXT NOT NULL,
        payment_tx_hash TEXT,
        payment_amount TEXT,
        payment_network TEXT,
        payment_asset TEXT,
        status TEXT DEFAULT 'paid',
        completion_method TEXT,
        rejection_reason TEXT,
        paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        completed_at DATETIME,
        rejected_at DATETIME,
        settlement_tx_hash TEXT,
        settlement_amount TEXT,
        FOREIGN KEY (counselor_id) REFERENCES counselors(id)
      );
    `);

    // Create counselor indexes
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_counselors_active ON counselors(is_active);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_counselors_wallet ON counselors(wallet_address);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_orders_counselor ON counselor_orders(counselor_id);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_orders_user ON counselor_orders(user_wallet_address);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_orders_status ON counselor_orders(status);`);
    await client.execute(`CREATE INDEX IF NOT EXISTS idx_orders_expires ON counselor_orders(expires_at);`);

    // 检查是否已有数据，如果没有则添加示例数据
    const projectCount = await client.execute('SELECT COUNT(*) as count FROM project_items');
    if (projectCount.rows[0][0] === 0) {
      // 添加示例项目数据
      await client.execute(`
        INSERT INTO project_items (itemName, score, count) VALUES
        ('whatIsNFT', 10, 1),
        ('nftUseCases', 10, 1),
        ('mintMyNFT', 20, 1),
        ('mintNextNFT', 10, 2)
      `);
    }

    return client;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw new Error(`Database initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Transaction helper
export const transaction = async <T>(fn: (tx: any) => Promise<T>): Promise<T> => {
  await initDatabase();
  if (!client) throw new Error('Database not initialized');
  
  // Use Turso's transaction API
  const tx = await client.transaction("write");
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
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
  const totalUsersResult = await database.execute('SELECT COUNT(*) as count FROM users');
  const totalUsers = totalUsersResult.rows[0]?.[0] as number || 0;

  // Get leaderboard data
  let query = `
    SELECT id, wallet_address, score, entries_count, first_interaction, last_interaction
    FROM users
  `;
  
  // Add ORDER BY clause based on sort and order parameters
  if (sort === 'score') {
    query += order === 'desc' ? ' ORDER BY score DESC, last_interaction DESC' : ' ORDER BY score ASC, last_interaction DESC';
  } else if (sort === 'entries_count') {
    query += order === 'desc' ? ' ORDER BY entries_count DESC, last_interaction DESC' : ' ORDER BY entries_count ASC, last_interaction DESC';
  } else if (sort === 'last_interaction') {
    query += order === 'desc' ? ' ORDER BY last_interaction DESC' : ' ORDER BY last_interaction ASC';
  } else if (sort === 'first_interaction') {
    query += order === 'desc' ? ' ORDER BY first_interaction DESC, last_interaction DESC' : ' ORDER BY first_interaction ASC, last_interaction DESC';
  } else {
    query += ' ORDER BY score DESC, last_interaction DESC';
  }
  
  query += ' LIMIT ? OFFSET ?';
  
  const usersResult = await database.execute(query, [limit, offset]);

  // Format leaderboard data
  const leaderboard = usersResult.rows.map((user: any, index: number) => ({
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
  const result = await database.execute({
    sql: 'SELECT * FROM users WHERE wallet_address = ?',
    args: [walletAddress]
  });
  return result.rows[0] as unknown as User;
};

// Update user score and learning data
export const updateUserScore = async (
  walletAddress: string,
  projectId: string,
  scoreChange: number
) => {
  const database = await initDatabase();
  const now = new Date().toISOString();

  try {
    // Check if user exists
    const userResult = await database.execute({
      sql: 'SELECT * FROM users WHERE wallet_address = ?',
      args: [walletAddress]
    });
    let user = userResult.rows[0] as unknown as User;

    if (!user) {
      // Create new user
      await database.execute({
        sql: `INSERT INTO users (wallet_address, score, entries_count, first_interaction, last_interaction)
         VALUES (?, ?, ?, ?, ?)`,
        args: [walletAddress, scoreChange, 1, now, now]
      });

      const newUserResult = await database.execute({
        sql: 'SELECT * FROM users WHERE wallet_address = ?',
        args: [walletAddress]
      });
      user = newUserResult.rows[0] as unknown as User;
    } else {
      // Update existing user
      const newScore = user.score + scoreChange;
      const newEntriesCount = user.entries_count + 1;

      await database.execute({
        sql: `UPDATE users SET 
         score = ?, 
         entries_count = ?, 
         last_interaction = ?
         WHERE id = ?`,
        args: [newScore, newEntriesCount, now, user.id]
      });

      user = { ...user, score: newScore, entries_count: newEntriesCount, last_interaction: now };
    }

    return {
      userId: user!.id,
      newScore: user!.score,
      entriesCount: user!.entries_count
    };
  } catch (error) {
    console.error('Error updating user score:', error);
    throw error;
  }
};

// Search users by wallet address
export const searchUsers = async (searchTerm: string, page: number = 1, limit: number = 20) => {
  const database = await initDatabase();
  const offset = (page - 1) * limit;

  // Get total search results count
  const totalUsersResult = await database.execute({
    sql: 'SELECT COUNT(*) as count FROM users WHERE wallet_address LIKE ?',
    args: [`%${searchTerm}%`]
  });
  const totalUsers = totalUsersResult.rows[0]?.[0] as number || 0;

  // Get search results
  const usersResult = await database.execute({
    sql: `SELECT id, wallet_address, score, entries_count, first_interaction, last_interaction
     FROM users
     WHERE wallet_address LIKE ?
     ORDER BY score DESC, last_interaction DESC
     LIMIT ? OFFSET ?`,
    args: [`%${searchTerm}%`, limit, offset]
  });

  // Format search results
  const leaderboard = usersResult.rows.map((user: any, index: number) => ({
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
  const totalItemsResult = await database.execute('SELECT COUNT(*) as count FROM project_items');
  const totalItems = totalItemsResult.rows[0]?.[0] as number || 0;

  // Get project items data
  let query = `
    SELECT projectId, itemName, score, count, createdAt
    FROM project_items
  `;
  
  // Add ORDER BY clause based on sort and order parameters
  if (sort === 'projectId') {
    query += order === 'desc' ? ' ORDER BY projectId DESC' : ' ORDER BY projectId ASC';
  } else if (sort === 'itemName') {
    query += order === 'desc' ? ' ORDER BY itemName DESC' : ' ORDER BY itemName ASC';
  } else if (sort === 'score') {
    query += order === 'desc' ? ' ORDER BY score DESC' : ' ORDER BY score ASC';
  } else if (sort === 'createdAt') {
    query += order === 'desc' ? ' ORDER BY createdAt DESC' : ' ORDER BY createdAt ASC';
  } else {
    query += ' ORDER BY projectId ASC';
  }
  
  query += ' LIMIT ? OFFSET ?';
  
  const projectItemsResult = await database.execute(query, [limit, offset]);

  const totalPages = Math.ceil(totalItems / limit);

  return {
    projectItems: projectItemsResult.rows as unknown as ProjectItem[],
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
  
  const result = await database.execute({
    sql: `INSERT INTO project_items (itemName, score, count)
     VALUES (?, ?, ?)`,
    args: [itemName, score, count]
  });

  const newProjectItemResult = await database.execute({
    sql: `SELECT projectId, itemName, score, count, createdAt
     FROM project_items
     WHERE projectId = ?`,
    args: [result.lastInsertRowid || 0]
  });

  return newProjectItemResult.rows[0] as unknown as ProjectItem;
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
    const projectItemResult = await database.execute({
      sql: `SELECT projectId, itemName, score, count, createdAt
       FROM project_items
       WHERE projectId = ?`,
      args: [projectId]
    });
    return projectItemResult.rows[0] as unknown as ProjectItem;
  }
  
  params.push(projectId);
  
  await database.execute({
    sql: `UPDATE project_items SET ${setClauses.join(', ')}
     WHERE projectId = ?`,
    args: params
  });

  const projectItemResult = await database.execute({
    sql: `SELECT projectId, itemName, score, count, createdAt
     FROM project_items
     WHERE projectId = ?`,
    args: [projectId]
  });

  return projectItemResult.rows[0] as unknown as ProjectItem;
};

// Delete a project item
export const deleteProjectItem = async (projectId: number) => {
  const database = await initDatabase();
  
  // First, delete any user project entries referencing this project item
  await database.execute({
    sql: `DELETE FROM user_project_entries WHERE projectId = ?`,
    args: [projectId]
  });
  
  const projectItemResult = await database.execute({
    sql: `SELECT projectId, itemName FROM project_items WHERE projectId = ?`,
    args: [projectId]
  });
  
  if (!projectItemResult.rows[0]) {
    return null;
  }
  
  // Now delete the project item
  await database.execute({
    sql: `DELETE FROM project_items WHERE projectId = ?`,
    args: [projectId]
  });
  
  return projectItemResult.rows[0] as unknown as ProjectItem;
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
  
  const totalEntriesResult = await database.execute({
    sql: countQuery,
    args: countParams
  });
  const totalEntries = totalEntriesResult.rows[0]?.[0] as number || 0;
  
  // Get entries
  const entriesResult = await database.execute({
    sql: query,
    args: params
  });
  
  const totalPages = Math.ceil(totalEntries / limit);
  
  return {
    entries: entriesResult.rows,
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
  
  try {
    // Check if user exists
    let userResult = await database.execute({
      sql: 'SELECT * FROM users WHERE wallet_address = ?',
      args: [walletAddress]
    });
    
    let user = userResult.rows[0] as unknown as User;
    
    if (!user) {
      // Create new user
      await database.execute({
        sql: `INSERT INTO users (wallet_address, score, entries_count, first_interaction, last_interaction)
         VALUES (?, 0, 0, ?, ?)`,
        args: [walletAddress, now, now]
      });
      
      userResult = await database.execute({
        sql: 'SELECT * FROM users WHERE wallet_address = ?',
        args: [walletAddress]
      });
      user = userResult.rows[0] as unknown as User;
    }
    
    // Get project item
    const projectItemResult = await database.execute({
      sql: `SELECT projectId, score, count FROM project_items WHERE projectId = ?`,
      args: [projectId]
    });
    
    const projectItem = projectItemResult.rows[0] as unknown as ProjectItem;
    
    if (!projectItem) {
      throw new Error('Project not found');
    }
    
    // Check user's current entry for this project
    const currentEntryResult = await database.execute({
      sql: `SELECT * FROM user_project_entries
       WHERE userId = ? AND projectId = ?`,
      args: [user!.id, projectId]
    });
    
    const currentEntry = currentEntryResult.rows[0] as unknown as UserProjectEntry;
    
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
      await database.execute({
        sql: `UPDATE user_project_entries SET
         completedCount = ?, 
         lastInteraction = ?,
         updatedAt = ?
         WHERE id = ?`,
        args: [newCompletedCount, now, now, currentEntry.id]
      });
    } else {
      // Insert new entry
      await database.execute({
        sql: `INSERT INTO user_project_entries (userId, projectId, completedCount, firstInteraction, lastInteraction)
         VALUES (?, ?, ?, ?, ?)`,
        args: [user!.id, projectId, newCompletedCount, now, now]
      });
    }
    
    // Update user's score and entries count
    const newScore = user!.score + projectItem.score;
    const newEntriesCount = user!.entries_count + 1;
    
    await database.execute({
      sql: `UPDATE users SET
       score = ?, 
       entries_count = ?, 
       last_interaction = ?
       WHERE id = ?`,
      args: [newScore, newEntriesCount, now, user!.id]
    });
    
    return {
      userId: user!.id,
      newScore,
      entriesCount: newEntriesCount,
      completedCount: newCompletedCount
    };
    
  } catch (error) {
    console.error('Error updating user project entry:', error);
    throw error;
  }
};

// Get user project entry by wallet address and project name
export const getUserProjectEntryByAddress = async (walletAddress: string, itemName: string) => {
  const database = await initDatabase();
  
  const result = await database.execute({
    sql: `SELECT upe.*, pi.score as projectScore
     FROM user_project_entries upe
     JOIN users u ON upe.userId = u.id
     JOIN project_items pi ON upe.projectId = pi.projectId
     WHERE u.wallet_address = ? AND pi.itemName = ?`,
    args: [walletAddress, itemName]
  });
  
  return result.rows[0];
};

// Get project item by name
export const getProjectItemByName = async (itemName: string) => {
  const database = await initDatabase();
  
  const result = await database.execute({
    sql: `SELECT projectId, itemName, score, count, createdAt
     FROM project_items
     WHERE itemName = ?`,
    args: [itemName]
  });
  
  return result.rows[0] as unknown as ProjectItem;
};