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
    const period = searchParams.get('period') || '30'; // days

    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Sales analytics
    const salesAnalytics = await db.order.aggregate({
      where: {
        createdAt: { gte: startDate },
        status: { not: 'CANCELLED' }
      },
      _sum: {
        total: true,
        subtotal: true,
        discount: true,
        shipping: true
      },
      _count: {
        id: true
      },
      _avg: {
        total: true
      }
    });

    // Order status breakdown
    const orderStatusBreakdown = await db.order.groupBy({
      by: ['status'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: {
        id: true
      },
      _sum: {
        total: true
      }
    });

    // Payment status breakdown
    const paymentStatusBreakdown = await db.order.groupBy({
      by: ['paymentStatus'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: {
        id: true
      },
      _sum: {
        total: true
      }
    });

    // Top selling products
    const topProducts = await db.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: startDate },
          status: { not: 'CANCELLED' }
        }
      },
      _sum: {
        quantity: true,
        total: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          quantity: 'desc'
        }
      },
      take: 10
    });

    // Get product details for top products
    const topProductIds = topProducts.map(p => p.productId);
    const topProductDetails = await db.product.findMany({
      where: { id: { in: topProductIds } },
      select: {
        id: true,
        name: true,
        price: true,
        image: true,
        category: {
          select: {
            name: true
          }
        }
      }
    });

    const topProductsWithDetails = topProducts.map(topProduct => {
      const productDetails = topProductDetails.find(p => p.id === topProduct.productId);
      return {
        ...topProduct,
        product: productDetails
      };
    });

    // Category performance
    const categoryPerformance = await db.orderItem.groupBy({
      by: ['productId'],
      where: {
        order: {
          createdAt: { gte: startDate },
          status: { not: 'CANCELLED' }
        }
      },
      _sum: {
        quantity: true,
        total: true
      }
    });

    // Get category details
    const categoryProductIds = categoryPerformance.map(cp => cp.productId);
    const categoryProducts = await db.product.findMany({
      where: { id: { in: categoryProductIds } },
      select: {
        id: true,
        categoryId: true,
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    const categoryTotals = categoryPerformance.reduce((acc, item) => {
      const product = categoryProducts.find(p => p.id === item.productId);
      if (product && product.category) {
        const categoryId = product.category.id;
        const categoryName = product.category.name;
        
        if (!acc[categoryId]) {
          acc[categoryId] = {
            categoryId,
            categoryName,
            totalRevenue: 0,
            totalQuantity: 0,
            totalOrders: 0
          };
        }
        
        acc[categoryId].totalRevenue += item._sum.total || 0;
        acc[categoryId].totalQuantity += item._sum.quantity || 0;
        acc[categoryId].totalOrders += item._count.id;
      }
      return acc;
    }, {} as Record<string, any>);

    // Customer analytics
    const customerAnalytics = await Promise.all([
      // New customers
      db.user.count({
        where: {
          createdAt: { gte: startDate }
        }
      }),
      
      // Total customers
      db.user.count(),
      
      // Customers with orders
      db.user.count({
        where: {
          orders: {
            some: {
              createdAt: { gte: startDate }
            }
          }
        }
      }),
      
      // Repeat customers (customers with more than 1 order)
      db.user.count({
        where: {
          orders: {
            some: {
              createdAt: { gte: startDate }
            }
          }
        }
      }).then(async (count) => {
        const repeatCustomers = await db.user.findMany({
          where: {
            orders: {
              some: {
                createdAt: { gte: startDate }
              }
            }
          },
          include: {
            orders: {
              where: {
                createdAt: { gte: startDate }
              }
            }
          }
        });
        
        return repeatCustomers.filter(user => user.orders.length > 1).length;
      })
    ]);

    // Daily sales trend
    const dailySales = await db.order.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate },
        status: { not: 'CANCELLED' }
      },
      _sum: {
        total: true
      },
      _count: {
        id: true
      }
    });

    // Group by day
    const dailyData = dailySales.reduce((acc, sale) => {
      const day = new Date(sale.createdAt).toISOString().split('T')[0];
      
      if (!acc[day]) {
        acc[day] = { revenue: 0, orders: 0 };
      }
      
      acc[day].revenue += sale._sum.total || 0;
      acc[day].orders += sale._count.id;
      
      return acc;
    }, {} as Record<string, { revenue: number; orders: number }>);

    // Fill missing days with zero values
    const filledDailyData = [];
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const day = date.toISOString().split('T')[0];
      
      filledDailyData.push({
        date: day,
        revenue: dailyData[day]?.revenue || 0,
        orders: dailyData[day]?.orders || 0
      });
    }

    return NextResponse.json({
      summary: {
        totalRevenue: salesAnalytics._sum.total || 0,
        totalOrders: salesAnalytics._count.id,
        averageOrderValue: salesAnalytics._avg.total || 0,
        totalDiscount: salesAnalytics._sum.discount || 0,
        totalShipping: salesAnalytics._sum.shipping || 0
      },
      orderStatusBreakdown,
      paymentStatusBreakdown,
      topProducts: topProductsWithDetails,
      categoryPerformance: Object.values(categoryTotals).sort((a, b) => b.totalRevenue - a.totalRevenue),
      customerAnalytics: {
        newCustomers: customerAnalytics[0],
        totalCustomers: customerAnalytics[1],
        customersWithOrders: customerAnalytics[2],
        repeatCustomers: customerAnalytics[3]
      },
      dailySales: filledDailyData.reverse()
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}