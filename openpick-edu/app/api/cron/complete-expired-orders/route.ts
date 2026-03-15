import { NextResponse } from 'next/server';
import { getExpiredOrders, completeOrder, recordPendingSettlement } from '@/lib/database-counselors';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const expiredOrders = await getExpiredOrders();
    
    const results = [];
    for (const order of expiredOrders) {
      try {
        const paymentAmount = BigInt(order.payment_amount as string);
        const settlementAmount = (paymentAmount * 99n) / 100n;
        
        const settlementTxHash = recordPendingSettlement({
          to: order.counselor_wallet_address as string,
          amount: settlementAmount.toString(),
          asset: order.payment_asset as string
        });
        
        await completeOrder(order.id as number, settlementTxHash, settlementAmount.toString(), 'auto_completed');
        results.push({ orderId: order.id, status: 'completed' });
      } catch (error) {
        results.push({ orderId: order.id, status: 'failed', error: String(error) });
      }
    }
    
    return NextResponse.json({ processed: results });
  } catch (error) {
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 });
  }
}
