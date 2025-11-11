import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAdmin } from '@/lib/auth';

const orderUpdateSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
  notes: z.string().optional(),
});

// GET all orders (admin only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const paymentStatus = searchParams.get('paymentStatus');
    const search = searchParams.get('search');

    const skip = (page - 1) * limit;

    // Check admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const where: any = {};
    
    if (status) {
      where.status = status;
    }
    
    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }
    
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } }
      ];
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  image: true
                }
              }
            }
          },
          offer: {
            select: {
              id: true,
              code: true,
              type: true,
              value: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.order.count({ where })
    ]);

    return NextResponse.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

// PUT update order status (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = orderUpdateSchema.parse(body);

    // Check admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Check if order exists
    const existingOrder = await db.order.findUnique({
      where: { id: params.id },
      include: {
        items: true
      }
    });

    if (!existingOrder) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // If order is being cancelled, restore stock
    if (validatedData.status === 'CANCELLED' && existingOrder.status !== 'CANCELLED') {
      await Promise.all(
        existingOrder.items.map(item =>
          db.product.update({
            where: { id: item.productId },
            data: {
              stock: { increment: item.quantity }
            }
          })
        )
      );
    }

    // If order is being moved from cancelled to another status, deduct stock
    if (existingOrder.status === 'CANCELLED' && validatedData.status !== 'CANCELLED') {
      // Check if enough stock is available
      const stockChecks = await Promise.all(
        existingOrder.items.map(async item => {
          const product = await db.product.findUnique({
            where: { id: item.productId }
          });
          return product && product.stock >= item.quantity;
        })
      );

      if (stockChecks.some(check => !check)) {
        return NextResponse.json(
          { error: 'Insufficient stock for one or more items' },
          { status: 400 }
        );
      }

      // Deduct stock
      await Promise.all(
        existingOrder.items.map(item =>
          db.product.update({
            where: { id: item.productId },
            data: {
              stock: { decrement: item.quantity }
            }
          })
        )
      );
    }

    const updatedOrder = await db.order.update({
      where: { id: params.id },
      data: validatedData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating order:', error);
    return NextResponse.json(
      { error: 'Failed to update order' },
      { status: 500 }
    );
  }
}