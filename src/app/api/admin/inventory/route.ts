import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const lowStock = searchParams.get('lowStock') === 'true';
    const outOfStock = searchParams.get('outOfStock') === 'true';
    const category = searchParams.get('category');

    const where: any = {};
    
    if (lowStock) {
      where.stock = {
        lte: 10,
        gt: 0
      };
    }
    
    if (outOfStock) {
      where.stock = 0;
    }
    
    if (category) {
      where.category = {
        slug: category
      };
    }

    const products = await db.product.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        orderItems: {
          select: {
            quantity: true,
            order: {
              select: {
                createdAt: true,
                status: true
              }
            }
          },
          orderBy: {
            order: {
              createdAt: 'desc'
            }
          },
          take: 5
        }
      },
      orderBy: [
        { stock: 'asc' },
        { name: 'asc' }
      ]
    });

    // Calculate inventory metrics
    const totalProducts = products.length;
    const totalStock = products.reduce((sum, product) => sum + product.stock, 0);
    const lowStockCount = products.filter(p => p.stock > 0 && p.stock <= 10).length;
    const outOfStockCount = products.filter(p => p.stock === 0).length;

    // Calculate stock value
    const totalStockValue = products.reduce((sum, product) => sum + (product.stock * product.price), 0);

    // Get recent stock movements (from orders)
    const recentOrders = await db.orderItem.findMany({
      take: 50,
      orderBy: {
        order: {
          createdAt: 'desc'
        }
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        order: {
          select: {
            orderNumber: true,
            createdAt: true,
            status: true
          }
        }
      }
    });

    return NextResponse.json({
      products,
      metrics: {
        totalProducts,
        totalStock,
        totalStockValue,
        lowStockCount,
        outOfStockCount,
        averageStockPerProduct: totalProducts > 0 ? Math.round(totalStock / totalProducts) : 0
      },
      recentMovements: recentOrders
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json(
      { error: 'Failed to fetch inventory' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check admin authentication
    const authResult = await requireAdmin(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
    const { productId, quantity, operation, reason } = body;

    if (!productId || !quantity || !operation) {
      return NextResponse.json(
        { error: 'Product ID, quantity, and operation are required' },
        { status: 400 }
      );
    }

    if (!['add', 'subtract', 'set'].includes(operation)) {
      return NextResponse.json(
        { error: 'Operation must be add, subtract, or set' },
        { status: 400 }
      );
    }

    // Get current product
    const product = await db.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    let newStock;
    switch (operation) {
      case 'add':
        newStock = product.stock + quantity;
        break;
      case 'subtract':
        newStock = Math.max(0, product.stock - quantity);
        break;
      case 'set':
        newStock = Math.max(0, quantity);
        break;
    }

    // Update product stock
    const updatedProduct = await db.product.update({
      where: { id: productId },
      data: { stock: newStock },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    return NextResponse.json({
      product: updatedProduct,
      previousStock: product.stock,
      newStock,
      operation,
      quantity,
      reason
    });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json(
      { error: 'Failed to update inventory' },
      { status: 500 }
    );
  }
}