# MUPSA Ekip Koordinasyon

MUPSA yönetim kurulu için mobil öncelikli ekip koordinasyon uygulaması.

Uygulama Cloudflare Pages üzerinde yayınlanır ve Supabase ile çalışır. Mevcut sürümde davet edilmiş kullanıcılar e-posta ve şifreyle giriş yapabilir; etkinlik, görev ve ekip koordinasyonu için temel çalışma akışları kullanılabilir.

## Mevcut özellikler

- E-posta ve şifre ile giriş, oturum yönetimi ve şifre değiştirme
- Aktif dönem üyeliği ve rol kontrollü erişim
- Süper Yönetici için dönem üyesi görüntüleme, ekleme, düzenleme ve pasifleştirme
- Etkinlik listeleme, oluşturma, temel bilgileri ve tarihleri düzenleme
- Etkinlik detayında süreç bilgileri, görevler, kararlar ve genel not
- Görev oluşturma, düzenleme, atama, durum ve not yönetimi
- Görevleri pasifleştirme ve yeniden aktifleştirme
- Dashboard özetleri ve uygulama içi bildirimler
- Bildirim kuyruğu, audit kayıtları ve PWA için temel kurulum dosyaları

## Henüz tamamlanmayanlar

- Rapor, dosya ve bağlantı yönetimi
- SKS süreç ekranları ve bütçe alanları
- Görev bağımlılıklarının kullanıcı arayüzü
- Gerçek e-posta ve web push bildirim gönderimi
- Yeni dönem oluşturma, dönem arşivi, dışa aktarma ve dönem kilidi ekranları
- Kişiye özel dashboard'ların tüm kapsamı ve görev şablonları

## Yerelde çalıştırma

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` dosyasında yalnızca şu yayınlanabilir değerler bulunmalıdır:

```text
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_WEB_PUSH_PUBLIC_KEY=...
```

`VITE_WEB_PUSH_PUBLIC_KEY` yalnızca Web Push için public VAPID anahtarıdır. VAPID private key ve `service_role` anahtarı frontend ortamına veya repoya eklenmemelidir.

`service_role` anahtarı tarayıcı uygulamasına veya repoya eklenmez. Güvenli kullanıcı oluşturma işlemi Supabase Edge Function üzerinden yürütülür.

## Giriş ve Supabase ayarı

Giriş yalnızca önceden davet edilmiş veya yetkili yönetici tarafından oluşturulmuş kullanıcılar içindir. Yeni kullanıcı kaydı herkese açık değildir.

Supabase Dashboard > Authentication > URL Configuration altında en az şu callback adresleri izinli olmalıdır:

- `http://localhost:5173/auth/callback`
- Canlı Cloudflare Pages adresinin `/auth/callback` adresi
- `https://mupsa-ekip-koordinasyon.vercel.app/auth/callback`

## Yayın ortamları

- Build command: `npm run build`
- Build output directory: `dist`

Uygulama Cloudflare Pages ve Vercel üzerinde yayınlanabilir. Her iki ortamda da `/app` ve `/auth/callback` gibi istemci tarafı adresleri için SPA geri dönüşü yapılandırılmalıdır.

Canlı adresler:

- [Cloudflare Pages](https://mupsa-ekip-koordinasyon.pages.dev)
- [Vercel](https://mupsa-ekip-koordinasyon.vercel.app)

Yayınlama adımları için [Cloudflare Pages yayın rehberine](docs/CLOUDFLARE_PAGES_YAYIN_REHBERI.md) bakın.

## Kontroller

```bash
npm run lint
npm run build
git diff --check
```

Güncel geliştirme durumu için [AI_DURUM.md](docs/AI_DURUM.md), ürün kararları ve geliştirme sırası için [master dokümanını](docs/MUPSA-Master-Dokuman.md) inceleyin.
