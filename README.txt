HC MONT ADMIN PANEL

Fajlovi:
- admin.html
- admin.css
- admin.js

Postavljanje:
1. Napravi rezervnu kopiju trenutnih fajlova.
2. Zameni sadržaj sva tri fajla ovim verzijama.
3. Commit changes na GitHub-u i sačekaj da se objavi.
4. Otvori admin stranicu i uradi Ctrl+F5.

Važno:
- admin.js koristi Supabase tabelu public.termini.
- Očekivane kolone uključuju id, ime_klijenta, email, telefon, adresa, usluga,
  datum_termina, status, detalji i datum_zavrsetka.
- Za rad prijave mora da postoji Supabase Auth korisnik adminhcmont@gmail.com.
- RLS mora dozvoliti tom prijavljenom adminu SELECT i UPDATE nad terminima.
- Za mejlove mora da postoji objavljena Supabase Edge Function nazvana
  "posalji-email", koja prihvata JSON { "id": number, "status": "Potvrđen"|"Odbijen" }
  i sama šalje mejl preko Resend-a. Resend API ključ mora ostati kao Edge Function
  secret; nemoj ga stavljati u admin.js.
- Ako mejl ne stigne, otvori Supabase > Edge Functions > posalji-email > Logs.
- Godišnji podsetnik nakon godinu dana zahteva dodatnu zakazanu automatizaciju
  (scheduled Edge Function/cron); browser admin panel ne može pouzdano da šalje
  mejlove kada je sajt zatvoren.
