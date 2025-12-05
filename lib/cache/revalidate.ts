export const REVALIDATE_TAGS = {

  PRODUCT: 'product',
  PRODUCT_BY_SKU: (sku: string) => `product:${sku}`,
  PRODUCT_BY_URL: (urlKey: string) => `product:url:${urlKey}`,
  
  CATEGORY: 'category',
  CATEGORY_BY_UID: (uid: string) => `category:${uid}`,
  CATEGORY_BY_URL: (urlPath: string) => `category:url:${urlPath}`,
  
  PAGE: 'page',
  PAGE_BY_IDENTIFIER: (identifier: string) => `page:${identifier}`,
  
  LAYOUT: 'layout',
  MENU: 'menu',
  
  ALL: 'all',
} as const


export async function revalidateByTag(tag: string | string[], secret?: string) {
  const tags = Array.isArray(tag) ? tag : [tag]
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  
  const params = new URLSearchParams()
  tags.forEach(t => params.append('tag', t))
  if (secret) {
    params.append('secret', secret)
  }

  try {
    const response = await fetch(`${baseUrl}/api/revalidate?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...(secret && { 'x-revalidate-secret': secret }),
      },
    })

    if (!response.ok) {
      throw new Error(`Revalidation failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Revalidate Error]', error)
    throw error
  }
}

/**
 * Trigger revalidation for a specific path
 */
export async function revalidateByPath(path: string | string[], secret?: string) {
  const paths = Array.isArray(path) ? path : [path]
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  
  const params = new URLSearchParams()
  paths.forEach(p => params.append('path', p))
  if (secret) {
    params.append('secret', secret)
  }

  try {
    const response = await fetch(`${baseUrl}/api/revalidate?${params.toString()}`, {
      method: 'GET',
      headers: {
        ...(secret && { 'x-revalidate-secret': secret }),
      },
    })

    if (!response.ok) {
      throw new Error(`Revalidation failed: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('[Revalidate Error]', error)
    throw error
  }
}

