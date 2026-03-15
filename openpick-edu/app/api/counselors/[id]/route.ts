import { NextRequest, NextResponse } from 'next/server';
import { getCounselorById } from '@/lib/database-counselors';

// 简化版本：直接返回顾问基本信息（不含付费信息）
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const counselorId = parseInt(id);
    const counselor = await getCounselorById(counselorId);
    
    if (!counselor) {
      return NextResponse.json({ success: false, error: 'Counselor not found' }, { status: 404 });
    }

    // 返回基本信息（不含联系方式）
    return NextResponse.json({
      success: true,
      data: {
        id: typeof counselor.id === 'bigint' ? Number(counselor.id) : counselor.id,
        name: counselor.name,
        skills: JSON.parse(counselor.skills as string),
        remark: counselor.remark,
        priceUsd: counselor.price_usd,
        servedTimes: counselor.served_times
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}
