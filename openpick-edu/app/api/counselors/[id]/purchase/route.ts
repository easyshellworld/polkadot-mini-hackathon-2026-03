import { NextRequest, NextResponse } from 'next/server';
import { getCounselorById, createOrder } from '@/lib/database-counselors';

/**
 * 购买顾问咨询服务 - 简化版本（模拟支付）
 * 
 * 流程：
 * 1. 验证用户钱包地址
 * 2. 获取顾问信息
 * 3. 创建订单（模拟支付成功）
 * 4. 返回顾问联系方式
 * 
 * 注意：x402 协议集成代码已完成，但由于需要复杂的配置和测试，
 * 当前使用简化版本以确保系统可靠性。
 * 详见 COUNSELORS_X402_INTEGRATION_PLAN.md 了解如何启用 x402 支付。
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const counselorId = parseInt(id);
    const body = await req.json();
    const { userWalletAddress } = body;

    if (!userWalletAddress) {
      return NextResponse.json({ 
        success: false, 
        error: 'User wallet address is required' 
      }, { status: 400 });
    }

    // 获取顾问信息
    const counselor = await getCounselorById(counselorId);
    
    if (!counselor) {
      return NextResponse.json({ 
        success: false, 
        error: 'Counselor not found' 
      }, { status: 404 });
    }

    // 创建订单（模拟支付成功）
    const order = await createOrder({
      counselorId,
      counselorWalletAddress: (counselor.wallet_address as string) || '',
      userWalletAddress: userWalletAddress.toLowerCase(),
      paymentTxHash: `mock_tx_${Date.now()}`,  // 模拟交易哈希
      paymentAmount: ((counselor.price_usd as number) * 1000000).toString(), // 模拟 USDC (6位小数)
      paymentNetwork: 'eip155:11155111',  // Sepolia 测试网
      paymentAsset: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'  // USDC Sepolia
    });

    console.log('✅ Order created (mock payment):', order.id);
    
    // 返回顾问联系方式
    return NextResponse.json({
      success: true,
      data: {
        orderId: Number(order.id),  // 转换 BigInt 为 number
        name: counselor.name,
        skills: JSON.parse(counselor.skills as string),
        remark: counselor.remark,
        telegram: counselor.telegram,
        wechat: counselor.wechat,
        expiresAt: order.expiresAt,
        remainingTime: Math.floor((new Date(order.expiresAt).getTime() - Date.now()) / 1000)
      }
    });
  } catch (error) {
    console.error('\u274c Purchase error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Purchase failed' 
    }, { status: 500 });
  }
}
