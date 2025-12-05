import type { NextApiRequest, NextApiResponse } from 'next'

/**
 * Magento Webhook Handler
 * 
 * This endpoint receives webhooks from Magento when products, categories, or pages are updated.
 * 
 * Webhook payload example:
 * {
 *   "entity": "product",
 *   "action": "update",
 *   "data": {
 *     "sku": "PRODUCT-SKU",
 *     "url_key": "product-url-key"
 *   }
 * }
 * 
 * Setup in Magento:
 * 1. Go to System > Webhooks
 * 2. Create new webhook
 * 3. URL: https://your-domain.com/api/webhook/magento
 * 4. Events: catalog_product_save_after, catalog_category_save_after, cms_page_save_after
 * 5. Add secret token in REVALIDATE_SECRET env variable
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{ success: boolean; message?: string } | { error: string }>,
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Secret kontrolü kaldırıldı - webhook her zaman kabul ediliyor

  try {
    const { entity, action, data } = req.body

    if (!entity || !action) {
      return res.status(400).json({ error: 'Missing entity or action' })
    }

    const paths: string[] = []

    // Handle product updates
    if (entity === 'product') {
      // Product sayfasını revalidate et
      if (data?.url_key) {
        paths.push(`/p/${data.url_key}`)
      }
      
      // Eğer url_key yoksa SKU'dan path oluştur (gerekirse GraphQL'den alınabilir)
      if (!data?.url_key && data?.sku) {
        // SKU'dan url_key almak için GraphQL query gerekebilir
        // Şimdilik sadece url_key varsa revalidate ediyoruz
        console.warn(`[Webhook] Product SKU provided but no url_key: ${data.sku}`)
      }
    }

    // Handle category updates
    if (entity === 'category') {
      // Category sayfasını revalidate et
      if (data?.url_path) {
        // url_path zaten / ile başlıyorsa direkt kullan, değilse ekle
        const categoryPath = data.url_path.startsWith('/') ? data.url_path : `/${data.url_path}`
        paths.push(categoryPath)
      }
      
      // Eğer url_path yoksa uid'den path oluştur (gerekirse GraphQL'den alınabilir)
      if (!data?.url_path && data?.uid) {
        console.warn(`[Webhook] Category UID provided but no url_path: ${data.uid}`)
      }
    }

    // Handle CMS page updates
    if (entity === 'page' || entity === 'cms_page') {
      // CMS sayfasını revalidate et
      if (data?.identifier) {
        // Identifier'dan path oluştur (genellikle identifier = path)
        paths.push(`/${data.identifier}`)
      }
    }

    // Handle layout/menu updates - Tüm sayfaları revalidate et
    if (entity === 'menu' || entity === 'layout') {
      // Layout değiştiğinde tüm sayfaları revalidate etmek için
      // özel bir endpoint veya tüm path'leri listelemek gerekebilir
      console.log(`[Webhook] Layout/Menu updated - requires full site revalidation`)
      // Şimdilik sadece log, gerekirse tüm path'leri revalidate edebilirsiniz
    }

    if (paths.length === 0) {
      return res.status(400).json({ error: 'Unknown entity type or missing path data' })
    }

    // Path'leri revalidate et
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'
    
    const revalidatedPaths: string[] = []
    
    for (const path of paths) {
      try {
        const params = new URLSearchParams()
        params.append('path', path)

        const response = await fetch(`${baseUrl}/api/revalidate?${params.toString()}`, {
          method: 'GET',
        })

        if (response.ok) {
          revalidatedPaths.push(path)
          console.log(`[Webhook] Revalidated path: ${path}`)
        } else {
          console.error(`[Webhook] Failed to revalidate path: ${path}`, await response.text())
        }
      } catch (error) {
        console.error(`[Webhook] Error revalidating path: ${path}`, error)
      }
    }

    console.log(`[Webhook] Revalidated ${revalidatedPaths.length}/${paths.length} paths for ${entity}:${action}`, {
      entity,
      action,
      paths: revalidatedPaths,
      data,
    })

    return res.json({
      success: true,
      message: `Revalidated ${revalidatedPaths.length} paths`,
    })
  } catch (error) {
    console.error('[Webhook Error]', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

