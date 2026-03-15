import { NextRequest, NextResponse } from 'next/server';
import { validateAdmin } from '@/lib/admin-auth';

/**
 * 验证当前用户是否为管理员
 * GET /api/admin/verify
 * 
 * 请求头:
 * - x-wallet-address: 用户钱包地址
 * 
 * 响应:
 * - isAdmin: boolean
 */
export async function GET(req: NextRequest) {
  try {
    const adminCheck = await validateAdmin(req);
    
    return NextResponse.json({
      isAdmin: adminCheck.isValid,
    });
  } catch (error) {
    console.error('Error verifying admin:', error);
    return NextResponse.json({ isAdmin: false });
  }
}
