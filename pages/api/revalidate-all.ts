import type { NextApiRequest, NextApiResponse } from 'next'
import { getProductStaticPaths } from '@graphcommerce/magento-product'
import { getCategoryStaticPaths } from '@graphcommerce/magento-category'
import { graphqlSsrClient } from '../../lib/graphql/graphqlSsrClient'
import { productPath } from '@graphcommerce/magento-product'
import { productListLink } from '@graphcommerce/magento-product'
import { staticPathsToString } from '@graphcommerce/next-ui'

type RevalidateAllResponse = {
  success: boolean
  message: string
  revalidated: {
    products: number
    categories: number
    total: number
  }
  errors?: string[]
}

/**
 * Tüm sayfaları revalidate eden endpoint
 * 
 * İlk deploy'dan sonra tüm sayfaları pre-generate etmek için kullanılır.
 * 
 * Kullanım:
 * - GET /api/revalidate-all - Tüm sayfaları revalidate et
 * - POST /api/revalidate-all - Tüm sayfaları revalidate et (body'de locale belirtilebilir)
 * 
 * Vercel'de deploy sonrası otomatik çağırmak için:
 * - Vercel Dashboard > Settings > Git > Deploy Hooks
 * - Veya Vercel CLI ile: vercel --prod && curl https://your-domain.com/api/revalidate-all
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RevalidateAllResponse | { error: string }>,
) {
  // Sadece GET ve POST isteklerine izin ver
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const baseUrl = "https://next-graphcommerce-git-main-baris-projects-cd65e612.vercel.app" 
    // Config'den locale'leri al, default 'tr'
    const locales = req.body?.locales || ['tr']
    
    console.log('[RevalidateAll] Starting revalidation for all pages', { locales, baseUrl })

    const allPaths: string[] = []
    const errors: string[] = []

    // Tüm locale'ler için product ve category path'lerini al
    for (const locale of locales) {
      try {
        const client = graphqlSsrClient({ locale })
        
        // Product paths
        const productRoutes = await getProductStaticPaths(client, locale, { limit: false })
        const productPaths = productRoutes
          .map(staticPathsToString)
          .map((path) => {
            const p = productPath(path)
            // productPath zaten "/" ile başlıyor, emin olmak için kontrol et
            return p.startsWith('/') ? p : `/${p}`
          })
        
        // Category paths
        const categoryRoutes = await getCategoryStaticPaths(client, locale, { limit: false })
        const categoryPaths = categoryRoutes
          .map(staticPathsToString)
          .map((url) => {
            const p = productListLink({ url, filters: {}, sort: {} })
            // productListLink zaten "/" ile başlıyor, emin olmak için kontrol et
            return p.startsWith('/') ? p : `/${p}`
          })
        
        allPaths.push(...productPaths, ...categoryPaths)
        console.log(`[RevalidateAll] Found ${productPaths.length} products and ${categoryPaths.length} categories for locale: ${locale}`)
      } catch (error) {
        const errorMsg = `Error fetching paths for locale ${locale}: ${error instanceof Error ? error.message : String(error)}`
        console.error(`[RevalidateAll] ${errorMsg}`)
        errors.push(errorMsg)
      }
    }

    // Duplicate'leri kaldır
    const uniquePaths = [...new Set(allPaths)]
    console.log(`[RevalidateAll] Total unique paths to revalidate: ${uniquePaths.length}`)

    // Her path'i revalidate et
    let revalidatedCount = 0
    const batchSize = 10 // Aynı anda 10 path revalidate et
    
    for (let i = 0; i < uniquePaths.length; i += batchSize) {
      const batch = uniquePaths.slice(i, i + batchSize)
      
      await Promise.all(
        batch.map(async (path) => {
          try {
            const params = new URLSearchParams()
            params.append('path', path)

            const response = await fetch(`${baseUrl}/api/revalidate?${params.toString()}`, {
              method: 'GET',
            })

            if (response.ok) {
              revalidatedCount++
              if (revalidatedCount % 50 === 0) {
                console.log(`[RevalidateAll] Progress: ${revalidatedCount}/${uniquePaths.length} paths revalidated`)
              }
            } else {
              const errorText = await response.text()
              errors.push(`Failed to revalidate ${path}: ${errorText}`)
            }
          } catch (error) {
            errors.push(`Error revalidating ${path}: ${error instanceof Error ? error.message : String(error)}`)
          }
        })
      )
    }

    const productCount = uniquePaths.filter(p => p.startsWith('/p/')).length
    const categoryCount = uniquePaths.filter(p => !p.startsWith('/p/') && p !== '/').length

    console.log(`[RevalidateAll] Completed: ${revalidatedCount}/${uniquePaths.length} paths revalidated`)

    return res.json({
      success: true,
      message: `Revalidated ${revalidatedCount} out of ${uniquePaths.length} paths`,
      revalidated: {
        products: productCount,
        categories: categoryCount,
        total: revalidatedCount,
      },
      ...(errors.length > 0 && { errors: errors.slice(0, 10) }), // İlk 10 hatayı göster
    })
  } catch (error) {
    console.error('[RevalidateAll Error]', error)
    return res.status(500).json({ 
      error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` 
    })
  }
}

