# MUPSA — Güncel Geliştirme Durumu

Bu dosya, proje bağlamının güncel durum kaydıdır. Bir görev tamamlandığında yalnızca bu dosyadaki ilgili bölümleri güncelle; `AI_BAGLAM.md` dosyasını yalnızca kalıcı karar değiştiğinde değiştir.

**Son güncelleme:** 3 Ağustos 2026

## Canlı sistem

- Canlı web adresi: https://mupsa-ekip-koordinasyon.pages.dev
- Barındırma: Cloudflare Pages
- Kaynak dal: GitHub `main`
- İlk canlı derleme başarılı oldu.
- Canlı giriş ekranı ve `/auth/callback` route'u test edildi.

## Tamamlananlar

### Supabase ve veritabanı

Supabase projesi açıldı ve Faz 1 veritabanı altyapısı gerçek projeye uygulandı.

Uygulanan migration konuları:

1. Temel veritabanı şeması, referans veriler ve RLS
2. `period_memberships` değişiklikleri için audit kaydı
3. Görev ataması bildirimi
4. Web Push aboneliği için `push_subscriptions` tablosu
5. SKS durum değişikliği bildirimi
6. Bağımlı görevin etkinleşmesi bildirimi
7. Etkinlik tarihi değişikliği bildirimi
8. Zamanlanmış gecikme, yaklaşan tarih ve tarih bağımlılığı taraması

Tüm migration'lar yerel Supabase CLI kayıtları ile uzak veritabanı kayıtlarında eşitlenmiş ve doğrulanmıştır. `pg_cron` etkinleştirilmiştir.

Bildirim altyapısı şu anda veritabanında `notifications` kuyruğuna kayıt üretir. Gerçek e-posta gönderimi ve gerçek web push gönderimi henüz yapılmadı.

### Web temeli

Şu özellikler çalışır durumda:

- Vite + React + TypeScript + Tailwind uygulaması
- Magic Link giriş formu
- Yalnızca davetli kullanıcılar için giriş (`shouldCreateUser: false`)
- Oturum kontrolü ve çıkış yapma
- `/login`, `/auth/callback`, `/app` route'ları
- Aktif dönem üyeliği olmayan kullanıcı için açıklayıcı uyarı ekranı
- Süper Yönetici için aktif dönem üyelerini görüntüleme ekranı
- Süper Yönetici için mevcut kullanıcıyı aktif döneme ekleme ekranı
- Süper Yönetici için mevcut üyeyi düzenleme ve pasifleştirme ekranı
- Aktif dönem etkinliklerini listeleme ekranı (`/app/etkinlikler`)
- Aktif dönemde temel etkinlik oluşturma formu
- Etkinlik detay route iskeleti (`/app/etkinlikler/:eventId`)
- Etkinlik detayında temel bilgi okuma (ad ve açıklama)
- Etkinlik detayında durum etiketi ve tarihleri okuma
- Etkinlik detayında sorumlu, mekân ve sonraki işlem bilgilerini okuma
- Cloudflare Pages üzerinde canlı yayın

Cloudflare Pages için iki Supabase yayınlanabilir ortam değişkeni tanımlandı. Gizli anahtar kullanılmadı.

### Gerçek canlı test

- Test kullanıcısı Supabase'e davet edildi.
- Davet kabul edildi.
- Kullanıcı canlı sitede başarıyla oturum açtı.
- Magic Link dönüşü doğru çalıştı.
- Kullanıcıya henüz dönem üyeliği verilmediği için beklenen “aktif dönem yetkin henüz tanımlanmamış” mesajı görüntülendi.
- İlk yönetici ataması yapıldı: `odsnmn27@gmail.com` hesabı 2026–2027 döneminde Bilişim Teknolojileri Koordinatörü ve `super_admin` olarak aktif.
- Canlı `/app` ve `/app/yonetim/uyeler` ekranları açıldı; yönetici üyelik kartı, “Üye ekle” ve “Düzenle” seçenekleri doğrulandı.
- “Üye ekle” panelinin boş liste davranışı doğrulandı. Başka aktif dönem profili olmadığı için boş liste mesajı beklenen şekilde gösterildi.
- Yanlışlıkla davet edilen `nmnods27@gmail.com` Auth kullanıcısı silindi. Doğru test adresi `nmnod27@gmail.com` için yeni davet gönderimi e-posta hız sınırına takıldığı için beklemede.

Bu test, giriş akışının çalıştığını doğrular. Henüz uygulama işlevlerinin tamamlandığı anlamına gelmez.

## Bilinen eksikler

