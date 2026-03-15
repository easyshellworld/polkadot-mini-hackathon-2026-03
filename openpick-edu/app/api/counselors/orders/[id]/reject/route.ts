import { NextRequest, NextResponse } from 'next/server';
import { getOrderById, rejectOrder } from '@/lib/database-counselors';
import { validateAdmin } from '@/lib/admin-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    const body = await req.json();
    const { rejectionReason } = body;
    const walletAddress = req.headers.get('x-wallet-address') || '';

    if (!rejectionReason || !rejectionReason.trim()) {
      return NextResponse.json({ 
        success: false, 
        error: 'Rejection reason is required' 
      }, { status: 400 });
    }

    // 获取订单详情
    const order = await getOrderById(orderId);
    
    if (!order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // 订单已终态，幂等性返回
    if (order.status === 'completed' || order.status === 'rejected') {
      return NextResponse.json({ 
        success: true, 
        data: {
          orderId,
          status: order.status,
          message: 'Order already finalized'
        }
      });
    }

    // 验证权限
    const isAdmin = await validateAdmin(req);
    const isOrderOwner = (order.user_wallet_address as string)?.toLowerCase() === walletAddress?.toLowerCase();

    if (!isAdmin.isValid && !isOrderOwner) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const rejectedOrder = await rejectOrder(orderId, rejectionReason);

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        status: 'rejected',
        rejectionReason,
        rejectedAt: rejectedOrder.rejected_at,
        message: '订单已拒绝，退款请联系客服人工处理'
      }
    });
  } catch (error) {
    console.error('Error rejecting order:', error);
    return NextResponse.json({ success: false, error: 'Failed to reject order' }, { status: 500 });
  }
}
