export enum UserRole {
  CLIENT = 'CLIENT',
  ADVISOR = 'ADVISOR',
  ADMIN = 'ADMIN',
}

export enum AccountType {
  CHECKING = 'CHECKING', // Compte courant
  SAVINGS = 'SAVINGS',   // Compte épargne
  INTERNAL_CASH = 'INTERNAL_CASH', // Réserve centrale de la banque (pour dépôts/retraits en cash)
  INTERNAL_FEES = 'INTERNAL_FEES', // Compte de frais perçus par la banque
  INTERNAL_LOANS = 'INTERNAL_LOANS', // Compte d'émission des crédits
  INTERNAL_EQUITY = 'INTERNAL_EQUITY', // Capital interne de la banque
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  CLOSED = 'CLOSED',
}

export enum TransactionType {
  TRANSFER = 'TRANSFER',
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
  LOAN_DISBURSEMENT = 'LOAN_DISBURSEMENT',
  LOAN_REPAYMENT = 'LOAN_REPAYMENT',
  CARD_PAYMENT = 'CARD_PAYMENT',
  FEE = 'FEE',
  CAPITALIZATION = 'CAPITALIZATION',
}

export enum TransactionStatus {
  COMPLETED = 'COMPLETED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  FLAGGED_FRAUD = 'FLAGGED_FRAUD',
}

export enum PostingDirection {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum CardStatus {
  ACTIVE = 'ACTIVE',
  FROZEN = 'FROZEN',
  BLOCKED = 'BLOCKED',
  EXPIRED = 'EXPIRED',
}

export enum LoanStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ACTIVE = 'ACTIVE',
  PAID_OFF = 'PAID_OFF',
  REJECTED = 'REJECTED',
}

export enum FraudSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}
