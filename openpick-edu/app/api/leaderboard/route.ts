import { NextRequest, NextResponse } from 'next/server';
import { 
  getLeaderboard, 
  updateUserProjectEntry, 
  searchUsers,
  getProjectItemByName 
} from '../../../lib/database-turso';

// GET /api/leaderboard - Get leaderboard data
export const GET = async (req: NextRequest) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const sort = url.searchParams.get('sort') || 'score';
    const order = url.searchParams.get('order') || 'desc';
    const search = url.searchParams.get('search') || '';

    // Validate and sanitize parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, Math.min(100, limit)); // Limit between 1 and 100

    let result;
    if (search) {
      // Search users by wallet address
      result = await searchUsers(search, validatedPage, validatedLimit);
    } else {
      // Get leaderboard data
      result = await getLeaderboard(validatedPage, validatedLimit, sort, order);
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal Server Error'
    }, { status: 500 });
  }
};

// POST /api/leaderboard - Update user learning data
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { walletAddress, projectId } = body;

    // Validate required fields
    if (!walletAddress || !projectId) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Missing required fields',
          details: {
            walletAddress: 'Wallet address is required',
            projectId: 'Project ID is required'
          }
        }
      }, { status: 400 });
    }

    // Validate wallet address format (basic check for Ethereum addresses)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Invalid wallet address format',
          details: {
            walletAddress: 'Wallet address must be a valid Ethereum address (0x followed by 40 hex characters)'
          }
        }
      }, { status: 400 });
    }

    // Update user project entry
    let result;
    
    // Check if projectId is a number (projectId) or string (projectName)
    if (typeof projectId === 'number' || /^\d+$/.test(projectId)) {
      // projectId is a number, use it directly
      result = await updateUserProjectEntry(walletAddress, parseInt(projectId as string));
    } else {
      // projectId is a string (projectName), convert it to projectId
      const projectItem = await getProjectItemByName(projectId as string);
      if (!projectItem) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: 'Project not found',
            details: {
              projectId: projectId
            }
          }
        }, { status: 404 });
      }
      result = await updateUserProjectEntry(walletAddress, projectItem.projectId);
    }

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating user project entry:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Project not found') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'PROJECT_NOT_FOUND',
            message: error.message
          }
        }, { status: 404 });
      }
      
      if (error.message === 'Project completion limit reached') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'PROJECT_COMPLETION_LIMIT_REACHED',
            message: error.message
          }
        }, { status: 409 });
      }
    }
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update user project entry'
      }
    }, { status: 500 });
  }
};
