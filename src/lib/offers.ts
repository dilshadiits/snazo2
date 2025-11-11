import { db } from '@/lib/db';

export interface OfferCalculation {
  discount: number;
  finalPrice: number;
  offer?: any;
}

export async function validateAndApplyOffer(
  offerCode: string,
  cartTotal: number,
  productIds?: string[]
): Promise<OfferCalculation> {
  try {
    // Find the offer
    const offer = await db.offer.findFirst({
      where: {
        code: offerCode.toUpperCase(),
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() },
        OR: [
          { maxUses: null },
          { usedCount: { lt: db.offer.fields.maxUses } }
        ]
      },
      include: {
        productOffers: {
          include: {
            product: true
          }
        }
      }
    });

    if (!offer) {
      return { discount: 0, finalPrice: cartTotal };
    }

    // Check minimum amount requirement
    if (offer.minAmount && cartTotal < offer.minAmount) {
      return { discount: 0, finalPrice: cartTotal };
    }

    // Check if offer applies to specific products
    if (offer.productOffers.length > 0) {
      if (!productIds || productIds.length === 0) {
        return { discount: 0, finalPrice: cartTotal };
      }

      // Check if any product in cart is eligible for this offer
      const eligibleProductIds = offer.productOffers.map(po => po.productId);
      const hasEligibleProduct = productIds.some(id => eligibleProductIds.includes(id));

      if (!hasEligibleProduct) {
        return { discount: 0, finalPrice: cartTotal };
      }
    }

    // Calculate discount based on offer type
    let discount = 0;

    switch (offer.type) {
      case 'PERCENTAGE':
        discount = cartTotal * (offer.value / 100);
        break;
      case 'FIXED_AMOUNT':
        discount = Math.min(offer.value, cartTotal);
        break;
      case 'FREE_SHIPPING':
        // This would be handled separately in shipping calculation
        discount = 0;
        break;
      default:
        discount = 0;
    }

    return {
      discount,
      finalPrice: cartTotal - discount,
      offer
    };
  } catch (error) {
    console.error('Error validating offer:', error);
    return { discount: 0, finalPrice: cartTotal };
  }
}

export async function incrementOfferUsage(offerId: string) {
  try {
    await db.offer.update({
      where: { id: offerId },
      data: {
        usedCount: {
          increment: 1
        }
      }
    });
  } catch (error) {
    console.error('Error incrementing offer usage:', error);
  }
}

export async function getActiveOffers() {
  try {
    const offers = await db.offer.findMany({
      where: {
        isActive: true,
        startsAt: { lte: new Date() },
        endsAt: { gte: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    return offers;
  } catch (error) {
    console.error('Error fetching active offers:', error);
    return [];
  }
}