import type { StoreSettings } from '../types/index.ts';

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

export const VERCEL_PRODUCTION_DOMAIN = 'https://warung-bangkobra-oke.vercel.app';
export const VERCEL_CUSTOMER_URL = `${VERCEL_PRODUCTION_DOMAIN}/customer`;

/**
 * Resolve public production origin for customer-facing links.
 * Automatically eliminates localhost, 127.0.0.1, empty strings, and internal ephemeral preview URLs,
 * ensuring all WhatsApp Status, QR codes, and promo links ALWAYS direct to the live Customer Layout.
 */
export function getProductionBaseUrl(settings?: StoreSettings): string {
  // 1. Explicitly configured customerAppUrl in settings if valid & not localhost/preview
  if (settings?.customerAppUrl && typeof settings.customerAppUrl === 'string') {
    const trimmed = settings.customerAppUrl.trim();
    if (
      trimmed &&
      !trimmed.includes('localhost') &&
      !trimmed.includes('127.0.0.1') &&
      !trimmed.includes('ais-dev') &&
      !trimmed.includes('ais-pre')
    ) {
      return trimmed.replace(/\/customer.*$/i, '').replace(/\/store.*$/i, '').replace(/\/+$/, '');
    }
  }

  // 2. Check window.location if running in a real browser on the production Vercel domain or custom domain
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const origin = window.location.origin;
    const hostname = window.location.hostname.toLowerCase();
    if (
      hostname === 'warung-bangkobra-oke.vercel.app' ||
      (!hostname.includes('localhost') &&
        !hostname.includes('127.0.0.1') &&
        !hostname.includes('ais-dev') &&
        !hostname.includes('ais-pre') &&
        !hostname.includes('googleusercontent.com'))
    ) {
      return origin.replace(/\/customer.*$/i, '').replace(/\/store.*$/i, '').replace(/\/+$/, '');
    }
  }

  // 3. Guaranteed canonical production Vercel domain
  return VERCEL_PRODUCTION_DOMAIN;
}

/**
 * Build the canonical Customer URL to be shared via WhatsApp Status, social media, or QR codes.
 * GUARANTEED to always point to `/customer` (Customer Layout) on the production domain and NEVER `/store`.
 */
export function getCustomerAppUrl(
  settings?: StoreSettings,
  subPath: string = '',
  params?: Record<string, string | number | boolean | undefined | null>
): string {
  const base = getProductionBaseUrl(settings);

  // Build clean customer path (guaranteed to start with /customer)
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
  let base = VERCEL_PRODUCTION_DOMAIN;
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    const hostname = window.location.hostname.toLowerCase();
    if (
      hostname === 'warung-bangkobra-oke.vercel.app' ||
      (!hostname.includes('localhost') &&
        !hostname.includes('127.0.0.1') &&
        !hostname.includes('ais-dev') &&
        !hostname.includes('ais-pre') &&
        !hostname.includes('googleusercontent.com'))
    ) {
      base = window.location.origin;
    }
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
