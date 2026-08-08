# MUPSA — Güncel Geliştirme Durumu

Bu dosya, proje bağlamının güncel durum kaydıdır. Bir görev tamamlandığında yalnızca bu dosyadaki ilgili bölümleri güncelle; `AI_BAGLAM.md` dosyasını yalnızca kalıcı karar değiştiğinde değiştir.

**Son güncelleme:** 8 Ağustos 2026

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
- E-posta + şifre giriş formu
- Oturumlu kullanıcı için ilk şifre belirleme ekranı (`/app/ayarlar/sifre`)
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
- Etkinlik sahibinin veya süper yöneticinin etkinlik adı/açıklamasını düzenleyebilmesi
- Etkinlik sahibinin veya süper yöneticinin etkinlik tarihlerini düzenleyebilmesi
- Etkinlik detayında görevleri salt-okunur listeleme
- Etkinlik detayında temel görev oluşturma formu
- Görevlere ana sorumlu, destekleyen ve bilgilendirilen kişi atama/kaldırma yönetimi
- Cloudflare Pages üzerinde canlı yayın

Cloudflare Pages için iki Supabase yayınlanabilir ortam değişkeni tanımlandı. Gizli anahtar kullanılmadı.

### Gerçek canlı test

- Test kullanıcısı Supabase'e davet edildi.
- Davet kabul edildi.
- Kullanıcı canlı sitede başarıyla oturum açtı.
- Önceki Magic Link akışı test edildi; e-posta teslim limitleri nedeniyle gerçek kullanım için kaldırıldı.
- Vercel üzerinde e-posta + şifre ile çıkış yapıp yeniden giriş testi başarıyla tamamlandı.
- Mevcut oturumlu kullanıcı, `/app/ayarlar/sifre` üzerinden ilk şifresini başarıyla belirledi.
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
- Kararların frontend ekranı, notlar, raporlar ve dosya ekranları
- Uygulama içi bildirim merkezi
- Gerçek e-posta teslimat katmanı (Magic Link artık kullanılmıyor; şifreli girişte gerekli değil)
- İlk şifre belirleme ekranının canlı testi
- Kullanıcı oluşturma akışının daha pratik bir yönetim ekranına dönüştürülmesi
- Gerçek web push teslimat katmanı
- Dışa aktarım ve dönem arşivi ekranları
- Tam PWA kurulumu: manifest, service worker, kurulum/offline davranışı

## Şu anki sıradaki küçük görev

