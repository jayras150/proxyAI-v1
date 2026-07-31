# ADR-0001 — Controlled Negative Balance

**Status:** Accepted (V1)
**Date:** 2026-07-31
**Module:** Billing Engine / Wallet
**Deciders:** Product Owner + Technical Lead (disetujui dalam Billing Design Review v2)

---

## Context

Billing Engine V1 menggunakan strategi **No Reserve + Post-paid Debit** (ADR-0000 / Billing Design Review v2, Revision 4 & 9):

```
Provider → Usage → ChargeService → Wallet Debit → Response
```

Karena tidak ada reserve (hold) pada saldo, terdapat satu celah bisnis yang harus dikunci:

> Request sudah selesai diproses oleh AI provider, tetapi biaya aktual (final cost) sedikit melebihi saldo wallet yang tersisa.

Tanpa keputusan eksplisit, ada dua perilaku ekstrem yang mungkin terjadi:
1. **Debit ditolak total** → request sukses tapi tidak pernah ditagih (loss untuk platform).
2. **Debit selalu diizinkan** → saldo negatif tak terbatas (abuse / risk tak terkendali).

Keduanya tidak dapat diterima. Diperlukan aturan tengah yang eksplisit, terukur, dan otomatis.

---

## Decision

ProxyAI V1 mengadopsi **Controlled Negative Balance** dengan aturan berikut:

### 1. Saldo negatif hanya dari penyelesaian request yang sedang berjalan
Wallet boleh menjadi negatif **hanya** karena settle biaya aktual setelah provider selesai. Tidak ada jalur lain yang membuat saldo negatif (top-up, admin credit, refund tidak pernah menghasilkan negatif).

### 2. Batas negatif maksimum adalah BUSINESS POLICY, bukan database integrity rule
- Nilai `-$0.10 USD` adalah **kebijakan bisnis yang dapat berubah**, dikonfigurasi server-side via env:
  ```
  WALLET_MAX_NEGATIVE_BALANCE = 0.10   // USD
  ```
- **Database TIDAK menyimpan nilai batas ini** — tidak ada CHECK constraint yang meng-hardcode `-0.10`.
- Database hanya menjaga **integritas data dasar** (balance NOT NULL, tipe Decimal(18,6), non-NaN).
- Batas negatif **ditegakkan oleh WalletService** melalui conditional atomic update dalam satu database transaction:
  ```
  UPDATE wallets
  SET balance = balance - amount, version = version + 1
  WHERE id = ? AND balance - amount >= -floor   -- floor dari env
  ```
  Row-count = 0 → debit ditolak (tembus batas) → rollback.
- **Konsekuensi positif:** perubahan business policy (mis. menjadi `-$0.50`) cukup mengubah env — **tanpa database migration**.

### 3. Pre-flight estimation (wajib, sebelum provider dipanggil)
`EstimateService` menghitung estimasi biaya **sebelum** request dikirim ke AI provider:

```
Jika (balance - estimate) < -WALLET_MAX_NEGATIVE_BALANCE  →  tolak request (INSUFFICIENT_BALANCE)
```

Estimasi yang lolos menjamin biaya aktual (dalam batas wajar) tidak akan menembus floor.

### 4. Settle dalam batas → request tetap sukses
Jika biaya aktual membuat saldo negatif tetapi masih `0 >= balance >= -WALLET_MAX_NEGATIVE_BALANCE`:

- request tetap **sukses**
- response tetap dikirim
- wallet tetap **didebit** (saldo menjadi negatif ≤ floor)
- Transaction (AI_USAGE) tetap dibuat
- UsageLog tetap dibuat (status COMPLETED)

### 5. Status wallet → PAYMENT_REQUIRED (system-generated state)
Segera setelah debit menghasilkan `balance < 0`, status wallet otomatis berubah menjadi **`PAYMENT_REQUIRED`** — dalam transaksi yang sama, oleh **WalletService** (bukan ChargeService, bukan admin).

### 6. PAYMENT_REQUIRED memblokir semua endpoint AI
Selama status `PAYMENT_REQUIRED`:
- seluruh endpoint AI (chat, embeddings, dsb.) **menolak request baru** (402 `PAYMENT_REQUIRED`)
- endpoint wallet/top-up tetap berfungsi

### 7. Reaktivasi otomatis setelah top-up
Setelah top-up (atau kredit valid lain) membuat `balance >= 0`, status wallet otomatis kembali menjadi **`ACTIVE`** — tanpa intervensi admin.

---

## Ownership Status PAYMENT_REQUIRED (system-generated, bukan administratif)

| Aturan | Penegak | Detail |
|---|---|---|
| **Hanya sistem yang dapat MEMBUAT** `PAYMENT_REQUIRED` | `WalletService` (dipanggil ChargeService dalam tx debit) | Setelah debit sukses dan `balance < 0`, WalletService mengubah status — atomik dengan debit |
| **Hanya sistem yang dapat MENGHAPUS** `PAYMENT_REQUIRED` | `WalletService.credit()` | Setelah credit valid membuat `balance >= 0`, WalletService mengubah status → ACTIVE — atomik dengan credit |
| **Admin TIDAK dapat mengubah status menjadi PAYMENT_REQUIRED manual** | AdminService (RBAC) | Admin hanya dapat set LOCKED / SUSPENDED / ACTIVE — `PAYMENT_REQUIRED` tidak ada di daftar status administratif yang bisa di-set |
| **PAYMENT_REQUIRED hanya dihapus oleh proses credit yang valid** | WalletService | Tidak ada jalur lain (bukan admin force, bukan refund terpisah — refund adalah credit path yang valid) |

