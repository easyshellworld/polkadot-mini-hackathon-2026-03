import { NextRequest, NextResponse } from 'next/server';
import { 
  getUserProjectEntries, 
  updateUserProjectEntry,
  getUserProjectEntryByAddress,
  getProjectItemByName,
  addProjectItem
} from '../../../lib/database-local';

// GET /api/user-project-entries - Get user project entries
export const GET = async (req: NextRequest) => {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const userIdStr = url.searchParams.get('userId');
    const projectIdStr = url.searchParams.get('projectId');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');

    // Validate required parameters
    if (!userIdStr) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Missing required parameter',
          details: {
            userId: 'User ID is required'
          }
        }
      }, { status: 400 });
    }

    const userId = parseInt(userIdStr);
    if (isNaN(userId)) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Invalid user ID',
          details: {
            userId: 'User ID must be a valid integer'
          }
        }
      }, { status: 400 });
    }

    // Validate optional projectId if provided
    let projectId: number | undefined;
    if (projectIdStr) {
      projectId = parseInt(projectIdStr);
      if (isNaN(projectId)) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid project ID',
            details: {
              projectId: 'Project ID must be a valid integer'
            }
          }
        }, { status: 400 });
      }
    }

    // Validate and sanitize pagination parameters
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.max(1, Math.min(100, limit)); // Limit between 1 and 100

    // Get user project entries
    const result = await getUserProjectEntries(userId, projectId, validatedPage, validatedLimit);

    return NextResponse.json({
      success: true,
      data: result.entries,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Error fetching user project entries:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch user project entries'
      }
    }, { status: 500 });
  }
};

// POST /api/user-project-entries - Update user project entry
export const POST = async (req: NextRequest) => {
  try {
    const body = await req.json();
    const { userId, projectId, walletAddress, projectName } = body;

    // Validate required parameters
    if (!((userId && projectId) || (walletAddress && projectName))) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'INVALID_PARAMETERS',
          message: 'Missing required parameters',
          details: {
            userId_projectId: 'Either userId and projectId must be provided,',
            walletAddress_projectName: 'or walletAddress and projectName must be provided'
          }
        }
      }, { status: 400 });
    }

    let finalUserId: number;
    let finalProjectId: number;

    if (userId && projectId) {
      // Validate userId and projectId
      if (typeof userId !== 'number' || isNaN(userId)) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid user ID',
            details: {
              userId: 'User ID must be a valid integer'
            }
          }
        }, { status: 400 });
      }

      if (typeof projectId !== 'number' || isNaN(projectId)) {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid project ID',
            details: {
              projectId: 'Project ID must be a valid integer'
            }
          }
        }, { status: 400 });
      }

      finalUserId = userId;
      finalProjectId = projectId;
    } else {
      // Validate walletAddress and projectName
      if (!walletAddress || typeof walletAddress !== 'string') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid wallet address',
            details: {
              walletAddress: 'Wallet address must be a valid string'
            }
          }
        }, { status: 400 });
      }

      if (!projectName || typeof projectName !== 'string') {
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_PARAMETERS',
            message: 'Invalid project name',
            details: {
              projectName: 'Project name must be a valid string'
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

      // Get projectId from projectName
      let projectItem = await getProjectItemByName(projectName);
      if (!projectItem) {
        // If the project doesn't exist, create it (for customNFTContract)
        if (projectName === 'customNFTContract') {
          projectItem = await addProjectItem(projectName, 30, 1); // 30 points, can be completed once
        } else {
          return NextResponse.json({
            success: false,
            error: {
              code: 'PROJECT_NOT_FOUND',
              message: 'Project not found',
              details: {
                projectName: projectName
              }
            }
          }, { status: 404 });
        }
      }

      finalProjectId = projectItem!.projectId;

      // Update user project entry by wallet address and projectId
      const result = await updateUserProjectEntry(walletAddress, finalProjectId);
      
      // Check if the limit was reached but we should still return success
      if (result.limitReached) {
        return NextResponse.json({
          success: true,
          data: {
            ...result,
            limitReached: true
          }
        });
      }
      
      return NextResponse.json({
        success: true,
        data: result
      });
    }

    // Update user project entry
    const result = await updateUserProjectEntryByUserId(finalUserId, finalProjectId);

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

// Helper function to update user project entry by userId and projectId
const updateUserProjectEntryByUserId = async (userId: number, projectId: number) => {
  // This function would need to be implemented in the database layer
  // For now, we'll throw an error since we don't have this function implemented yet
  throw new Error('updateUserProjectEntryByUserId not implemented');
};
