import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, completeOrder, recordPendingSettlement } from '@/lib/database-counselors';
import { validateAdmin } from '@/lib/admin-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const body = await req.json().catch(() => ({}));
    const { trigger, clientTimestamp } = body;
    const walletAddress = req.headers.get('x-wallet-address') || '';

    // 获取订单详情
    const order = await getOrderById(orderId);
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // 订单已完成，幂等性返回成功
    if (order.status === 'completed') {
      return NextResponse.json({ 
        success: true, 
        data: {
          orderId,
          status: 'completed',
          message: 'Order already completed'
        }
      });
    }

    // 订单状态异常
    if (order.status !== 'paid') {
      return NextResponse.json({ success: false, error: `Invalid order status: ${order.status}` }, { status: 400 });
    }

    // 检查是否过期
    const isExpired = new Date(order.expires_at as string) <= new Date();

    // 验证权限
    const isAdmin = await validateAdmin(req);
    const isOrderOwner = (order.user_wallet_address as string)?.toLowerCase() === walletAddress?.toLowerCase();

    if (!isAdmin.isValid && !isOrderOwner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 计算服务器端剩余时间
    const serverRemainingSeconds = Math.max(0, 
      Math.floor((new Date(order.expires_at as string).getTime() - Date.now()) / 1000)
    );

    // 时间偏差验证（仅当前端倒计时触发时）
    if (trigger === 'countdown-end' && clientTimestamp) {
      const serverTime = Date.now();
      const clientTime = clientTimestamp;
      const timeDiff = Math.abs(serverTime - clientTime) / 1000;
      
      if (timeDiff > 60) {
        return NextResponse.json({ 
          success: false, 
          error: 'Time drift detected',
          serverRemainingSeconds
        }, { status: 400 });
      }
    }

    // 计算结算金额 (99%)
    const paymentAmount = BigInt(order.payment_amount as string);
    const settlementAmount = (paymentAmount * 99n) / 100n;

    // 记录结算信息
    const settlementTxHash = recordPendingSettlement({
      to: order.counselor_wallet_address as string,
      amount: settlementAmount.toString(),
      asset: order.payment_asset as string
    });

    // 判断完成方式
    let completionMethod: 'user_confirmed' | 'auto_completed';

    if (trigger) {
      if (!isExpired) {
        return NextResponse.json({ 
          success: false, 
          error: 'Order not expired yet, cannot auto-complete' 
        }, { status: 400 });
      }
      completionMethod = 'auto_completed';
    } else {
      completionMethod = 'user_confirmed';
    }

    await completeOrder(orderId, settlementTxHash, settlementAmount.toString(), completionMethod);

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        status: 'completed',
        settlementTxHash,
        settlementAmount: settlementAmount.toString(),
        completionMethod
      }
    });
  } catch (error) {
    console.error('Error completing order:', error);
    return NextResponse.json({ success: false, error: 'Failed to complete order' }, { status: 500 });
  }
}
