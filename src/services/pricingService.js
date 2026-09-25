export class PricingService {
  static calculateFinalPrice(member, family, activity, siblingCount = 0) {
    let price = parseFloat(activity.base_price);

    if (!member.is_resident) {
      price = price * 1.35;
    }

    if (family && family.quotient_familial) {
      const qf = parseFloat(family.quotient_familial);
      if (qf < 600) {
        price = price * 0.70;
      } else if (qf <= 900) {
        price = price * 0.85; 
      }
    }

    if (siblingCount > 0) {
      price = price * 0.90; 
    }

    if (member.pass_sport_code) {
      price = price - 50.00;
    }

    const MINIMUM_PRICE = 15.00;
    const finalPrice = Math.max(price, MINIMUM_PRICE);

    return parseFloat(finalPrice.toFixed(2));
  }
}