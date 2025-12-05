import type { NextApiRequest, NextApiResponse } from 'next'

type RevalidateResponse = {
  revalidated: boolean
  now: number
  message?: string
}

/**
 * On-demand revalidation API endpoint
 * 
 * Usage:
 * - Revalidate by tag: /api/revalidate?tag=product&tag=category
 * - Revalidate by path: /api/revalidate?path=/p/product-url
 * - Revalidate with secret: /api/revalidate?secret=YOUR_SECRET&tag=product
 * 
 * Tags:
 * - product: Revalidate all product pages
 * - product:{sku}: Revalidate specific product
 * - category: Revalidate all category pages
 * - category:{uid}: Revalidate specific category
 * - page: Revalidate CMS pages
 * - layout: Revalidate layout data
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RevalidateResponse | { error: string }>,
) {
  // Check for secret token to prevent unauthorized access
  if (process.env.REVALIDATE_SECRET) {
    const secret = req.query.secret || req.headers['x-revalidate-secret']
    if (secret !== process.env.REVALIDATE_SECRET) {
      return res.status(401).json({ error: 'Invalid secret token' })
    }
  }

  try {
    const { tag, path: pathToRevalidate } = req.query

      // Revalidate by path(s) - Pages Router compatible
    if (pathToRevalidate) {
      const paths = Array.isArray(pathToRevalidate) ? pathToRevalidate : [pathToRevalidate]
      
      // Next.js Pages Router'da on-demand revalidation için
      // res.revalidate() kullanılır (Next.js 12.2+)
      const revalidatedPaths: string[] = []
      
      for (const p of paths) {
        if (typeof p === 'string') {
          try {
            // Pages Router: res.revalidate() kullan
            await res.revalidate(p)
            revalidatedPaths.push(p)
            console.log(`[Revalidate] Path: ${p}`)
          } catch (error) {
            console.error(`[Revalidate Error] Failed to revalidate path: ${p}`, error)
          }
        }
      }

      return res.json({
        revalidated: true,
        now: Date.now(),
        message: `Revalidated ${revalidatedPaths.length} paths: ${revalidatedPaths.join(', ')}`,
      })
    }

    // Revalidate by tag(s) - Convert tags to paths
    if (tag) {
      const tags = Array.isArray(tag) ? tag : [tag]
      const paths: string[] = []
      
      // Tag'leri path'lere çevir
      for (const t of tags) {
        if (typeof t === 'string') {
          // Product tag'leri için path oluştur
          if (t.startsWith('product:')) {
            const skuOrUrl = t.replace('product:', '')
            // SKU veya URL key'e göre path oluştur
            // Bu bilgiyi cache'den veya database'den almanız gerekebilir
            paths.push(`/p/${skuOrUrl}`)
          } else if (t.startsWith('category:')) {
            const uidOrUrl = t.replace('category:', '')
            paths.push(`/${uidOrUrl}`)
          } else if (t === 'product') {
            // Tüm ürünleri revalidate etmek için özel bir endpoint gerekebilir
            console.log(`[Revalidate] Tag: ${t} - All products (requires manual path list)`)
          } else if (t === 'category') {
            // Tüm kategorileri revalidate etmek için özel bir endpoint gerekebilir
            console.log(`[Revalidate] Tag: ${t} - All categories (requires manual path list)`)
          } else {
            console.log(`[Revalidate] Tag: ${t}`)
          }
        }
      }

      // Path'leri revalidate et
      const revalidatedPaths: string[] = []
      for (const p of paths) {
        try {
          await res.revalidate(p)
          revalidatedPaths.push(p)
        } catch (error) {
          console.error(`[Revalidate Error] Failed to revalidate path: ${p}`, error)
        }
      }

      return res.json({
        revalidated: true,
        now: Date.now(),
        message: `Revalidated ${revalidatedPaths.length} paths from tags: ${tags.join(', ')}`,
      })
    }

    return res.status(400).json({ error: 'Missing tag or path parameter' })
  } catch (err) {
    console.error('[Revalidate Error]', err)
    return res.status(500).json({ error: 'Error revalidating' })
  }
}

