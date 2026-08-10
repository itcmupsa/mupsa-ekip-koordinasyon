# Takvim test senaryoları

Bu senaryolar test verileri canlıda kalıcı bırakılmadan uygulanmalıdır.

1. Etkinliğin planlama, hazırlık başlangıcı, tahmini ve kesinleşmiş tarihleri takvimde ayrı tarih noktaları olarak görünür.
2. Pasif etkinlik ve pasif farkındalık takvimde görünmez.
3. Farkındalık başlangıç/bitiş aralığı, hazırlık başlangıcı, tahmini paylaşım, paylaşım ve kapanış tarihleri doğru günlerde görünür.
4. Süper Yönetici manuel kayıt ekleyebilir, düzenleyebilir, pasifleştirebilir ve yeniden aktifleştirebilir.
5. Başlık veya başlangıç tarihi boş olan manuel kayıt reddedilir; bitiş tarihi başlangıçtan önce olamaz.
6. Koordinatör manuel kayıt yönetim kontrollerini görmez ve doğrudan `calendar_entries` yazma denemesi RLS tarafından reddedilir.
7. Pasifleştirme fiziksel silme yapmaz; `deleted_at`, `deleted_by` ve `deletion_note` dolar.
8. `calendar_entry` için oluşturma, düzenleme, pasifleştirme ve yeniden aktifleştirme audit kayıtları oluşur.
9. Takvim görevleri `get_my_calendar_task_deadlines()` RPC'sinin `auth.uid()` ile eşleştirdiği ana sorumlu (`primary`) ve destekleyen (`supporting`) kişilere gösterilir.
10. Bilgilendirilen (`informed`), atanmamış kullanıcı, yalnızca etkinlik sahibi ve başka bir Süper Yönetici görev ataması yoksa görev son tarihini takvimde göremez.
11. Primary sahibi olmayan, taslak, tamamlanmış, iptal edilmiş veya silinmiş görev takvimde görünmez.
12. Silinmiş etkinliğe bağlı görev, görev sahibi olsa bile takvimde görünmez.
13. 30 Haziran ve 1 Temmuz tarihleri farklı dönemlerde doğru görünür.
14. 360–390 px genişlikte takvim yatay taşma oluşturmaz.

Görev gizliliğinin kritik kontrolü: RPC çağrısı parametre olarak yalnızca dönem alır; profil kimliği istemciden alınmaz. Fonksiyon içinde `task_assignees.profile_id = auth.uid()` koşulu çalışır.
