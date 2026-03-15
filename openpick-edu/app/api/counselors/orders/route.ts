import { NextRequest, NextResponse } from 'next/server';
import { getUserOrders, getAllOrders } from '@/lib/database-counselors';
import { validateAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  const walletAddress = req.headers.get('x-wallet-address');
  if (!walletAddress) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized: missing x-wallet-address' },
      { status: 401 }
    );
  }

  const status = req.nextUrl.searchParams.get('status') || undefined;
  const checkExpired = req.nextUrl.searchParams.get('checkExpired') === 'true';

  // 验证是否为管理员
  const isAdmin = await validateAdmin(req);
  
  // 管理员查询全量订单，普通用户查询自己的订单
  const orders = isAdmin.isValid 
    ? await getAllOrders(status)
    : await getUserOrders(walletAddress, status);

  // 计算剩余时间并转换 BigInt
  const enrichedOrders = orders.map((order: any) => {
    // 转换所有 BigInt 字段为 number
    const serializedOrder = {
      ...order,
      id: typeof order.id === 'bigint' ? Number(order.id) : order.id,
      counselor_id: typeof order.counselor_id === 'bigint' ? Number(order.counselor_id) : order.counselor_id,
    };

    if (!checkExpired || !order.expires_at) {
      return serializedOrder;
    }

    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000)
    );

    return {
      ...serializedOrder,
      remainingSeconds,
    };
  });

  return NextResponse.json({
    success: true,
    orders: enrichedOrders,
  });
}
