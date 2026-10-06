import React from 'react';
import { Product, ProductVariant, StoreSettings, Transaction } from '../../types';
import { CustomerApp } from '../Customer/CustomerApp';

interface CustomerOrderViewProps {
  products: Product[];
  variants?: ProductVariant[];
  settings: StoreSettings;
  initialOrderType?: 'Takeaway' | 'Delivery' | 'BUNGKUS' | 'DELIVERY_DQM';
  onBackToApp?: () => void;
  onOrderCreated?: (transaction: Transaction) => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const CustomerOrderView: React.FC<CustomerOrderViewProps> = ({
  products,
  variants = [],
  settings,
  initialOrderType = 'Takeaway',
  onBackToApp,
  onOrderCreated,
  showToast,
}) => {
  const isDeliv =
    initialOrderType === 'Delivery' || initialOrderType === 'DELIVERY_DQM';

  return (
    <CustomerApp
      products={products}
      variants={variants}
      settings={settings}
      initialServiceType={isDeliv ? 'Delivery' : 'Takeaway'}
      onBackToStaffDashboard={onBackToApp}
      onOrderCreated={onOrderCreated}
      showToast={showToast}
    />
  );
};
