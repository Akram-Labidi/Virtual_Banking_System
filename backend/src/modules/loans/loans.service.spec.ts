import { LoansService } from './loans.service';

describe('LoansService amortization', () => {
  const service = new LoansService(null, null, null, null, null);

  it('creates a cent-rounded schedule that pays off the principal', () => {
    const result = service.calculateSimulation({
      principalAmount: 10000,
      annualInterestRate: 3.8,
      termMonths: 24,
    });

    expect(result.schedule).toHaveLength(24);
    expect(result.schedule[23].remainingBalance).toBe(0);
    expect(result.schedule.reduce((sum, item) => sum + item.principalPayment, 0)).toBeCloseTo(
      10000,
      2,
    );
    expect(result.totalCost).toBeCloseTo(10000 + result.totalInterest, 2);
    expect(result.schedule.every((item) => Number.isInteger(item.monthlyPayment * 100))).toBe(
      true,
    );
  });
});
