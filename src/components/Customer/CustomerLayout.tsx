import React from 'react';
import { CustomerApp } from './CustomerApp';
import { Product, ProductVariant, StoreSettings, Transaction } from '../../types';

export interface CustomerLayoutProps {
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  initialServiceType?: 'Takeaway' | 'Delivery';
  onBackToStaffDashboard?: () => void;
  onOpenStaffLogin?: () => void;
  onOrderCreated?: (transaction: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * CustomerLayout - Dedicated public customer ordering layout for Warung Bang Kobra.
 * Completely isolated from internal POS/Owner workspace.
 * Accessible directly at /customer or /customer/* without requiring staff login.
 */
export const CustomerLayout: React.FC<CustomerLayoutProps> = (props) => {
  return <CustomerApp {...props} />;
};

export default CustomerLayout;
