export class PricingService {
  static calculateFinalPrice(member, family, activity, siblingCount = 0) {
    const quote = this.generateQuote(member, family, activity, siblingCount);
    return quote.finalPrice;
  }

  static generateQuote(member, family, activity, siblingCount = 0) {
    const basePrice = parseFloat(activity.base_price);
    const discounts = [];
    let price = basePrice;

    if (!member.is_resident) {
      const surcharge = price * 0.35;
      price = price + surcharge;
      discounts.push({
        label: 'Majoration non-résident (+35%)',
        amount: surcharge,
        type: 'surcharge'
      });
    }

    if (family && family.quotient_familial) {
      const qf = parseFloat(family.quotient_familial);
      if (qf < 600) {
        const reduction = price * 0.40;
        discounts.push({
          label: 'Bourse municipale QF < 600€ (-40%)',
          amount: -reduction,
          type: 'discount'
        });
        price = price - reduction;
      } else if (qf <= 900) {
        const reduction = price * 0.20;
        discounts.push({
          label: 'Bourse municipale 600€ ≤ QF ≤ 900€ (-20%)',
          amount: -reduction,
          type: 'discount'
        });
        price = price - reduction;
      }
    }

    if (siblingCount === 1) {
      const reduction = price * 0.15;
      discounts.push({
        label: 'Dégressivité familiale 2ème inscription (-15%)',
        amount: -reduction,
        type: 'discount'
      });
      price = price - reduction;
    } else if (siblingCount >= 2) {
      const reduction = price * 0.30;
      discounts.push({
        label: 'Dégressivité familiale 3ème+ inscription (-30%)',
        amount: -reduction,
        type: 'discount'
      });
      price = price - reduction;
    }

    if (member.passport_code) {
      const passSportAmount = Math.min(50.00, price - 15.00);
      if (passSportAmount > 0) {
        discounts.push({
          label: 'Subvention Pass\'Sport (-50€)',
          amount: -passSportAmount,
          type: 'discount'
        });
        price = price - passSportAmount;
      }
    }

    const MINIMUM_PRICE = 15.00;
    const finalPrice = parseFloat(Math.max(price, MINIMUM_PRICE).toFixed(2));

    if (price < MINIMUM_PRICE) {
      discounts.push({
        label: 'Tarif plancher appliqué (minimum 15€)',
        amount: MINIMUM_PRICE - price,
        type: 'adjustment'
      });
    }

    return {
      basePrice,
      isResident: member.is_resident,
      quotientFamilial: family?.quotient_familial || null,
      siblingCount,
      hasPassSport: !!member.passport_code,
      discounts,
      finalPrice
    };
  }

  static generatePaymentSchedule(finalPrice, installments = 3) {
    if (installments === 1) {
      return [{
        installment: 1,
        dueDate: new Date().toISOString().split('T')[0],
        amount: finalPrice
      }];
    }

    const firstPayment = parseFloat((finalPrice * 0.40).toFixed(2));
    const secondPayment = parseFloat((finalPrice * 0.30).toFixed(2));
    const thirdPayment = parseFloat((finalPrice - firstPayment - secondPayment).toFixed(2));

    const today = new Date();
    const month2 = new Date(today);
    month2.setMonth(month2.getMonth() + 1);
    const month3 = new Date(today);
    month3.setMonth(month3.getMonth() + 2);

    return [
      { installment: 1, dueDate: today.toISOString().split('T')[0], amount: firstPayment },
      { installment: 2, dueDate: month2.toISOString().split('T')[0], amount: secondPayment },
      { installment: 3, dueDate: month3.toISOString().split('T')[0], amount: thirdPayment }
    ];
  }
}