import { initDatabase } from './database-turso';

// 获取顾问列表
export async function getCounselors(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  const db = await initDatabase();
  
  const result = await db.execute({
    sql: `SELECT id, name, skills, remark, price_usd, served_times, is_active
          FROM counselors WHERE is_active = TRUE
          ORDER BY served_times DESC LIMIT ? OFFSET ?`,
    args: [limit, offset]
  });

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    skills: JSON.parse(row.skills as string),
    remark: row.remark,
    priceUsd: row.price_usd,
    servedTimes: row.served_times
  }));
}

// 获取顾问详情
export async function getCounselorById(id: number) {
  const db = await initDatabase();
  const result = await db.execute({
    sql: 'SELECT * FROM counselors WHERE id = ? AND is_active = TRUE',
    args: [id]
  });
  return result.rows[0];
}

// 添加顾问
export async function addCounselor(data: {
  name: string;
  skills: Array<{ name: string; level: string }>;
  remark: string;
  telegram: string;
  wechat: string;
  walletAddress: string;
  priceUsd?: number;
}) {
  const db = await initDatabase();
  // 钱包地址统一转换为小写格式存储
  const normalizedWalletAddress = data.walletAddress.toLowerCase();
  
  const result = await db.execute({
    sql: `INSERT INTO counselors (name, skills, remark, telegram, wechat, wallet_address, price_usd)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.name,
      JSON.stringify(data.skills),
      data.remark,
      data.telegram,
      data.wechat,
      normalizedWalletAddress,
      data.priceUsd || 10.0
    ]
  });

  return { id: result.lastInsertRowid, ...data };
}

// 创建订单
export async function createOrder(data: {
  counselorId: number;
  counselorWalletAddress: string;
  userWalletAddress: string;
  paymentTxHash: string;
  paymentAmount: string;
  paymentNetwork: string;
  paymentAsset: string;
}) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const db = await initDatabase();
  
  // 钱包地址统一转换为小写格式存储
  const normalizedCounselorWallet = data.counselorWalletAddress.toLowerCase();
  const normalizedUserWallet = data.userWalletAddress.toLowerCase();
  
  const result = await db.execute({
    sql: `INSERT INTO counselor_orders 
          (counselor_id, counselor_wallet_address, user_wallet_address, payment_tx_hash, payment_amount, payment_network, payment_asset, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      data.counselorId,
      normalizedCounselorWallet,
      normalizedUserWallet,
      data.paymentTxHash,
      data.paymentAmount,
      data.paymentNetwork,
      data.paymentAsset,
      expiresAt
    ]
  });

  return { id: result.lastInsertRowid, expiresAt };
}

// 获取用户订单
export async function getUserOrders(userWalletAddress: string, status?: string) {
  const db = await initDatabase();
  // 钱包地址转换为小写格式进行查询
  const normalizedWalletAddress = userWalletAddress.toLowerCase();
  
  let sql = `SELECT co.*, c.name as counselor_name, c.skills as counselor_skills
             FROM counselor_orders co
             JOIN counselors c ON co.counselor_id = c.id
             WHERE co.user_wallet_address = ?`;
  const args: any[] = [normalizedWalletAddress];

  if (status) {
    sql += ' AND co.status = ?';
    args.push(status);
  }

  sql += ' ORDER BY co.paid_at DESC';

  const result = await db.execute({ sql, args });
  return result.rows;
}

// 获取管理员查询所有订单
export async function getAllOrders(status?: string) {
  const db = await initDatabase();
  
  let sql = `SELECT co.*, c.name as counselor_name, c.skills as counselor_skills
             FROM counselor_orders co
             JOIN counselors c ON co.counselor_id = c.id`;
  const args: any[] = [];

  if (status) {
    sql += ' WHERE co.status = ?';
    args.push(status);
  }

  sql += ' ORDER BY co.paid_at DESC';

  const result = await db.execute({ sql, args });
  return result.rows;
}

// 根据ID获取订单详情
export async function getOrderById(orderId: number) {
  const db = await initDatabase();
  const result = await db.execute({
    sql: `SELECT co.*, c.name as counselor_name
          FROM counselor_orders co
          JOIN counselors c ON co.counselor_id = c.id
          WHERE co.id = ?`,
    args: [orderId]
  });
  return result.rows[0];
}

