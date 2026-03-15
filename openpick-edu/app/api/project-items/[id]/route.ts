import { NextRequest, NextResponse } from 'next/server';
import { 
  getProjectItems, 
  updateProjectItem,
  deleteProjectItem
} from '../../../../lib/database-local';
import { validateAdmin } from '../../../../lib/admin-auth';

// PUT /api/project-items/[id] - Update an existing project item
export const PUT = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  try {
    // 验证管理员权限
    const { isValid, error } = await validateAdmin(req);
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 403 });
    }

    // Extract projectId from URL params
    const { id } = await params;
    const projectId = parseInt(id);

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

    const body = await req.json();
    const { itemName, score, count } = body;

    // Validate score and count if provided
    if (score !== undefined) {
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
    }

    if (count !== undefined) {
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
    }

    // Update project item
    const updatedProjectItem = await updateProjectItem(projectId, {
      itemName,
      score,
      count
    });

    if (!updatedProjectItem) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Project item not found',
          details: {
            projectId: projectId
          }
        }
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: updatedProjectItem
    });
  } catch (error) {
    console.error('Error updating project item:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update project item'
      }
    }, { status: 500 });
  }
};

// DELETE /api/project-items/[id] - Delete a project item
export const DELETE = async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  let projectId: number;
  
  try {
    // 验证管理员权限
    const { isValid, error } = await validateAdmin(req);
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error
      }, { status: 403 });
    }

    // Extract projectId from URL params
    const { id } = await params;
    projectId = parseInt(id);

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

    // Delete project item
    const deletedProjectItem = await deleteProjectItem(projectId);

    if (!deletedProjectItem) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'ITEM_NOT_FOUND',
          message: 'Project item not found',
          details: {
            projectId: projectId
          }
        }
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Project item deleted successfully',
      data: {
        projectId: deletedProjectItem.projectId,
        itemName: deletedProjectItem.itemName
      }
    });
  } catch (error) {
    console.error('Error deleting project item:', error);
    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete project item'
      }
    }, { status: 500 });
  }
};