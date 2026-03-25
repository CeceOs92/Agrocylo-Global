export interface ParsedEscrowEvent {
  action: string;
  orderId: string;
  buyer: string;
  seller: string;
  amount: string;
  token?: string;
  ledger: number;
  eventIndex: number;
  timestamp: number;
}

export interface MappedEscrowEvent {
  orderId: string;
  buyer: string;
  seller: string;
  amount: string;
  token: string;
  status: string;
  ledger: number;
  eventIndex: number;
  timestamp: Date;
}
