import { NextRequest } from 'next/server';

/**
 * 验证请求是否来自管理员
 * @param req Next.js 请求对象
 * @returns 验证结果，包含是否有效和可能的错误信息
 */
export async function validateAdmin(req: NextRequest): Promise<{ isValid: boolean; error?: { message: string } }> {
  try {
    // 获取环境变量中的管理员地址（只使用后端变量，不暴露到前端）
    const adminAddress = process.env.ADMIN_ADDRESS;
    
    console.log('Admin validation - adminAddress from env:', adminAddress ? 'configured' : 'not configured');
    
    if (!adminAddress) {
      console.error('Admin address not configured in environment variables');
      return {
        isValid: false,
        error: { message: "服务器配置错误" }
      };
    }

    // 从请求中获取钱包地址
    const walletAddress = req.headers.get('x-wallet-address');
    
    console.log('Admin validation - walletAddress from request:', walletAddress ? 'present' : 'missing');
    
    if (!walletAddress) {
      return {
        isValid: false,
        error: { message: "没有权限修改" }
      };
    }

    // 比较地址（不区分大小写）
    const normalizedAdminAddress = adminAddress.toLowerCase();
    const normalizedWalletAddress = walletAddress.toLowerCase();
    
    const isMatch = normalizedWalletAddress === normalizedAdminAddress;
    console.log('Admin validation - result:', isMatch ? 'authorized' : 'unauthorized');
    
    if (!isMatch) {
      return {
        isValid: false,
        error: { message: "没有权限修改" }
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error validating admin:', error);
    return {
      isValid: false,
      error: { message: "验证失败" }
    };
  }
}