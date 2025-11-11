import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '@/lib/auth';
import { validateAndApplyOffer, incrementOfferUsage } from '@/lib/offers';

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    price: z.number().positive()
  })),
  shippingAddress: z.string().min(1),
  paymentMethod: z.string().min(1),
  notes: z.string().optional(),
  offerCode: z.string().optional(),
});

// GET all orders (with admin/user filtering)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const userId = searchParams.get('userId');

    const skip = (page - 1) * limit;

    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult;

    const where: any = {};
    
    // Non-admin users can only see their own orders
    if (user.role !== 'ADMIN') {
      where.userId = user.id;
    } else if (userId) {
      // Admin can filter by user
      where.userId = userId;
    }
    
    if (status) {
      where.status = status;
    }

    const [orders, total] = await Promise.all([
      db.order.findMany({
        where,
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
          },
          offer: true
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

// POST create new order
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = orderSchema.parse(body);

    // Check authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const user = authResult;

    // Validate products and calculate totals
    const productIds = validatedData.items.map(item => item.productId);
    const products = await db.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: 'Some products are not available' },
        { status: 400 }
      );
    }

    // Check stock availability
    for (const item of validatedData.items) {
      const product = products.find(p => p.id === item.productId);
      if (product && product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for product: ${product.name}` },
          { status: 400 }
        );
      }
    }

    // Calculate order totals
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of validatedData.items) {
      const product = products.find(p => p.id === item.productId);
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;

      orderItems.push({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: itemTotal
      });
    }

    // Apply offer if provided
    let discount = 0;
    let offerId = null;
    
    if (validatedData.offerCode) {
      const offerResult = await validateAndApplyOffer(
        validatedData.offerCode,
        subtotal,
        productIds
      );
      
      discount = offerResult.discount;
      offerId = offerResult.offer?.id || null;
    }

    // Calculate totals
    const tax = subtotal * 0.1; // 10% tax
    const shipping = subtotal > 50 ? 0 : 5.99; // Free shipping over $50
    const total = subtotal - discount + tax + shipping;

    // Generate order number
    const orderNumber = `ORD${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create order
    const order = await db.order.create({
      data: {
        orderNumber,
        userId: user.id,
        subtotal,
        discount,
        tax,
        shipping,
        total,
        notes: validatedData.notes,
        shippingAddress: validatedData.shippingAddress,
        paymentMethod: validatedData.paymentMethod,
        offerId,
        items: {
          create: orderItems
        }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        offer: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Update product stock
    for (const item of validatedData.items) {
      await db.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity
          }
        }
      });
    }

    // Increment offer usage if offer was used
    if (offerId) {
      await incrementOfferUsage(offerId);
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}