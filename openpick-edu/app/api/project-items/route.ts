import { NextRequest, NextResponse } from 'next/server';
import { 
  getProjectItems, 
  addProjectItem
} from '../../../lib/database-local';
import { validateAdmin } from '../../../lib/admin-auth';

// GET /api/project-items - Get all project items
export const GET = async (req: NextRequest) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const sort = url.searchParams.get('sort') || 'projectId';
    const order = url.searchParams.get('order') || 'asc';

    // Validate and sanitize parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, Math.min(100, limit)); // Limit between 1 and 100

    // Get project items data
    const result = await getProjectItems(validatedPage, validatedLimit, sort, order);

    return NextResponse.json({
      success: true,
      data: result.projectItems,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching project items:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error'
    }, { status: 500 });
  }
};

// POST /api/project-items - Add a new project item
export const POST = async (req: NextRequest) => {
  try {
    // 验证管理员权限
    const { isValid, error } = await validateAdmin(req);
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 403 });
    }

    const body = await req.json();
    const { itemName, score, count } = body;

    // Validate required fields
    if (!itemName || score === undefined || count === undefined) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Missing required fields',
          details: {
            itemName: 'Item name is required',
            score: 'Score is required',
            count: 'Count is required'
          }
        }
      }, { status: 400 });
    }

    // Validate score and count are positive integers
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid score parameter',
          details: {
            score: 'Score must be a positive integer'
          }
        }
      }, { status: 400 });
    }

    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid count parameter',
          details: {
            count: 'Count must be a positive integer'
          }
        }
      }, { status: 400 });
    }

    // Add new project item
    const newProjectItem = await addProjectItem(itemName, score, count);

    return NextResponse.json({
      success: true,
      data: newProjectItem
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding project item:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to add project item'
      }
    }, { status: 500 });
  }
};