**Kararlar veritabanı altyapısı eklendi; sıradaki iş etkinlik detayında Kararlar ekranını oluşturmaktır.**

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
- Etkinlik detay akışının canlı görünümü kontrol edildi: test etkinliği, durum/tarihler ve süreç bilgileri doğru gösterildi.
- Etkinlik düzenleme adımı tamamlandı: etkinlik sahibi veya süper yönetici yalnızca başlık ve açıklamayı güncelleyebilir.
- Etkinlik düzenleme canlı testi tamamlandı: başlık/açıklama kaydı, sayfa yenileme sonrası kalıcılık ve İptal davranışı doğrulandı.
- Etkinlik düzenleme tarih adımı tamamlandı: planlama, hazırlık başlangıcı, tahmini ve kesinleşmiş tarihler güncellenebilir.
- Etkinlik düzenleme tarih canlı testi tamamlandı: tarih kaydı, boş tarihi `null` yapma ve sayfa yenileme sonrası kalıcılık doğrulandı.
- Etkinlik detay görev listesi adımı tamamlandı: görev adı, durum, son tarih, öncelik ve atanan kişiler salt-okunur gösterilebilir.
- Etkinlik detay görev listesi canlı testi tamamlandı: görevi olmayan etkinlikte beklenen boş liste mesajı gösterildi.
- Etkinlik görev oluşturma adımı tamamlandı: etkinlik sahibi veya süper yönetici görev adı, açıklama, son tarih ve öncelik girerek görev oluşturabilir.
- Etkinlik görev oluşturma canlı testi tamamlandı: görev kaydı, başarı mesajı ve kayıt sonrası liste yenileme doğrulandı.
- Görev önceliği etiket düzeltmesi tamamlandı: `low`, `normal`, `high`, `urgent` değerleri Türkçe gösteriliyor.
- Görev atama yönetimi adımı tamamlandı: aktif dönem üyeleri arasından ana sorumlu, destekleyen ve bilgilendirilen kişiler atanabilir veya kaldırılabilir.
- Görev atama canlı testi tamamlandı: ana sorumlu, destekleyen ve bilgilendirilen atama türleri; ikinci ana sorumlu engeli, ekleme/kaldırma ve sayfa yenileme sonrası kalıcılık doğrulandı.
- Görev durum güncelleme adımı tamamlandı: super_admin, etkinlik sahibi, ana sorumlu ve destekleyen kişi mevcut durum seçeneklerinden seçim yaparak `progress_status` güncelleyebilir; bilgilendirilen ve atanmamış kullanıcılar salt-okunur görür.
- Görev durum güncellemesi canlıda test edildi: durum değişikliği başarıyla kaydedildi ve sayfa yenilemesinden sonra korundu. Supabase RLS, mevcut görev yazma trigger'ı ve migration yapısı değiştirilmedi.
- Görev notu kodu eklendi: yetkili kullanıcılar `tasks.notes` alanına not ekleyebilir, düzenleyebilir veya boşaltabilir; diğer kullanıcılar notu salt-okunur görür.
- Görev notu canlı testi tamamlandı: not ekleme, düzenleme, boşaltma ve sayfa yenileme sonrası kalıcılık doğrulandı.
- Görev düzenleme kodu eklendi: etkinlik sahibi ve `super_admin` görev adı, açıklama, son tarih ve önceliği güncelleyebilir; durum, not ve atamalar korunur. Lint/build başarılı, canlı görev düzenleme testi bekliyor.
- Görev yaşam döngüsü adımı tamamlandı: `super_admin` görevleri `deleted_at` ile pasifleştirebilir, pasif görevleri ayrı filtreyle görebilir ve yeniden aktifleştirebilir. Canlı pasifleştirme, gizleme, filtreleme ve geri alma testi başarılı; migration/RLS değişikliği yapılmadı.
- Görev bağımlılıkları altyapısı korunuyor ancak kullanıcı arayüzü feature flag ile gizlendi (`ENABLE_TASK_DEPENDENCY_UI = false`); mevcut görev akışını sade tutuyoruz. Migration/RLS ve veritabanı modeli silinmedi.
- Ana sayfa dashboard'ı kodlandı: aktif etkinlik/açık görev/bana atanan açık görev/geciken görev özetleri, bana atanan görevler, geciken ve yaklaşan görevler, son etkinlikler ve hızlı erişim bağlantıları gösteriliyor.
- Dashboard verileri aktif dönem ve aktif üyelikle sınırlandırılıyor; görev ve etkinlikler pasif/silinmiş kayıtları dışlıyor. Etkinlik ve görev durum etiketleri veritabanından okunuyor.
- Dashboard kod incelemesinde Gemini teslimindeki `any` kullanımı düzeltildi; lint, TypeScript/Vite build ve `git diff --check` başarılı. Canlı dashboard testi tamamlandı: gerçek etkinlik/görev verileri ve görev sayıları doğrulandı.
- Uygulama içi bildirim alanı kodlandı: kullanıcıya ait `in_app` bildirimleri listeleniyor, okunmamış sayısı gösteriliyor, bildirimler tek tek veya toplu olarak okundu işaretlenebiliyor ve ilişkili etkinlik detayına yönlendirme yapılıyor.
- Bildirim alanında yalnızca mevcut kullanıcının kayıtları sorgulanıyor; migration, RLS, auth, e-posta ve push teslimatı değiştirilmedi. Lint, TypeScript/Vite build ve `git diff --check` başarılı. Canlı bildirim testi tamamlandı: görev ataması ve etkinlik tarihi bildirimleri göründü; tekli ve toplu okundu işaretleme kalıcı olarak doğrulandı.
- PWA temel kurulumu eklendi: manifest, 192/512 SVG ikonları ve service worker kaydı mevcut. Service worker Supabase/auth ve yazma isteklerini cache'lemiyor; kullanıcı verisi offline cache'e alınmıyor. Lint, build ve diff kontrolleri başarılı; canlı telefona kurulum testi bekliyor.
- Ana sayfa Hızlı Erişim bölümüne tüm kullanıcılar için `/app/ayarlar/sifre` adresine giden **Şifre değiştir** kartı eklendi. `AppHome.tsx` değişikliği lint/build kontrollerinden geçti ve GitHub’a gönderildi.
- `AppHome.tsx` mobil görünüm için iyileştirildi: dar ekranlarda başlık ve bildirim metinleri taşmıyor, özet kartları daha sıkı aralıklarla düzenleniyor, görev/etkinlik satırları gerektiğinde alt satıra geçiyor. Veri çekme, yetki, bildirim ve yönlendirme mantığı değiştirilmedi. Lint, build ve `git diff --check` başarılı; canlı mobil kontrol bekliyor.
- Tek ekran kullanıcı oluşturma formu eklendi: Süper Yönetici, ad-soyad, kişisel e-posta, geçici şifre, koordinatörlük ve uygulama rolünü tek panelde girebilir. Bu ilk adım yalnızca form doğrulaması yapar; henüz Supabase hesabı veya üyelik oluşturmaz. Gerçek hesap oluşturma, service_role anahtarını tarayıcıya koymadan güvenli sunucu/Edge Function adımında bağlanacaktır.
- Güvenli kullanıcı oluşturma Edge Function kodu eklendi: `supabase/functions/create-user/index.ts`. Fonksiyon aktif Süper Yönetici oturumunu doğrular, aktif koordinatörlüğü kontrol eder, Auth hesabı ve dönem üyeliği oluşturur; üyelik eklenemezse Auth hesabını geri alır. Supabase projesine deploy edildi ve `AdminMembers.tsx` formuna bağlandı. İlk canlı denemede genel bir non-2xx hata görüldü; arayüz gerçek hata gövdesini gösterecek şekilde güncellendi. Hata `Geçersiz oturum` olarak ayrıştırıldı; function, oturumu service-role ile token üzerinden doğrulayacak şekilde düzeltildi ve yeniden deploy edildi. Canlı yeni kullanıcı oluşturma testi tekrar bekleniyor.
- Durum, SKS, mekân ve sonraki işlem alanları bu adımda düzenlenemez.
- Kararlar için `event_decisions` tablosu, aktif üye okuma politikası, etkinlik sahibi/süper yönetici yazma yetkisi, dönem kilidi ve audit kaydı migration olarak eklendi. Frontend ekranı henüz eklenmedi.

