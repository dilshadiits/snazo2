import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';

const bulkOperationSchema = z.object({
  operation: z.enum(['activate', 'deactivate', 'delete', 'updatePrice', 'updateStock']),
  productIds: z.array(z.string()).min(1),
  data: z.object({
    price: z.number().positive().optional(),
    stock: z.number().int().min(0).optional(),
  }).optional()
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { operation, productIds, data } = bulkOperationSchema.parse(body);

    // Check admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    let result;

    switch (operation) {
      case 'activate':
        result = await db.product.updateMany({
          where: { id: { in: productIds } },
          data: { isActive: true }
        });
        break;

      case 'deactivate':
        result = await db.product.updateMany({
          where: { id: { in: productIds } },
          data: { isActive: false }
        });
        break;

      case 'delete':
        // Check if products are in any orders before deleting
        const productsInOrders = await db.product.findMany({
          where: {
            id: { in: productIds },
            orderItems: {
              some: {}
            }
          },
          select: { id: true }
        });

        if (productsInOrders.length > 0) {
          return NextResponse.json(
            { 
              error: 'Cannot delete products that have existing orders',
              productsInOrders: productsInOrders.map(p => p.id)
            },
            { status: 400 }
          );
        }

        result = await db.product.deleteMany({
          where: { 
            id: { in: productIds },
            orderItems: {
              none: {}
            }
          }
        });
        break;

      case 'updatePrice':
        if (!data?.price) {
          return NextResponse.json(
            { error: 'Price is required for updatePrice operation' },
            { status: 400 }
          );
        }

        result = await db.product.updateMany({
          where: { id: { in: productIds } },
          data: { price: data.price }
        });
        break;

      case 'updateStock':
        if (!data?.stock && data?.stock !== 0) {
          return NextResponse.json(
            { error: 'Stock is required for updateStock operation' },
            { status: 400 }
          );
        }

        result = await db.product.updateMany({
          where: { id: { in: productIds } },
          data: { stock: data.stock }
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      message: `Bulk ${operation} completed successfully`,
      affectedCount: result.count,
      operation
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error performing bulk operation:', error);
    return NextResponse.json(
      { error: 'Failed to perform bulk operation' },
      { status: 500 }
    );
  }
}