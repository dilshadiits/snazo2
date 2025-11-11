import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';

// Schema validation for updates
const offerUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  code: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING']).optional(),
  value: z.number().positive().optional(),
  minAmount: z.number().positive().optional(),
  maxUses: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  productIds: z.array(z.string()).optional(), // Array of product IDs to apply offer to
});

// GET single offer
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const offer = await db.offer.findUnique({
      where: { id: params.id },
      include: {
        productOffers: {
          include: {
            product: true
          }
        },
        orders: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    if (!offer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(offer);
  } catch (error) {
    console.error('Error fetching offer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch offer' },
      { status: 500 }
    );
  }
}

// PUT update offer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { productIds, ...offerData } = offerUpdateSchema.parse(body);

    // Check if offer exists
    const existingOffer = await db.offer.findUnique({
      where: { id: params.id }
    });

    if (!existingOffer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Check for duplicate code if updating
    if (offerData.code) {
      const duplicateOffer = await db.offer.findFirst({
        where: {
          AND: [
            { id: { not: params.id } },
            { code: offerData.code }
          ]
        }
      });

      if (duplicateOffer) {
        return NextResponse.json(
          { error: 'Offer with this code already exists' },
          { status: 400 }
        );
      }
    }

    // Validate dates if updating
    if (offerData.startsAt || offerData.endsAt) {
      const startDate = offerData.startsAt ? new Date(offerData.startsAt) : existingOffer.startsAt;
      const endDate = offerData.endsAt ? new Date(offerData.endsAt) : existingOffer.endsAt;
      
      if (endDate <= startDate) {
        return NextResponse.json(
          { error: 'End date must be after start date' },
          { status: 400 }
        );
      }
    }

    // Update offer and product associations
    const updateData: any = {
      ...offerData,
      ...(offerData.startsAt && { startsAt: new Date(offerData.startsAt) }),
      ...(offerData.endsAt && { endsAt: new Date(offerData.endsAt) })
    };

    // Handle product associations
    if (productIds !== undefined) {
      // Delete existing product associations
      await db.productOffer.deleteMany({
        where: { offerId: params.id }
      });

      // Create new product associations if provided
      if (productIds.length > 0) {
        updateData.productOffers = {
          create: productIds.map(productId => ({
            productId
          }))
        };
      }
    }

    const updatedOffer = await db.offer.update({
      where: { id: params.id },
      data: updateData,
      include: {
        productOffers: {
          include: {
            product: true
          }
        }
      }
    });

    return NextResponse.json(updatedOffer);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }
    
    console.error('Error updating offer:', error);
    return NextResponse.json(
      { error: 'Failed to update offer' },
      { status: 500 }
    );
  }
}

// DELETE offer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if offer exists and has orders
    const existingOffer = await db.offer.findUnique({
      where: { id: params.id },
      include: {
        orders: true
      }
    });

    if (!existingOffer) {
      return NextResponse.json(
        { error: 'Offer not found' },
        { status: 404 }
      );
    }

    // Check if offer is used in any orders
    if (existingOffer.orders.length > 0) {
      // Instead of deleting, just deactivate it
      await db.offer.update({
        where: { id: params.id },
        data: { isActive: false }
      });

      return NextResponse.json(
        { message: 'Offer deactivated because it has existing orders' },
        { status: 200 }
      );
    }

    // Delete the offer if no orders
    await db.offer.delete({
      where: { id: params.id }
    });

    return NextResponse.json(
      { message: 'Offer deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting offer:', error);
    return NextResponse.json(
      { error: 'Failed to delete offer' },
      { status: 500 }
    );
  }
}