Bu görev şunları **kapsamaz**:

- Yeni dönem oluşturma
- Kullanıcıya e-posta daveti gönderme
- Migration/RLS değişikliği
- Etkinlik, görev veya bildirim ekranları

Üyelik yönetimi Adım 1–3 ve etkinlik listeleme kod/derleme düzeyinde doğrulanmış, ilk süper yönetici ataması ve yönetici ekranının canlı açılışı test edilmiştir. İkinci kullanıcı ekleme testi, Supabase’in yerleşik e-posta sağlayıcısındaki hız sınırı nedeniyle beklemededir. Etkinlik oluşturma, etkinlik detayının durum/tarih-süreç bilgileri ve başlık/açıklama/tarih düzenleme akışları canlıda doğrulanmıştır.

## Son teknik değişiklikler

- Cloudflare Pages'in eski `_redirects` kuralını döngü riskiyle yok saydığı canlı derleme logunda görüldü.
- `public/_redirects` dosyası kaldırıldı.
- Cloudflare Pages'in otomatik SPA geri dönüşü, `/auth/callback` adresinde canlı olarak doğrulandı.
- Bu düzeltme GitHub `main` dalına gönderildi ve Cloudflare otomatik yeniden yayın yapar.
- MUPSA logo SVG'si `public/mupsa-logo.svg` olarak eklendi. Giriş ekranındaki eski `+` simgesi ve ana ekran başlığındaki logo alanı bu dosyayı kullanıyor. Supabase, auth, yetki ve veri akışları değiştirilmedi; lint, build ve `git diff --check` başarılı.
- PWA uygulama ikonları (`public/icon-192.svg` ve `public/icon-512.svg`) siyah arka plan ve MUPSA logosu kullanacak şekilde güncellendi; manifest arka planı da siyah yapıldı. Lint, build ve `git diff --check` başarılı.
- Kararlar altyapısı `20260808100000_add_event_decisions.sql` migration'ı ve `supabase/tests/event_decisions_scenarios.md` senaryo dosyasıyla eklendi. Migration uzak Supabase projesine uygulandı ve `supabase migration list` ile doğrulandı; frontend ekranı henüz eklenmedi.

## Kullanım talimatı — yeni yapay zekâ sohbeti

1. Önce `AI_BAGLAM.md` ve bu dosyayı yükle veya paylaş.
2. “Bu iki dosyayı oku, henüz kod yazma; anladığını kısa biçimde doğrula.” de.
3. Sonra yalnızca tek küçük görev ver.
4. Teslimde kaynak dosyaları içeren ZIP iste; ZIP'te `node_modules`, `dist` veya `.env.local` bulunmamalı.
5. ZIP teknik inceleme, entegrasyon, test ve GitHub işlemleri için ana teknik asistana verilir.