Alur otoritatif:

```
ACTIVE
  └─(ChargeService → WalletService.debitWithFloor: debit sukses, balance < 0)─▶ PAYMENT_REQUIRED
PAYMENT_REQUIRED
  └─(WalletService.credit: balance >= 0)─▶ ACTIVE
```

---

## Consequences

### Positif
- **Tidak ada loss tagihan** untuk overshoot kecil (biasanya < $0.01 pada request pendek).
- **Risiko terkendali**: paparan maksimum per wallet = `WALLET_MAX_NEGATIVE_BALANCE`, bukan tak terbatas.
- **UX mulus**: request yang sudah diproses tidak gagal karena selisih pennies; user melihat PAYMENT_REQUIRED dan top-up untuk melanjutkan.
- **Otomatis penuh**: tidak ada intervensi manual untuk aktivasi/reaktivasi.
- **Policy tanpa migration**: batas negatif adalah env config — perubahan bisnis tidak menyentuh database.

### Negatif / Biaya
- Wallet dapat menampilkan saldo negatif (perlu UI handle: tampilkan sebagai "-$0.03 (menunggu pembayaran)").
- **Perubahan pada Wallet M1 yang sudah disetujui** (lihat Consistency Review):
  1. CHECK constraint `wallets_balance_non_negative` (migration M1) **harus DROP** saat implementasi Billing — digantikan enforcement di WalletService (conditional atomic update dengan floor dari env). Migration: `ALTER TABLE "wallets" DROP CONSTRAINT "wallets_balance_non_negative";`
  2. `enum WalletStatus` perlu nilai baru `PAYMENT_REQUIRED`.
  3. `WalletService` perlu method `debitWithFloor` (conditional atomic: `balance - amount >= -floor`) + internal status transition (debit → PAYMENT_REQUIRED bila negatif) + reaktivasi pada `credit` (balance ≥ 0 → ACTIVE).
- Konstanta batas negatif harus dimonitor (FinOps): abuse via banyak wallet kecil masih mungkin — dimitigasi rate limit per API key + verifikasi identitas saat top-up.

### Alternatif yang Dipertimbangkan
- **A. Debit ditolak total saat saldo kurang** — loss tagihan untuk request sukses; ditolak.
- **B. Saldo negatif tanpa batas** — risiko abuse tak terkendali; ditolak.
- **C. Reserve penuh (hold + refund selisih)** — aman tapi over-engineering untuk V1 (lihat ADR-0000 Rev 4/9: keputusan No Reserve); dijadwalkan V2 bersama batch API.
- **D. CHECK constraint meng-hardcode batas (-0.10)** — mencampur business policy ke integrity rule; perubahan policy butuh migration; **ditolak** (Revisi Final Design Polish).

---

## Consistency Review (wajib diverifikasi saat implementasi)

| Komponen | Dampak ADR | Kebutuhan perubahan |
|---|---|---|
| Wallet Design (M1/M2) | DROP CHECK constraint; enum + status baru; debit perlu floor | Migration + `WalletStatus.PAYMENT_REQUIRED` + `debitWithFloor` + reaktivasi pada credit |
| Billing Design (ChargeService) | Settle dalam batas → sukses; transisi status via WalletService (1 tx) | ChargeService memanggil `WalletService.debitWithFloor` (bukan set status sendiri) |
| State Machine (Wallet) | ACTIVE → PAYMENT_REQUIRED (system, via debit); PAYMENT_REQUIRED → ACTIVE (system, via credit) | Update state machine |
| Pricing Engine | Tidak berubah (hitung cost murni) | — |
| EstimateService | Wajib pre-flight: tolak jika `balance - estimate < -WALLET_MAX_NEGATIVE_BALANCE` | Update guard (baca env) |
| ChargeService | Debit via WalletService.debitWithFloor; tidak set status manual | Update debit strategy |
| AI Gateway | Tolak semua request AI saat PAYMENT_REQUIRED (402) | Gate sebelum provider |
| OpenAI Compatible API | Error `PAYMENT_REQUIRED` (402) untuk request saat status blokir | Tambah kode error |
| TopupService | Reaktivasi otomatis ACTIVE saat balance >= 0 (via WalletService.credit) | Update credit path |
| Refund | Refund yang membuat balance >= 0 juga reaktivasi (konsisten dgn aturan 7) | Ikut credit path |
| Admin | TIDAK bisa set PAYMENT_REQUIRED manual | RBAC: status administratif hanya ACTIVE/LOCKED/SUSPENDED |

---

## References

- Billing Engine Design Review v2 — Revision 4 (Reserve Decision), Revision 9 (Wallet Debit Strategy)
- Billing Engine Design Polish (Final) — Revision 1 (Business Policy vs Integrity Rule), Revision 2 (Ownership PAYMENT_REQUIRED)
- Blueprint Sprint 4 §19 (balance never negative — direvisi oleh ADR ini dengan batas terkendali), §25 (race condition)
- Blueprint Sprint 10 §73 (Wallet State Machine — diperluas dengan PAYMENT_REQUIRED)
- Sprint 14 §105 (ADR template)
