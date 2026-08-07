# Canlı Test Notları

**Son güncelleme:** 5 Ağustos 2026

## Tamamlanan canlı kontroller

- `odsnmn27@gmail.com` ile Magic Link giriş yapıldı.
- Hesap 2026–2027 dönemine Bilişim Teknolojileri Koordinatörü ve `super_admin` olarak atandı.
- `/app` ekranında aktif dönem ve yönetim bağlantısı görüldü.
- `/app/yonetim/uyeler` ekranında üye listesi, “Üye ekle” ve “Düzenle” seçenekleri görüldü.
- Üye ekleme paneli, eklenebilir profil olmadığında beklenen boş liste mesajını gösterdi.
- Canlı etkinlik listesinde `Detay Ekranı Test Etkinliği` oluşturuldu.
- Etkinlik detay sayfasında başlık ve açıklama doğrulandı.
- Durum (`Fikir`), planlama tarihi ve tahmini tarih doğru gösterildi.
- Boş hazırlık başlangıcı ve kesinleşmiş tarih alanları için beklenen placeholder gösterildi.
- Süreç bilgileri kartında sorumlu (`Yeni Ekip Üyesi`) doğru gösterildi.
- Boş mekân ve sonraki işlem alanları için `Henüz belirtilmedi` gösterildi.
- Etkinlik detayında `Düzenle` butonu canlıda görüldü.
- Test etkinliğinin başlık ve açıklaması başarıyla güncellendi.
- Sayfa yenilendikten sonra güncellenen bilgiler korunarak veritabanına kaydedildiği doğrulandı.
- Düzenleme formunda `İptal` işlemi test edildi; kaydedilmemiş değişiklikler uygulanmadı.
- Tarih düzenleme formunda planlama, tahmini ve kesinleşmiş tarihler canlıda başarıyla kaydedildi.
- Hazırlık başlangıç tarihi boşaltıldı; detay ekranında `Tarih henüz belirlenmedi` gösterildi.
- Sayfa yenilendikten sonra tarih değerleri ve boş bırakılan alanın durumu korundu.

## Bekleyen kontrol

- Yanlış test daveti `nmnods27@gmail.com` silindi.
- Doğru test adresi `nmnod27@gmail.com` için davet gönderimi Supabase’in yerleşik e-posta sağlayıcısındaki hız sınırına takıldı.
- E-posta kotası yenilendiğinde doğru adres davet edilecek, davet kabul edilecek ve üyelik ekleme akışı test edilecek.

Etkinlik detayının durum/tarih ve süreç bilgileri canlıda başarıyla doğrulandı.