// 完成服务（带事务和幂等性保证）
export async function completeOrder(
  orderId: number, 
  settlementTxHash: string, 
  settlementAmount: string, 
  completionMethod: 'user_confirmed' | 'auto_completed'
) {
  const db = await initDatabase();
  const tx = await db.transaction('write');
  
  try {
    // 使用 UPDATE ... WHERE 条件的幂等性
    const updateResult = await tx.execute({
      sql: `UPDATE counselor_orders 
            SET status = 'completed', 
                completed_at = CURRENT_TIMESTAMP, 
                settlement_tx_hash = ?, 
                settlement_amount = ?, 
                completion_method = ?
            WHERE id = ? AND status = 'paid'`,
      args: [settlementTxHash, settlementAmount, completionMethod, orderId]
    });
    
    // 如果没有行被更新，检查订单是否已完成
    if (updateResult.rowsAffected === 0) {
      const checkResult = await tx.execute({
        sql: 'SELECT status, completion_method FROM counselor_orders WHERE id = ?',
        args: [orderId]
      });
      
      const currentOrder = checkResult.rows[0];
      if (currentOrder && currentOrder.status === 'completed') {
        await tx.commit();
        return {
          success: true,
          message: 'Order already completed',
          alreadyCompleted: true
        };
      }
      
      await tx.rollback();
      return {
        success: false,
        message: 'Order status is not paid or order not found'
      };
    }

    // 获取 counselor_id 用于更新服务次数
    const order = await tx.execute({
      sql: 'SELECT counselor_id FROM counselor_orders WHERE id = ?',
      args: [orderId]
    });

    if (order.rows[0]) {
      // 更新顾问服务次数
      await tx.execute({
        sql: 'UPDATE counselors SET served_times = served_times + 1 WHERE id = ?',
        args: [order.rows[0].counselor_id]
      });
    }
    
    await tx.commit();
    
    return {
      success: true,
      message: 'Order completed successfully'
    };
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
}

// 获取过期订单
export async function getExpiredOrders() {
  const db = await initDatabase();
  const result = await db.execute({
    sql: `SELECT co.*
          FROM counselor_orders co
          WHERE co.status = 'paid' AND co.expires_at <= datetime('now')`,
    args: []
  });
  return result.rows;
}

// 更新订单交易哈希（用于 x402 异步结算后更新）
export async function updateOrderTxHash(
  orderId: number,
  txHash: string
) {
  const db = await initDatabase();
  await db.execute({
    sql: `UPDATE counselor_orders 
          SET payment_tx_hash = ? 
          WHERE id = ?`,
    args: [txHash, orderId]
  });
}

// 拒绝完成服务
export async function rejectOrder(
  orderId: number,
  rejectionReason: string
) {
  const db = await initDatabase();

  await db.execute({
    sql: `UPDATE counselor_orders 
          SET status = 'rejected', rejected_at = CURRENT_TIMESTAMP, 
              rejection_reason = ?
          WHERE id = ? AND status = 'paid'`,
    args: [rejectionReason, orderId]
  });

  const order = await db.execute({
    sql: 'SELECT * FROM counselor_orders WHERE id = ?',
    args: [orderId]
  });

  return order.rows[0];
}

// 生成顾问信息txt内容
export function generateCounselorTxtContent(counselor: any, order: any): string {
  const skills = JSON.parse(counselor.skills as string)
    .map((s: any) => `  - ${s.name} (${s.level})`)
    .join('\n');

  return `========================================
         顾问详细信息
========================================

姓名: ${counselor.name}

技能: 
${skills}

备注: ${counselor.remark || '无'}

联系方式:
  - Telegram: ${counselor.telegram || '未提供'}
  - WeChat: ${counselor.wechat || '未提供'}

========================================
订单信息
========================================
订单ID: ${order.id}
支付时间: ${order.paid_at}
服务到期时间: ${order.expires_at}

========================================
`;
}

// 记录待人工结算的信息
export function recordPendingSettlement(params: { to: string; amount: string; asset: string }): string {
  return `pending_manual_settlement_${Date.now()}`;
}
