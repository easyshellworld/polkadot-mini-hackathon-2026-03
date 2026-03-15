import { NextRequest, NextResponse } from 'next/server';
import { getCounselors, addCounselor } from '@/lib/database-counselors';
import { validateAdmin } from '@/lib/admin-auth';

export async function GET(req: NextRequest) {
  try {
    const page = parseInt(req.nextUrl.searchParams.get('page') || '1');
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '20');
    
    const counselors = await getCounselors(page, limit);
    
    // 转换所有 BigInt 字段为 number
    const serializedCounselors = counselors.map((counselor: any) => ({
      ...counselor,
      id: typeof counselor.id === 'bigint' ? Number(counselor.id) : counselor.id,
    }));
    
    return NextResponse.json({ success: true, data: { counselors: serializedCounselors } });
  } catch (error) {
    console.error('Error fetching counselors:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch counselors' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // 验证管理员权限
    const isAdmin = await validateAdmin(req);
    if (!isAdmin.isValid) {
      return NextResponse.json({ success: false, error: isAdmin.error?.message || 'Unauthorized' }, { status: 401 });
    }
    
    const counselor = await addCounselor(body);
    
    // 转换 BigInt 字段为 number
    const serializedCounselor = {
      ...counselor,
      id: typeof counselor.id === 'bigint' ? Number(counselor.id) : counselor.id,
    };
    
    return NextResponse.json({ success: true, data: serializedCounselor });
  } catch (error) {
    console.error('Error adding counselor:', error);
    return NextResponse.json({ success: false, error: 'Failed to add counselor' }, { status: 500 });
  }
}
