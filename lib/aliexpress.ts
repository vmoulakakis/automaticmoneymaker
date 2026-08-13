import { createHmac } from 'node:crypto';

const TOP_ENDPOINT = 'https://eco.taobao.com/router/rest';

type QueryInput = {
  keywords?: string;
  categoryIds?: string[];
  pageNo?: number;
  pageSize?: number;
  sort?: 'SALE_PRICE_ASC' | 'SALE_PRICE_DESC' | 'LAST_VOLUME_ASC' | 'LAST_VOLUME_DESC';
  deliveryDays?: '3' | '5' | '7' | '10';
  minSalePrice?: number;
  maxSalePrice?: number;
  shipToCountry?: string;
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function topTimestamp(): string {
  const china = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return china.toISOString().slice(0, 19).replace('T', ' ');
}

function signTopRequest(params: Record<string, string>, secret: string): string {
  const base = Object.entries(params)
    .filter(([key, value]) => key !== 'sign' && key && value)
    .sort(([a], [b]) => a.localeCompare(b, 'en'))
    .map(([key, value]) => `${key}${value}`)
    .join('');

  return createHmac('md5', secret).update(base, 'utf8').digest('hex').toUpperCase();
}

async function callTopApi(method: string, businessParams: Record<string, string | undefined>) {
  const appKey = env('ALIEXPRESS_APP_KEY');
  const secret = env('ALIEXPRESS_APP_SECRET');

  const params: Record<string, string> = {
    method,
    app_key: appKey,
    sign_method: 'hmac',
    timestamp: topTimestamp(),
    format: 'json',
    v: '2.0',
    partner_id: 'automaticmoneymaker',
  };

  const optionalAppSignature = process.env.ALIEXPRESS_APP_SIGNATURE;
  if (optionalAppSignature) params.app_signature = optionalAppSignature;

  for (const [key, value] of Object.entries(businessParams)) {
    if (value !== undefined && value !== '') params[key] = value;
  }

  params.sign = signTopRequest(params, secret);

  const response = await fetch(TOP_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
    body: new URLSearchParams(params),
    cache: 'no-store',
  });

  const json = await response.json();
  if (!response.ok || json.error_response) {
    throw new Error(`AliExpress API error: ${JSON.stringify(json.error_response ?? json)}`);
  }
  return json;
}

export async function queryAffiliateProducts(input: QueryInput = {}) {
  return callTopApi('aliexpress.affiliate.product.query', {
    keywords: input.keywords,
    category_ids: input.categoryIds?.join(','),
    page_no: String(input.pageNo ?? 1),
    page_size: String(Math.min(input.pageSize ?? 50, 50)),
    sort: input.sort ?? 'LAST_VOLUME_DESC',
    target_currency: process.env.ALIEXPRESS_TARGET_CURRENCY ?? 'EUR',
    target_language: process.env.ALIEXPRESS_TARGET_LANGUAGE ?? 'EN',
    ship_to_country: input.shipToCountry ?? process.env.ALIEXPRESS_TARGET_COUNTRY ?? 'GR',
    delivery_days: input.deliveryDays,
    min_sale_price: input.minSalePrice !== undefined ? String(input.minSalePrice) : undefined,
    max_sale_price: input.maxSalePrice !== undefined ? String(input.maxSalePrice) : undefined,
    tracking_id: process.env.ALIEXPRESS_TRACKING_ID,
  });
}

export async function queryHotProducts(input: QueryInput = {}) {
  return callTopApi('aliexpress.affiliate.hotproduct.query', {
    keywords: input.keywords,
    category_ids: input.categoryIds?.join(','),
    page_no: String(input.pageNo ?? 1),
    page_size: String(Math.min(input.pageSize ?? 50, 50)),
    sort: input.sort ?? 'LAST_VOLUME_DESC',
    target_currency: process.env.ALIEXPRESS_TARGET_CURRENCY ?? 'EUR',
    target_language: process.env.ALIEXPRESS_TARGET_LANGUAGE ?? 'EN',
    ship_to_country: input.shipToCountry ?? process.env.ALIEXPRESS_TARGET_COUNTRY ?? 'GR',
    delivery_days: input.deliveryDays,
    tracking_id: process.env.ALIEXPRESS_TRACKING_ID,
  });
}

export function extractProducts(payload: any): any[] {
  const result = payload?.aliexpress_affiliate_product_query_response?.resp_result?.result
    ?? payload?.aliexpress_affiliate_hotproduct_query_response?.resp_result?.result
    ?? payload?.resp_result?.result;
  return result?.products?.product ?? result?.products ?? [];
}
