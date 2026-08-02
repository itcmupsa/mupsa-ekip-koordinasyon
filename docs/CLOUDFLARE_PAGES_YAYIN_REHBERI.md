# Cloudflare Pages Yayın Rehberi

Bu rehber, kod bilmeyen biri için adım adım hazırlandı. Amaç, `onndd/mupsa-ekip-koordinasyon` reposundaki web uygulamasını Cloudflare Pages üzerinde canlıya almaktır.

Bu rehber yalnızca **yayınlama** adımlarını anlatır. Uygulamanın ekranları ve giriş sistemi burada değiştirilmez.

## 1. GitHub reposunu Cloudflare Pages'e bağlama

1. [dash.cloudflare.com](https://dash.cloudflare.com) adresine git ve hesabına giriş yap. Hesabın yoksa ücretsiz oluşturabilirsin.
2. Sol menüden **Workers & Pages**'e tıkla.
3. **Create** → **Pages** → **Connect to Git** seçeneğine tıkla.
4. GitHub hesabını bağlama izni istenirse izin ver; sonra listeden `onndd/mupsa-ekip-koordinasyon` reposunu seç.
5. **Begin setup** butonuna tıkla.

## 2. Build ayarları

Cloudflare'ın kurulum ekranında şu ayarları gir:

| Alan | Değer |
| --- | --- |
| Framework preset | Vite varsa onu seç; yoksa None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | Boş bırak |

Build hatası alırsan, Cloudflare'in **Environment variables** bölümüne `NODE_VERSION` değerini `20` olarak ekleyebilirsin.

## 3. Ortam değişkenlerini ekleme

Kurulum ekranında veya sonradan **Settings → Environment variables** bölümünde şu iki değişkeni ekle:

| Değişken adı | Değer |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API'den kopyala |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Aynı sayfadaki **publishable** anahtarı kopyala |

Bu değerleri hem **Production** hem **Preview** ortamına eklemek uygundur.

> `service_role` gibi gizli Supabase anahtarlarını buraya kesinlikle ekleme. `VITE_` ile başlayan değişkenler derleme sonunda tarayıcıya gönderilen JavaScript içinde görünür. Buraya yalnızca bu amaçla tasarlanan publishable anahtar girilebilir.

## 4. İlk yayını başlatma ve site adresini alma

1. **Save and Deploy** butonuna tıkla.
2. Cloudflare projeyi derleyip birkaç dakika içinde yayınlar.
3. İşlem sonunda `https://mupsa-ekip-koordinasyon.pages.dev` benzeri bir adres verilir. Bu adres proje adına göre değişebilir.
4. Bu adresi not al; bir sonraki adımda Supabase'e eklenecek.

İleride **Custom domains** bölümünden kulübe ait bir alan adı da bağlanabilir; ilk yayın için gerekli değildir.

## 5. Supabase Authentication ayarını güncelleme

Magic Link e-postasının doğru adrese dönmesi için:

1. [supabase.com](https://supabase.com) üzerinden MUPSA projesini aç.
2. **Authentication** → **URL Configuration** bölümüne git.
3. **Site URL** alanına Cloudflare'in verdiği adresi yaz.
4. **Redirect URLs** listesine aşağıdaki biçimde bir adres ekle:

   ```text
   https://SITE-ADRESI/auth/callback
   ```

5. Yerelde geliştirmeye devam edilecekse `http://localhost:5173/auth/callback` adresini de listede bırak.
6. **Save** ile kaydet.

## 6. Yayından sonra giriş testi

1. Cloudflare'in verdiği adresi aç.
2. Giriş ekranına önceden davet edilmiş kişisel e-posta adresini yazıp **Giriş bağlantısı gönder** seçeneğine tıkla.
3. E-posta kutusu ile spam/gereksiz klasörünü kontrol et.
4. Gelen bağlantıyı aç. Uygulama seni `/app` ekranına yönlendirmelidir.
5. Aktif dönem üyeliği varsa kullanıcı dönem bilgisini görür. Yoksa hesabın açık ancak aktif dönem yetkisinin tanımlanmadığını belirten mesaj görünür; bu bir hata değildir.

## 7. Güvenlik hatırlatması

- `.env.local` dosyasını GitHub'a yükleme. Projedeki `.gitignore` bunu normalde engeller.
- Supabase URL'si ve publishable anahtar gizli değildir; tarayıcı uygulamasında kullanılmak üzere tasarlanmıştır.
- `service_role`, veritabanı parolası veya başka gizli anahtarları repoya, Cloudflare değişkenlerine ya da tarayıcı uygulamasına ekleme.
