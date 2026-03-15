import { NextRequest, NextResponse } from 'next/server';
import { getCounselorById, getUserOrders, generateCounselorTxtContent } from '@/lib/database-counselors';
import { validateAdmin } from '@/lib/admin-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const counselorId = parseInt(id);
    const walletAddress = req.headers.get('x-wallet-address') || '';

    if (!walletAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized: missing x-wallet-address' 
      }, { status: 401 });
    }

    // 获取顾问信息
    const counselor = await getCounselorById(counselorId);
    if (!counselor) {
      return NextResponse.json({ 
        success: false, 
        error: 'Counselor not found' 
      }, { status: 404 });
    }

    // 检查是否为管理员
    const isAdmin = await validateAdmin(req);

    // 查询用户的订单
    const orders = await getUserOrders(walletAddress);
    const validOrder = orders.find((order: any) => 
      order.counselor_id === counselorId && 
      (order.status === 'paid' || order.status === 'completed')
    );

    // 非管理员且无有效订单
    if (!isAdmin.isValid && !validOrder) {
      return NextResponse.json({ 
        success: false, 
        error: 'No valid order found for this counselor',
        message: '请先支付获取顾问信息后再下载'
      }, { status: 403 });
    }

    // 生成txt内容
    const txtContent = generateCounselorTxtContent(counselor, validOrder || { id: 'admin', paid_at: new Date().toISOString(), expires_at: 'N/A' });

    // 返回txt文件
    return new NextResponse(txtContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `attachment; filename="counselor_${counselor.name}_info.txt"`
      }
    });
  } catch (error) {
    console.error('Error downloading counselor info:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Download failed' 
    }, { status: 500 });
  }
}
