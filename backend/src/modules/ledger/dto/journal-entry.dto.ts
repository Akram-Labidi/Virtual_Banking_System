import { PostingDirection, TransactionType } from '../../../common/enums';

export interface LedgerPostingItem {
  accountId: string;
  direction: PostingDirection;
  amount: number;
}

export interface CreateJournalEntryDto {
  idempotencyKey?: string;
  reference?: string;
  transactionType: TransactionType;
  description: string;
  metadata?: Record<string, any>;
  postings: LedgerPostingItem[];
}
