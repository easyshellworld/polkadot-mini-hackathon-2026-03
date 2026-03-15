import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const templateFileMap: Record<string, string> = {
  'simple': 'SimpleCounter.sol',
  'basic': 'BasicERC721.sol',
  'mintable': 'MintableERC721.sol'
};

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID is required' },
        { status: 400 }
      );
    }

    const fileName = templateFileMap[templateId];
    
    if (!fileName) {
      return NextResponse.json(
        { error: 'Invalid template ID' },
        { status: 400 }
      );
    }

    const templatesDir = path.join(process.cwd(), 'contracts', 'templates');
    const filePath = path.join(templatesDir, fileName);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const code = fs.readFileSync(filePath, 'utf-8');

    return NextResponse.json({ code });
  } catch (error) {
    console.error('Error reading template:', error);
    return NextResponse.json(
      { error: 'Failed to read template' },
      { status: 500 }
    );
  }
}
