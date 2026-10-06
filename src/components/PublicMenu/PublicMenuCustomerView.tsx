import React from 'react';
import { Product, ProductVariant, StoreSettings, Transaction } from '../../types';
import { CustomerApp } from '../Customer/CustomerApp';

export interface CartEntry {
  cartKey: string;
  product: Product;
  variant?: ProductVariant;
  qty: number;
  notes: string;
}

interface PublicMenuCustomerViewProps {
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  onOpenStaffLogin?: () => void;
  onOrderCreated?: (transaction: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const PublicMenuCustomerView: React.FC<PublicMenuCustomerViewProps> = ({
  products,
  variants = [],
  settings,
  onOpenStaffLogin,
  onOrderCreated,
  showToast,
}) => {
  return (
    <CustomerApp
      products={products}
      variants={variants}
      settings={settings}
      onOpenStaffLogin={onOpenStaffLogin}
      onOrderCreated={onOrderCreated}
      showToast={showToast}
    />
  );
};
