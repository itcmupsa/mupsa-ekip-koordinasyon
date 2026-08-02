# Cloudflare Pages Yayın Hazırlığı — Kontrol Raporu

**Tarih:** 2026-08-03  
**Kapsam:** Yayın yapılandırmasının ve dokümantasyonunun doğrulanması.

## Statik site uyumluluğu

Uygulama `npm run build` ile `dist/` klasörüne statik dosyalar üretir. Sunucu tarafı çalışma zamanına ihtiyaç duymaz ve Cloudflare Pages için uygundur.

`public/_redirects` dosyasındaki aşağıdaki kural, React Router adreslerinin doğrudan açılmasını ve sayfa yenilemesini destekler:

```text
/*    /index.html   200
```

## Ortam değişkenleri

`.env.example` yalnızca gereken yayınlanabilir Supabase değişkenlerini içerir:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Gerçek değer veya gizli anahtar içermez. `VITE_` değişkenleri tarayıcı derlemesine dahil olur; bu nedenle yalnızca publishable anahtar kullanılmalıdır.

## Sonuç

Uygulama Cloudflare Pages'e bağlanmaya hazırdır. Canlı yayın öncesinde Cloudflare ortam değişkenleri ile Supabase Authentication yönlendirme adresleri, yayın rehberindeki sırayla ayarlanmalıdır.
