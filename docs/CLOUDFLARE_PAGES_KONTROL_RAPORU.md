# Cloudflare Pages Yayın Hazırlığı — Kontrol Raporu

**Tarih:** 2026-08-03  
**Kapsam:** Yayın yapılandırmasının ve dokümantasyonunun doğrulanması.

## Statik site uyumluluğu

Uygulama `npm run build` ile `dist/` klasörüne statik dosyalar üretir. Sunucu tarafı çalışma zamanına ihtiyaç duymaz ve Cloudflare Pages için uygundur.

Cloudflare Pages, bu projede React Router adreslerini otomatik SPA geri dönüş mekanizmasıyla destekler. Eski `_redirects` kuralı Cloudflare tarafından döngü riskiyle yok sayıldığı için projede tutulmaz.

## Ortam değişkenleri

`.env.example` yalnızca gereken yayınlanabilir Supabase değişkenlerini içerir:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Gerçek değer veya gizli anahtar içermez. `VITE_` değişkenleri tarayıcı derlemesine dahil olur; bu nedenle yalnızca publishable anahtar kullanılmalıdır.

## Sonuç

Uygulama Cloudflare Pages'e bağlanmaya hazırdır. Canlı yayın öncesinde Cloudflare ortam değişkenleri ile Supabase Authentication yönlendirme adresleri, yayın rehberindeki sırayla ayarlanmalıdır.
