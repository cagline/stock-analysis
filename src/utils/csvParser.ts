export interface OrderRecord {
  orderID: string;
  orderDate: string;
  orderDateTime: string;
  security: string;
  side: 'BUY' | 'SELL';
  orderQty: number;
  orderPrice: number;
  orderStatus: string;
  notes: string;
}