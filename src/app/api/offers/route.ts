import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema validation
const offerSchema = z.object({
  title: z.string().min(1),
  code: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']),
  value: z.number().positive(),
  minAmount: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  productIds: z.array(z.string()).optional(), // Array of product IDs to apply offer to
});

// GET all offers
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const isActive = searchParams.get('isActive');
    const code = searchParams.get('code');

    const skip = (page - 1) * limit;

    const where: any = {};
    
    if (isActive !== null) {
      where.isActive = isActive === 'true';
    }
    
    if (code) {
      where.code = { contains: code, mode: 'insensitive' };
    }

    const [offers, total] = await Promise.all([
      db.offer.findMany({
        where,
        include: {
          productOffers: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true
                }
              }
            }
          },
          _count: {
            select: {
              orders: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      db.offer.count({ where })
    ]);

    return NextResponse.json({
      offers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offers' },
      { status: 500 }
    );
  }
}

// POST create new offer
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds, ...offerData } = offerSchema.parse(body);

    // Check if offer with same code already exists
    const existingOffer = await db.offer.findUnique({
      where: { code: offerData.code }
    });

    if (existingOffer) {
      return NextResponse.json(
        { error: 'Offer with this code already exists' },
        { status: 400 }
      );
    }

    // Validate dates
    const startDate = new Date(offerData.startsAt);
    const endDate = new Date(offerData.endsAt);
    
    if (endDate <= startDate) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    const offer = await db.offer.create({
      data: {
        ...offerData,
        startsAt: startDate,
        endsAt: endDate,
        productOffers: productIds && productIds.length > 0 ? {
          create: productIds.map(productId => ({
            productId
          }))
        } : undefined
      },
      include: {
        productOffers: {
          include: {
            product: true
          }
        }
      }
    });

    return NextResponse.json(offer, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error creating offer:', error);
    return NextResponse.json(
      { error: 'Failed to create offer' },
      { status: 500 }
    );
  }
}