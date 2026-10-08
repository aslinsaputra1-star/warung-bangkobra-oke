import { StoreSettings } from '../types';

export type CustomerSubRoute = 'home' | 'menu' | 'cart' | 'checkout' | 'orders' | 'profile';
export type StoreSubRoute = 'dashboard' | 'pos' | 'orders' | 'preorders' | 'delivery' | 'wabot' | 'products' | 'reports' | 'settings' | 'login';

/**
 * Determine if current browser URL corresponds to the Customer Layout.
 * Checks paths like /customer, /customer/menu, /customer/cart, /customer/checkout
 * as well as legacy/campaign parameters like ?mode=customer, ?menu=public, ?order=delivery, ?wa_status=1, etc.
 */
export function isCustomerUrl(pathname?: string, search?: string): boolean {
  if (typeof window === 'undefined' && !pathname) return false;
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  const s = (search ?? (typeof window !== 'undefined' ? window.location.search : '')).toLowerCase();
  const h = (typeof window !== 'undefined' ? window.location.hash : '').toLowerCase();

  // Explicit customer paths
  if (
    p.startsWith('/customer') ||
    p === '/menu' ||
    p === '/order' ||
    p === '/pesan' ||
    p === '/cart' ||
    p === '/checkout' ||
    h.includes('customer') ||
    h.includes('/menu') ||
    h.includes('/cart') ||
    h.includes('/checkout')
  ) {
    return true;
  }

  // Explicit store paths take precedence over generic search queries
  if (
    p.startsWith('/store') ||
    p === '/pos' ||
    p === '/dashboard' ||
    p === '/admin' ||
    h.includes('store') ||
    h.includes('dashboard') ||
    h.includes('pos')
  ) {
    return false;
  }

  // Search parameters for customer ordering or campaign links
  if (
    s.includes('mode=customer') ||
    s.includes('view=customer') ||
    s.includes('menu=public') ||
    s.includes('menu=online') ||
    s.includes('mode=public') ||
    s.includes('order=') ||
    s.includes('mode=order') ||
    s.includes('scan=') ||
    s.includes('wa_status') ||
    s.includes('promo=') ||
    s.includes('utm_source=whatsapp') ||
    s.includes('utm_source=wa_status')
  ) {
    return true;
  }

  return false;
}

/**
 * Determine if current browser URL corresponds to the Store / Staff Layout (/store, /store/dashboard, etc.)
 */
export function isStoreUrl(pathname?: string): boolean {
  if (typeof window === 'undefined' && !pathname) return false;
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  const h = (typeof window !== 'undefined' ? window.location.hash : '').toLowerCase();
  return (
    p.startsWith('/store') ||
    p === '/pos' ||
    p === '/dashboard' ||
    p === '/admin' ||
    h.includes('store') ||
    h.includes('dashboard') ||
    h.includes('pos')
  );
}

/**
 * Parse sub-route from customer pathname (/customer/menu -> 'menu', /customer/cart -> 'cart', etc.)
 */
export function parseCustomerSubRoute(pathname?: string, search?: string): {
  tab: 'home' | 'menu' | 'cart' | 'orders' | 'profile';
  openCheckout: boolean;
  serviceType?: 'Takeaway' | 'Delivery';
} {
  const p = (pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')).toLowerCase();
  const s = (search ?? (typeof window !== 'undefined' ? window.location.search : '')).toLowerCase();

  const isDelivery =
    s.includes('order=delivery') ||
    s.includes('delivery=true') ||
    s.includes('mode=delivery') ||
    s.includes('deliv=1');

  const isTakeaway =
    s.includes('order=takeaway') ||
    s.includes('order=bungkus') ||
    s.includes('mode=takeaway');

  const serviceType: 'Takeaway' | 'Delivery' | undefined = isDelivery
    ? 'Delivery'
    : isTakeaway
    ? 'Takeaway'
    : undefined;

  if (p.includes('/customer/checkout') || p === '/checkout' || s.includes('action=checkout')) {
    return { tab: 'cart', openCheckout: true, serviceType };
  }
  if (p.includes('/customer/cart') || p === '/cart') {
    return { tab: 'cart', openCheckout: false, serviceType };
  }
  if (p.includes('/customer/menu') || p === '/menu' || s.includes('menu=')) {
    return { tab: 'menu', openCheckout: false, serviceType };
  }
  if (p.includes('/customer/orders') || p.includes('/customer/tracking') || s.includes('tab=orders')) {
    return { tab: 'orders', openCheckout: false, serviceType };
  }
  if (p.includes('/customer/profile')) {
    return { tab: 'profile', openCheckout: false, serviceType };
  }

  return { tab: 'home', openCheckout: false, serviceType };
}

/**
 * Build the canonical Customer URL to be shared via WhatsApp Status, social media, or QR codes.
 * GUARANTEED to always point to `/customer` (Customer Layout) and NEVER `/store`.
 */
export function getCustomerAppUrl(
  settings?: StoreSettings,
  subPath: string = '',
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  let base = '';
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    base = window.location.origin;
  } else if (settings?.customerAppUrl && settings.customerAppUrl.trim().length > 0) {
    base = settings.customerAppUrl.trim();
  } else {
    base = 'https://warungbangkobra.com';
  }

  // Ensure base has no trailing slash and never points to /store
  base = base.replace(/\/store.*$/i, '').replace(/\/+$/, '');

  // Build clean customer path
  let path = '/customer';
  if (subPath) {
    const cleanSub = subPath.replace(/^\/+/, '').replace(/\/+$/, '');
    if (cleanSub.startsWith('customer')) {
      path = `/${cleanSub}`;
    } else if (cleanSub.length > 0) {
      path = `/customer/${cleanSub}`;
    }
  }

  let fullUrl = `${base}${path}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.set(k, String(v));
      }
    });
    const qs = searchParams.toString();
    if (qs) {
      fullUrl += `?${qs}`;
    }
  }

  return fullUrl;
}

/**
 * Build the canonical Store URL (/store, /store/dashboard, /store/pos)
 */
export function getStoreAppUrl(subPath: string = 'dashboard'): string {
  let base = '';
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    base = window.location.origin;
  } else {
    base = 'https://warungbangkobra.com';
  }
  base = base.replace(/\/customer.*$/i, '').replace(/\/+$/, '');
  const cleanSub = subPath.replace(/^\/+/, '');
  return `${base}/store${cleanSub ? `/${cleanSub}` : ''}`;
}

/**
 * Synchronize the current browser URL path for Customer App navigation without refreshing
 */
export function syncCustomerUrl(subRoute: 'home' | 'menu' | 'cart' | 'checkout' | 'orders' | 'profile'): void {
  if (typeof window === 'undefined' || !window.history) return;
  const currentPath = window.location.pathname.toLowerCase();

  // Only update if currently on a customer URL or root
  if (currentPath.startsWith('/customer') || currentPath === '/' || currentPath === '/menu' || currentPath === '/cart') {
    const targetPath = subRoute === 'home' ? '/customer' : `/customer/${subRoute}`;
    if (window.location.pathname !== targetPath) {
      const search = window.location.search;
      window.history.replaceState({}, '', `${targetPath}${search}`);
    }
  }
}
