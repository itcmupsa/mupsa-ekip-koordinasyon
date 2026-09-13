# User theme preferences

`public.user_theme_preferences` stores one private colour preference per profile:

| Column | Contract |
| --- | --- |
| `profile_id` | Primary key and `public.profiles(id)` foreign key; cascade-deleted with the profile and immutable after creation. |
| `color` | Required `#RRGGBB` value. Both uppercase and lowercase hexadecimal digits are accepted. |
| `updated_at` | Set by the shared `public.set_updated_at()` trigger on each update. |

The UI keeps its existing green default when the signed-in user has no row. It can upsert only `{ profile_id: user.id, color }` using `onConflict: 'profile_id'`.

Only active authenticated members can select, insert, or update their own row. There is no anonymous access, delete privilege, administrative cross-user access, or change to `profiles` privileges.

After the migration is present in the linked database, run the rollback-safe SQL verification:

```sh
supabase db query --linked --file supabase/tests/user_theme_preferences_rollback.sql
```

The script begins a transaction, creates disposable Auth/profile/membership fixtures, proves own upsert plus invalid-colour and cross-user denials, then rolls back the entire fixture transaction.

PWA manifests are static assets and cannot carry a per-user runtime theme colour. Apply the saved colour to the document/theme UI after authentication; the installed app manifest remains the shared default.
