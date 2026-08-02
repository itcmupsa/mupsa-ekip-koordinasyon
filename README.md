# MUPSA Ekip Koordinasyon

MUPSA yönetim kurulu için mobil öncelikli ekip koordinasyon uygulaması.

Bu sürüm, Faz 1'in **web temelini** içerir: kişisel e-posta ile magic-link girişi, oturum yönetimi ve korumalı uygulama kabuğu. Etkinlik, görev, SKS, karar, bütçe ve bildirim ekranları henüz eklenmemiştir.

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` dosyasına yalnızca şu yayınlanabilir değerler girilir:

```text
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
```

`service_role` anahtarı hiçbir zaman tarayıcı uygulamasına veya repoya eklenmez.

## Giriş ve Supabase ayarı

Giriş, yalnızca önceden davet edilmiş kullanıcılar için kişisel e-posta magic link'iyle yapılır; uygulama yeni kullanıcı hesabı oluşturmaz. Supabase Dashboard > Authentication > URL Configuration altında en az şunlar izinli olmalıdır:

- `http://localhost:5173/auth/callback`
- Canlı Cloudflare Pages adresinin `/auth/callback` adresi

## Cloudflare Pages

- Build command: `npm run build`
- Build output directory: `dist`

Cloudflare Pages, bu uygulamada `/app` ve `/auth/callback` gibi istemci tarafı adresleri için kendi SPA geri dönüşünü kullanır.

**Yayınlama:** Adım adım, teknik bilgi gerektirmeyen yayın rehberi için [Cloudflare Pages yayın rehberine](docs/CLOUDFLARE_PAGES_YAYIN_REHBERI.md) bakın.

## Kontroller

```bash
npm run lint
npm run build
```

Proje kararları ve geliştirme sırası için [master dokümanı](docs/MUPSA-Master-Dokuman.md) inceleyin.