Henüz yapılmayan ana özellikler:

- İkinci test kullanıcısının davet edilmesi ve üyelik ekleme akışının canlı testi
- Etkinlik düzenleme ekranı
- Görev oluşturma, atama, destekleyen kişi ve bağımlılık ekranları
- SKS süreç yönetimi ekranları
- Kararlar, notlar, raporlar ve dosya ekranları
- Uygulama içi bildirim merkezi
- Gerçek e-posta teslimat katmanı
- Gerçek web push teslimat katmanı
- Dışa aktarım ve dönem arşivi ekranları
- Tam PWA kurulumu: manifest, service worker, kurulum/offline davranışı

## Şu anki sıradaki küçük görev

**Etkinlik detay ekranı — beşinci küçük frontend adımı.**

Hedef:

- Sadece Süper Yönetici erişebilsin.
- Üyelik Adım 1 tamamlandı: Aktif dönem üyeleri görüntülenebilir.
- Üyelik Adım 2 tamamlandı: Davetli bir profil aktif döneme eklenebilir.
- Üyelik Adım 3 tamamlandı: Mevcut üyenin koordinatörlüğü, rolü ve aktifliği güncellenebilir.
- Kendini pasifleştirme, kendi süper yönetici rolünü kaldırma ve son aktif süper yöneticiyi etkisiz bırakma arayüz düzeyinde engellenir.
- Silme yerine pasifleştirme ilkesi korunur.
- Etkinlik listeleme adımı tamamlandı: aktif üyeler `/app/etkinlikler` üzerinden silinmemiş etkinlikleri görebilir.
- Etkinlik oluşturma adımı tamamlandı: aktif üye etkinlik adı, açıklama, planlama ve tahmini tarihi girerek etkinlik oluşturabilir; oluşturan kişi otomatik etkinlik sahibi olur.
- Etkinlik detay route adımı tamamlandı: etkinlik kartları `/app/etkinlikler/:eventId` adresine gider ve geçici detay sayfası açılır.
- Etkinlik detay temel bilgi adımı tamamlandı: aktif üye, kendi aktif dönemindeki etkinliğin adını ve açıklamasını okuyabilir.
- Etkinlik detay durum/tarih adımı tamamlandı: aktif üye etkinliğin durum etiketini ve planlama, hazırlık başlangıcı, tahmini ve kesinleşen tarihlerini okuyabilir.
- Etkinlik detay süreç bilgileri adımı tamamlandı: aktif üye sorumlu kişiyi, mekânı ve sonraki işlemi okuyabilir.
- Sıradaki küçük adım başlamadan önce etkinlik detay akışının canlı görünümü kontrol edilecek.
- Bu adımda etkinlik düzenleme, SKS ve görev alanları kapsam dışıdır.

Bu görev şunları **kapsamaz**:

- Yeni dönem oluşturma
- Kullanıcıya e-posta daveti gönderme
- Migration/RLS değişikliği
- Etkinlik, görev veya bildirim ekranları

Üyelik yönetimi Adım 1–3 ve etkinlik listeleme kod/derleme düzeyinde doğrulanmış, ilk süper yönetici ataması ve yönetici ekranının canlı açılışı test edilmiştir. İkinci kullanıcı ekleme testi, Supabase’in yerleşik e-posta sağlayıcısındaki hız sınırı nedeniyle beklemededir. Etkinlik listeleme ekranının canlı testi bir sonraki Cloudflare yayınından sonra yapılacaktır.

## Son teknik değişiklikler

- Cloudflare Pages'in eski `_redirects` kuralını döngü riskiyle yok saydığı canlı derleme logunda görüldü.
- `public/_redirects` dosyası kaldırıldı.
- Cloudflare Pages'in otomatik SPA geri dönüşü, `/auth/callback` adresinde canlı olarak doğrulandı.
- Bu düzeltme GitHub `main` dalına gönderildi ve Cloudflare otomatik yeniden yayın yapar.

## Kullanım talimatı — yeni yapay zekâ sohbeti

1. Önce `AI_BAGLAM.md` ve bu dosyayı yükle veya paylaş.
2. “Bu iki dosyayı oku, henüz kod yazma; anladığını kısa biçimde doğrula.” de.
3. Sonra yalnızca tek küçük görev ver.
4. Teslimde kaynak dosyaları içeren ZIP iste; ZIP'te `node_modules`, `dist` veya `.env.local` bulunmamalı.
5. ZIP teknik inceleme, entegrasyon, test ve GitHub işlemleri için ana teknik asistana verilir.
