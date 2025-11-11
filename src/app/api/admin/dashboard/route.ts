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

    // Get dashboard statistics
    const [
      totalUsers,
      totalProducts,
      totalOrders,
      totalRevenue,
      recentOrders,
      topProducts,
      activeOffers,
      lowStockProducts
    ] = await Promise.all([
      // Total users
      db.user.count(),
      
      // Total products
      db.product.count({ where: { isActive: true } }),
      
      // Total orders
      db.order.count(),
      
      // Total revenue
      db.order.aggregate({
        where: { status: { not: 'CANCELLED' } },
        _sum: { total: true }
      }),
      
      // Recent orders
      db.order.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
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
                  name: true
                }
              }
            }
          }
        }
      }),
      
      // Top selling products
      db.orderItem.groupBy({
        by: ['productId'],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 5,
      }),
      
      // Active offers
      db.offer.count({
        where: {
          isActive: true,
          startsAt: { lte: new Date() },
          endsAt: { gte: new Date() }
        }
      }),
      
      // Low stock products
      db.product.count({
        where: {
          isActive: true,
          stock: { lte: 10 }
        }
      })
    ]);

    // Get product details for top products
    const topProductIds = topProducts.map(p => p.productId);
    const topProductDetails = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: {
        id: true,
        name: true,
        price: true,
        image: true
      }
    });

    // Combine top products with their details
    const topProductsWithDetails = topProducts.map(topProduct => {
      const productDetails = topProductDetails.find(p => p.id === topProduct.productId);
      return {
        ...topProduct,
        product: productDetails
      };
    });

    // Get monthly sales data for the last 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlySales = await db.order.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: sixMonthsAgo },
        status: { not: 'CANCELLED' }
      },
      _sum: { total: true },
      _count: { id: true }
    });

    // Group by month
    const monthlyData = monthlySales.reduce((acc, sale) => {
      const month = new Date(sale.createdAt).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short' 
      });
      
      if (!acc[month]) {
        acc[month] = { revenue: 0, orders: 0 };
      }
      
      acc[month].revenue += sale._sum.total || 0;
      acc[month].orders += sale._count.id;
      
      return acc;
    }, {} as Record<string, { revenue: number; orders: number }>);

    return NextResponse.json({
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,
        totalRevenue: totalRevenue._sum.total || 0,
        activeOffers,
        lowStockProducts
      },
      recentOrders,
      topProducts: topProductsWithDetails,
      monthlyData: Object.entries(monthlyData).map(([month, data]) => ({
        month,
        revenue: data.revenue,
        orders: data.orders
      }))
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}