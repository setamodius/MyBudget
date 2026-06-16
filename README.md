# MyBudget — Kişisel Finans Yönetim Sistemi

Tam kapsamlı bir kişisel bütçe yönetimi ve finansal takip uygulaması. Gelir, kredi kartı, gider, birikim ve yatırım yönetimini "kutular arası para akışı" konseptiyle tek platformda birleştirir.

## İçindekiler

- [Genel Bakış](#genel-bakış)
- [Box Mantığı — Sistemin Kalbi](#box-mantığı--sistemin-kalbi)
- [Teknoloji Yığını](#teknoloji-yığını)
- [Proje Yapısı](#proje-yapısı)
- [Kurulum — Geliştirme Ortamı](#kurulum--geliştirme-ortamı)
- [Kurulum — Docker (Production)](#kurulum--docker-production)
- [API Dokümantasyonu](#api-dokümantasyonu)
- [Frontend Sayfaları](#frontend-sayfaları)
- [Veritabanı Şeması](#veritabanı-şeması)
- [Örnek Kullanım Senaryoları](#örnek-kullanım-senaryoları)
- [Troubleshooting](#troubleshooting)
- [Güvenlik](#güvenlik)
- [Versiyon Geçmişi](#versiyon-geçmişi)

---

## Genel Bakış

MyBudget, finansal hareketleri **"kutular" (boxes)** konsepti üzerinden yöneten bir bütçe uygulamasıdır. Geleneksel muhasebe sistemlerinden farklı olarak, tüm finansal varlıkları (gelir kaynakları, kredi kartları, gider kategorileri, birikimler, yatırımlar) birer "kutu" olarak modelleyip para akışını bu kutular arasındaki transferler şeklinde takip eder.

### Ana Özellikler

- **Unified Box System** — Tüm finansal varlıklar tek bir veri modelinde (`boxes` + `box_transactions`)
- **7 Box Tipi** — Income, CreditCard, ExpenseType, Storage, Investment, Generator, Destroyer
- **Double-Entry Para Akışı** — Her işlem bir kaynaktan bir hedefe gider; para kaybolmaz
- **Detaylı Raporlama** — Aylık gelir/gider/bakiye raporları, kredi kartı dönemsel hesaplama
- **Kredi Kartı Dönem Takibi** — Hesap kesim tarihine göre doğru dönem hesaplama
- **Taksit Planları** — Plan oluşturma, taksit işlemlerinin otomatik oluşturulması ve takibi
- **Para Akışı Görselleştirme** — Kutular arası akış diyagramı
- **JSON Metadata** — İşlemlere `info` alanı ile sınırsız ek bilgi (taksit no, plan_id, vb.)
- **Responsive UI** — Masaüstü (sidebar) ve mobil (bottom nav) uyumlu modern arayüz
- **Koyu/Açık Tema** — Sistem temasına göre otomatik, kullanıcı değiştirebilir
- **Production-Ready** — Docker ile tek container: React statik dosyaları Express üzerinden servis edilir

---

## Box Mantığı — Sistemin Kalbi

### Kavramsal Model

Her finansal varlık bir **box**'tır. Para bir box'tan diğerine transfer olarak akar. Sistem, gerçek dünya paralelini şöyle kurar:

```
Dış Kaynak (Generator)
    │
    └─► Gelir (Income)  ──────────────────────────────────────────────────┐
              │                                                             │
              ├─► Birikim (Storage) ─────────────────────────────────────┐ │
              │         │                                                  │ │
              │         ├─► Kredi Kartı Ödemesi (→ CreditCard)            │ │
              │         ├─► Yatırım (Investment) ◄─────────────────┐      │ │
              │         └─► Gider (ExpenseType)                    │      │ │
              │                                                    │      │ │
              └─► Kredi Kartı (CreditCard)                         │      │ │
                        │                                          │      │ │
                        ├─► Gider (ExpenseType)                   │      │ │
                        └─► Yatırım (Investment) ─────────────────┘      │ │
                                                                          │ │
Gider (ExpenseType) ─────────────────────────────────────────────────────┘ │
    └─► Destroyer (Tüketildi)                                               │
                                                                            │
Yatırım (Investment) ─────────────────────────────────────────────────────┘
```

### Box Tipleri

| boxtypeid | İsim | Açıklama |
|-----------|------|----------|
| 1 | Income | Maaş, kira geliri, yan gelir gibi para giren kaynaklar |
| 2 | CreditCard | Banka kredi kartları — settlement/payment günleri önemli |
| 3 | ExpenseType | Gider kategorisi: Market, Ulaşım, Ev, Eğlence vb. |
| 4 | Generator | Pasif gelir / dış dünya kaynağı; "Dış Kaynak" box bu tiptedir |
| 5 | Destroyer | Giderin nihai hedefi; taksit planları bu box'a işlem oluşturur |
| 6 | Storage | Banka hesabı, altın, nakit gibi birikim hesapları |
| 7 | Investment | Hisse senedi, kripto, fon gibi yatırım araçları |

### Sistem Box'ları (Otomatik Oluşturulur)

#### `Dış Kaynak` (Generator — boxtypeid: 4)

Uygulama ilk açıldığında `seedDatabase()` çalışır ve eğer hiç Generator tipinde box yoksa otomatik oluşturulur:

```
name: "Dış Kaynak"  |  boxtypeid: 4  |  minuslimit: -1  |  pluslimit: -1
```

- Dış dünyadan gelen paraların kaynağını temsil eder
- `minuslimit = -1` ve `pluslimit = -1` → sınırsız kapasite
- Manuel silinmemeli

#### `Void` (Income — boxtypeid: 1)

Sadece `POST /api/v1/create` çağrıldığında oluşur (tam DB sıfırlama). "Dış Kaynak"ın alternatifi olarak da kullanılabilir.

### Box Özellikleri

```
boxes tablosu:
├── id          — Benzersiz kimlik (SERIAL)
├── boxtypeid   — Referans: box_types(id)
├── name        — Box adı
├── settlement  — Hesap kesim günü (1-31; kredi kartları için kritik)
├── payment     — Ödeme günü (1-31)
├── minuslimit  — Borçlanma sınırı (-1 = sınırsız)
└── pluslimit   — Birikim sınırı (-1 = sınırsız)
```

> `settlement` alanı kredi kartı raporlarında **dönem hesaplamak** için kullanılır. Kesim günü 15 ise 1-15 arası işlemler bu aya, 16-30 arası işlemler sonraki aya ait olarak hesaplanır.

### Box İşlemleri (Transactions)

Tüm para hareketleri `box_transactions` tablosundadır:

```
box_transactions tablosu:
├── id          — İşlem ID (SERIAL)
├── date        — İşlem tarihi (DATE)
├── frombox     — Kaynak box ID (FK → boxes)
├── tobox       — Hedef box ID (FK → boxes)
├── description — İşlem açıklaması
├── amount      — Tutar (NUMERIC 12,2)
└── info        — JSON metadata (opsiyonel)
```

### `info` JSON Alanı

İşlemlere serbest metadata eklenebilir. Taksit planları bu alanı zorunlu olarak kullanır:

```json
{ "plan_id": 3, "installment_no": 2, "total": 12 }
```

Diğer kullanım örnekleri:

```json
{ "Installments": 6, "MonthlyPayment": 750, "Vendor": "Apple Store" }
{ "InvoiceNo": "FT2025001", "Consumption": "250 kWh" }
{ "type": "budget" }
```

> `info->>'type' = 'budget'` olan işlemler gider raporlarında "planlanan" olarak sınıflandırılır. Eğer bir ay için budget kaydı varsa yalnızca o gösterilir; yoksa gerçek harcamalar gösterilir.

### Para Akışı Örnekleri

```
Maaş alımı:           Dış Kaynak → Maaşım (Income)         50.000 TL
Kredi kartı harcama:  Garanti Bonus (CC) → Market (Expense) 850 TL
Kredi kartı ödeme:    TEB Hesabı (Storage) → Garanti Bonus  15.000 TL
Birikime aktarma:     Maaşım (Income) → TEB Hesabı (Storage) 5.000 TL
Yatırım alımı:        TEB Hesabı → BIST Fonu (Investment)   10.000 TL
```

---

## Teknoloji Yığını

### Backend (`budgetapi/`)

| Paket | Versiyon | Kullanım |
|-------|----------|----------|
| Node.js | 18.x+ (20.x Docker) | JavaScript runtime |
| Express.js | ^4.18.1 | Web framework, REST API ve statik dosya servisi |
| PostgreSQL | 13+ | Veritabanı |
| pg | ^8.7.3 | PostgreSQL sürücüsü |
| moment.js | ^2.29.4 | Tarih işlemleri |
| dotenv | ^16.0.1 | Ortam değişkenleri |
| cors | ^2.8.5 | CORS yönetimi |
| nodemon | — | Geliştirme modunda hot-reload (`npm run serve`) |

### Frontend (`budgetviewreact/`)

| Paket | Versiyon | Kullanım |
|-------|----------|----------|
| React | ^19.2.6 | UI framework |
| Vite | ^8.0.12 | Build tool ve dev server |
| TypeScript | ~6.0.2 | Type safety |
| React Router DOM | ^7.15.1 | Sayfa yönlendirme |
| TanStack Query | ^5.100.14 | Server state yönetimi, cache, invalidation |
| Axios | ^1.16.1 | HTTP client |
| Recharts | ^3.8.1 | Bar, Line, Pie grafikleri |
| Tailwind CSS | ^3.4.19 | Utility-first CSS framework |
| Lucide React | ^1.16.0 | İkon seti |
| clsx / tailwind-merge | — | Koşullu class birleştirme |

### DevOps / Altyapı

| Teknoloji | Kullanım |
|-----------|----------|
| Docker (multi-stage) | Stage 1: React build → Stage 2: Express prod image |
| docker-compose | Tek komutla konteyner yönetimi |
| concurrently | Geliştirmede API + UI'ı tek terminalde çalıştırma |
| Git | Versiyon kontrolü |

---

## Proje Yapısı

```
MyBudget/
├── budgetapi/                    # Express backend
│   ├── app.js                    # Express kurulumu, route tanımları
│   ├── dbapi.js                  # Tüm DB sorguları (aktif, tek kaynak)
│   ├── api.js                    # Eski implementation (kullanılmıyor)
│   ├── package.json
│   ├── .env                      # DB bağlantı bilgileri (git'e ekleme!)
│   └── Dockerfile                # Eski, kök Dockerfile kullanılıyor
│
├── budgetviewreact/              # React + Vite frontend
│   ├── src/
│   │   ├── App.tsx               # Route tanımları
│   │   ├── main.tsx              # React entry point
│   │   ├── types/index.ts        # TypeScript tip tanımları
│   │   ├── api/                  # API çağrı fonksiyonları
│   │   │   ├── client.ts         # Axios instance (VITE_API_BASE_URL kullanır)
│   │   │   ├── boxes.ts
│   │   │   ├── transactions.ts
│   │   │   ├── reports.ts
│   │   │   ├── balances.ts
│   │   │   ├── flows.ts
│   │   │   └── installments.ts
│   │   ├── pages/                # Sayfa bileşenleri
│   │   │   ├── StatusPage.tsx    # /        — Bugün
│   │   │   ├── AddPage.tsx       # /ekle    — İşlem Ekle
│   │   │   ├── TransactionsPage.tsx # /islemler — İşlemler
│   │   │   ├── HarcamalarPage.tsx   # /harcamalar — Harcamalar
│   │   │   ├── HesaplarPage.tsx     # /hesaplar — Hesaplar
│   │   │   ├── PlanPage.tsx         # /plan    — Plan
│   │   │   ├── RaporlarPage.tsx     # /raporlar — Raporlar
│   │   │   ├── FlowPage.tsx         # /akis    — Para Akışı
│   │   │   ├── DefinitionsPage.tsx  # /ayarlar — Ayarlar
│   │   │   └── ImportPage.tsx       # (henüz route yok, geliştirme aşamasında)
│   │   ├── components/
│   │   │   ├── layout/           # AppLayout, Sidebar, BottomNav, navItems
│   │   │   ├── ui/               # Yeniden kullanılabilir bileşenler
│   │   │   └── TransactionDialogs.tsx
│   │   └── lib/
│   │       ├── utils.ts          # formatCurrency, today, getFlowLabel vb.
│   │       ├── csvParser.ts      # Akbank CSV parse (ImportPage için)
│   │       └── print.ts          # Rapor yazdırma
│   ├── .env                      # VITE_API_BASE_URL=http://localhost:5000/api/v1
│   ├── .env.production           # VITE_API_BASE_URL=/api/v1 (Docker için)
│   └── package.json
│
├── Dockerfile                    # Multi-stage: React build → Express prod image
├── docker-compose.yml            # Production container config
├── package.json                  # Root: concurrently (geliştirme)
└── README.md
```

> **Not:** `budgetapi/app.js` yalnızca `dbapi.js`'yi import eder. `api.js` eski implementasyondur ve aktif değildir.

---

## Kurulum — Geliştirme Ortamı

### Gereksinimler

- Node.js 18.x veya üzeri
- PostgreSQL 13 veya üzeri
- npm

### 1. Bağımlılıkları Yükle

```bash
# Root (concurrently için)
npm install

# Backend
cd budgetapi && npm install

# Frontend
cd budgetviewreact && npm install
```

### 2. Backend Ortam Değişkenleri

`budgetapi/.env` dosyası oluşturun:

```env
USER=postgres
HOST=localhost
DATABASE=mybudget
PASSWORD=your_password
PORT=5432
```

### 3. Veritabanı Oluştur

```bash
psql -U postgres -c "CREATE DATABASE mybudget;"
```

Uygulama ilk başladığında `seedDatabase()` otomatik çalışır ve `CREATE TABLE IF NOT EXISTS` ile tabloları oluşturur. **Manuel tablo oluşturmanıza gerek yoktur.**

Tüm verileri silip sıfırdan başlamak isterseniz:

```bash
# ⚠️ TÜM VERİLERİ SİLER
curl -X POST http://localhost:5000/api/v1/create
```

### 4. Çalıştır

**Önerilen — tek komutla her ikisini birden:**

```bash
# Proje kök dizininde
npm start
```

Çıktı şöyle görünür:

```
[API] Budget API running on port 5000.
[API] Database seed OK.
[UI]  VITE v8.x  ready in 300ms
[UI]  ➜  Local: http://localhost:5173/
```

**Ayrı ayrı başlatmak için:**

```bash
# Terminal 1 — API (http://localhost:5000)
cd budgetapi && npm run serve

# Terminal 2 — React UI (http://localhost:5173)
cd budgetviewreact && npm run dev
```

### Frontend API Bağlantısı

`budgetviewreact/.env` dosyasında API adresi tanımlıdır:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

---

## Kurulum — Docker (Production)

### Production Build Nasıl Çalışır?

`Dockerfile` iki aşamalıdır:

1. **Stage 1 (frontend):** React uygulaması `npm run build` ile derlenir → `dist/` klasörü oluşur
2. **Stage 2 (production):** Express API kurulur, React'ın `dist/` çıktısı `public/` klasörüne kopyalanır

Express hem API'yi hem de React'ı tek porttan (5000) servis eder:
- `GET /api/v1/*` → API router
- Diğer tüm istekler → `public/index.html` (React SPA)

Bu nedenle production'da `.env.production` devreye girer ve `VITE_API_BASE_URL=/api/v1` (göreli path) kullanılır.

### Docker Image Oluştur

```bash
# Proje kök dizininde
docker build -t mybudget .
```

### docker-compose ile Çalıştır

`docker-compose.yml` örneği:

```yaml
services:
  mybudget:
    image: mybudget
    container_name: mybudget
    restart: unless-stopped
    ports:
      - "5000:5000"
    environment:
      USER: postgres
      HOST: your-db-host
      DATABASE: mybudget
      PASSWORD: your_password
      PORT: 5432
```

```bash
docker-compose up -d
```

Uygulama `http://your-server:5000` adresinde çalışır.

> **Not:** PostgreSQL aynı konteynerde değilse dışarıda erişilebilir bir PostgreSQL örneği gerekir. Konteyner başlarken `seedDatabase()` tabloları otomatik oluşturur.

---

## API Dokümantasyonu

### Base URL

```
http://localhost:5000/api/v1
```

### Tüm Endpoint'ler

| Kategori | Metod | Path | Açıklama |
|----------|-------|------|----------|
| **DB Setup** | POST | `/create` | DB sıfırla, tabloları oluştur |
| **Gelirler** | GET | `/incomes` | Tüm Income box'ları |
| | POST | `/incomes` | Income box ekle |
| | PUT | `/incomes/:id` | Income box güncelle |
| | DELETE | `/incomes/:id` | Income box sil |
| | GET | `/incomes/:id/reports` | Aylık gelir/gider raporu |
| **Kredi Kartları** | GET | `/creditcards` | Tüm CreditCard box'ları |
| | POST | `/creditcards` | CC box ekle |
| | PUT | `/creditcards/:id` | CC box güncelle |
| | DELETE | `/creditcards/:id` | CC box sil |
| | GET | `/creditcards/reports` | Tüm kartlar toplam rapor |
| | GET | `/creditcards/:id/reports` | Tek kart aylık rapor |
| | GET | `/creditcards/:id/transactions` | Kart dönemsel işlem listesi |
| **Gider Türleri** | GET | `/expensetypes` | Tüm ExpenseType box'ları |
| | POST | `/expensetypes` | Gider türü ekle |
| | PUT | `/expensetypes/:id` | Güncelle |
| | DELETE | `/expensetypes/:id` | Sil |
| | GET | `/expensetypes/reports` | Tüm giderler toplam rapor |
| | GET | `/expensetypes/monthly-breakdown` | Aylık kategori dağılımı |
| | GET | `/expensetypes/:id/reports` | Tek kategori raporu |
| **Birikimler** | GET | `/storages` | Tüm Storage box'ları |
| | POST | `/storages` | Storage ekle |
| | PUT | `/storages/:id` | Güncelle |
| | DELETE | `/storages/:id` | Sil |
| | GET | `/storages/reports` | Tüm birikim raporu |
| | GET | `/storages/:id/reports` | Tek birikim raporu |
| **Yatırımlar** | GET | `/investments` | Tüm Investment box'ları |
| | POST | `/investments` | Investment ekle |
| | PUT | `/investments/:id` | Güncelle |
| | DELETE | `/investments/:id` | Sil |
| | GET | `/investments/reports` | Tüm yatırım raporu |
| | GET | `/investments/:id/reports` | Tek yatırım raporu |
| **Box Genel** | GET | `/boxes` | Tüm box'lar |
| | GET | `/boxtypes` | Box tipleri listesi |
| | GET | `/generators` | Generator tipindeki box'lar |
| | GET | `/destroyers` | Destroyer tipindeki box'lar |
| | GET | `/boxdirections` | İzin verilen box tipi yönleri |
| | GET | `/balances` | CC/Storage/Investment bakiyeleri |
| | GET | `/flows` | Kutular arası para akış verisi |
| **İşlemler** | GET | `/transactions` | İşlem listesi (filtreli) |
| | POST | `/transactions` | İşlem ekle |
| | POST | `/incomes/transactions` | Gelir işlemi ekle |
| | PUT | `/transactions/:id` | İşlem güncelle |
| | DELETE | `/transactions/:id` | İşlem sil |
| **Özetler** | GET | `/summaries` | Aylık finansal özet |
| | GET | `/period-summary` | Dönem bazlı box özeti |
| **Taksit Planları** | GET | `/installment-plans` | Tüm planlar |
| | GET | `/installment-plans/:id` | Plan detayı (taksit işlemleri) |
| | POST | `/installment-plans` | Plan oluştur |
| | DELETE | `/installment-plans/:id` | Plan ve işlemlerini sil |

---

### DB Setup

```http
POST /api/v1/create
```

Tüm tabloları (`box_transactions`, `boxes`, `box_types`) **silip** yeniden oluşturur. Box tiplerini ve `Void` adlı Income box'ı ekler.

**⚠️ UYARI: Tüm verileri siler!**

---

### Box CRUD (Income, CreditCard, ExpenseType, Storage, Investment)

Tüm box tipleri aynı şema ile çalışır:

**POST body:**
```json
{
  "name": "Garanti Bonus",
  "settlement": 15,
  "payment": 5,
  "minuslimit": 30000,
  "pluslimit": 0
}
```

- `settlement` / `payment`: Kredi kartları için ayın günü (1-31). Diğerleri için `0`.
- `minuslimit` / `pluslimit`: `-1` sınırsız demektir.

---

### Kredi Kartı Raporu

```http
GET /api/v1/creditcards/:id/reports
```

Hesap kesim tarihine (`settlement`) göre dönemsel hesaplama yapar. Kesim gününden sonra yapılan işlemler **bir sonraki ayın** borcuna eklenir.

**Response:**
```json
[
  {
    "month": "2025-02-01T00:00:00.000Z",
    "income": "15000.00",
    "expense": "12500.00",
    "balance": "2500.00",
    "total_balance": "2500.00"
  }
]
```

- `income`: O ay yapılan ödemeler (tobox = bu kart)
- `expense`: O dönemde harcamalar (billing cycle)
- `balance`: `income - expense` (pozitif = fazla ödeme, negatif = borç)

```http
GET /api/v1/creditcards/:id/transactions?month=YYYY-MM
```

Belirli bir dönemin işlem listesini döndürür. `month` parametresi zorunludur.

---

### Gider Tipi Raporu

```http
GET /api/v1/expensetypes/:id/reports
```

**Response:**
```json
[
  {
    "month": "2025-01-01T00:00:00.000Z",
    "cash": "500.00",
    "cc_this_cycle": "350.00",
    "cc_next_cycle": "0.00",
    "charged": "850.00",
    "settled": "850.00",
    "net": "0.00",
    "total_net": "0.00"
  }
]
```

- `charged`: Bu kategoriye gelen toplam harcama (nakit + kredi kartı)
- `settled`: Gerçekleşen veya planlanan harcama (info->>'type' = 'budget' mantığı)
- `cash`: Doğrudan Storage'dan gelen harcamalar
- `cc_this_cycle`: Bu dönemdeki kredi kartı harcamaları
- `cc_next_cycle`: Kesim gününden sonra yapılmış, gelecek aya devreden harcamalar

```http
GET /api/v1/expensetypes/monthly-breakdown?month=YYYY-MM
```

Belirtilen ayda kategori bazlı harcama dağılımı:

```json
[
  { "name": "Market", "total": "2350.00" },
  { "name": "Ulaşım", "total": "890.00" }
]
```

---

### Özet — Summaries

```http
GET /api/v1/summaries
```

Tüm aylar için aylık finansal özet. Değerleri hesaplanır şöyle:
- `t_income`: Income box'lardan Storage box'lara giden para
- `t_creditcard_expense`: Kredi kartlarından gider kategorilerine giden para (billing cycle)
- `t_direct_expense`: Storage'dan gider kategorilerine direkt giden para
- `t_expense`: `t_creditcard_expense + t_direct_expense`
- `balance`: `t_income - t_expense`

**Response:**
```json
[
  {
    "month": "2025-01-01T00:00:00.000Z",
    "t_income": "50000.00",
    "t_creditcard_expense": "12000.00",
    "t_direct_expense": "3000.00",
    "t_cc_pending": "0.00",
    "t_expense": "15000.00",
    "balance": "35000.00"
  }
]
```

---

### Dönem Özeti — Period Summary

```http
GET /api/v1/period-summary?start=YYYY-MM-DD&end=YYYY-MM-DD
```

Her box için verilen dönemde giren/çıkan/net para. Generator ve Destroyer hariç tüm box'lar döner.

**Response:**
```json
[
  {
    "id": 2,
    "name": "Maaşım",
    "boxtypeid": 1,
    "type": "Income",
    "total_in": "50000.00",
    "total_out": "45000.00",
    "net": "5000.00"
  }
]
```

---

### Para Akışı — Flows

```http
GET /api/v1/flows?start=YYYY-MM-DD&end=YYYY-MM-DD
```

Kutular arası toplam para akışı. Her çift için tek satır döner.

**Response:**
```json
[
  {
    "frombox": 2, "from_name": "Maaşım", "from_type": "Income",
    "tobox": 5,   "to_name": "TEB Hesabı", "to_type": "Storage",
    "total": "25000.00"
  }
]
```

---

### İşlemler — Transactions

```http
GET /api/v1/transactions?from=&to=&start=&end=
```

Tüm parametreler opsiyonel. Hiç verilmezse son 100 günün işlemleri döner.

| Parametre | Tip | Açıklama |
|-----------|-----|----------|
| `from` | integer | Kaynak box ID |
| `to` | integer | Hedef box ID |
| `start` | YYYY-MM-DD | Başlangıç tarihi |
| `end` | YYYY-MM-DD | Bitiş tarihi |

```http
POST /api/v1/transactions
```

```json
{
  "date": "2025-01-25",
  "frombox": 3,
  "tobox": 8,
  "description": "Migros alışverişi",
  "amount": 850,
  "info": { "Store": "Migros" }
}
```

---

### Bakiyeler — Balances

```http
GET /api/v1/balances
```

Yalnızca bakiyesi anlamlı box tipleri döner: CreditCard (boxtypeid 2), Storage (6), Investment (7). `Void` adlı box hariç tutulur.

- **CreditCard:** `frombox toplamı - tobox toplamı` → pozitif = ödenmemiş borç
- **Storage / Investment:** `tobox toplamı - frombox toplamı` → pozitif = mevcut bakiye

---

### Box Yönleri — Box Directions

```http
GET /api/v1/boxdirections
```

`box_directions` tablosundaki izin verilen akış yönlerini döner. Frontend'de "işlem eklerken hangi tipten hangisine transfer yapılabilir" kuralını belirler.

**Response:**
```json
[
  { "id": 1, "fromid": 4, "from_name": "Generator", "toid": 1, "to_name": "Income" },
  { "id": 2, "fromid": 1, "from_name": "Income",    "toid": 6, "to_name": "Storage" }
]
```

---

### Taksit Planları — Installment Plans

```http
POST /api/v1/installment-plans
```

Plan oluşturulurken tüm taksit işlemleri **atomik olarak** (transaction içinde) `box_transactions`'a eklenir. İşlemler `expense_box_id → Destroyer` yönünde oluşturulur.

```json
{
  "description": "iPhone 15 taksit planı",
  "expense_box_id": 8,
  "payment_box_id": 5,
  "start_date": "2025-01-10",
  "total_installments": 12,
  "total_amount": 45000
}
```

- `expense_box_id`: Hangi gider kategorisinden düşülecek (ExpenseType box)
- `payment_box_id`: Hangi hesaptan ödenecek (Storage box, opsiyonel — sadece referans)
- Aylık tutar: `total_amount / total_installments` (kuruşa yuvarlanır; son taksit artığı kapatır)
- Her taksit `info`'suna `{ "plan_id": N, "installment_no": i, "total": 12 }` yazılır

**Response:** `{ "id": 3 }`

```http
GET /api/v1/installment-plans
```

Her plan için `elapsed_count` (bugüne kadar geçmiş taksit sayısı) dahil tüm detayları döner.

```http
DELETE /api/v1/installment-plans/:id
```

Plan ve ona bağlı tüm `box_transactions` kayıtları atomik olarak silinir.

---

## Frontend Sayfaları

React UI, geliştirmede `http://localhost:5173` adresinde çalışır. Production'da Express üzerinden `http://server:5000` adresinden sunulur.

### Navigasyon Yapısı

**Birincil (her zaman görünür):**

| Sayfa | URL | Açıklama |
|-------|-----|----------|
| Bugün | `/` | Anlık durum paneli |
| İşlem Ekle | `/ekle` | Hızlı işlem girişi |
| İşlemler | `/islemler` | İşlem listesi ve filtre |
| Harcamalar | `/harcamalar` | Gider analizi ve grafikler |
| Hesaplar | `/hesaplar` | Bakiyeler ve hesap raporları |

**İkincil ("Daha Fazla" menüsü / mobil):**

| Sayfa | URL | Açıklama |
|-------|-----|----------|
| Plan | `/plan` | Taksit planları |
| Raporlar | `/raporlar` | Aylık özet ve dönem raporu |
| Para Akışı | `/akis` | Kutular arası akış diyagramı |
| Ayarlar | `/ayarlar` | Box tanımları yönetimi |

**Masaüstü:** Sabit sol sidebar  
**Mobil:** Alt navigasyon çubuğu (birincil 5 öğe) + "Daha Fazla" düğmesi (ikincil öğeler)

---

### `/` — Bugün (StatusPage)

- Ay seçici (varsayılan: bu ay)
- Özet kartlar: Toplam birikim, kredi kartı borcu, yatırım, net varlık
- Seçili aya ait gelir / gider / borç bilgisi
- Seçili ayın işlem listesi (edit / delete)
- Son işlemler (ilk 5, "Tümünü Göster" butonu)

---

### `/ekle` — İşlem Ekle (AddPage)

- Tarih, tutar, açıklama girişi
- `frombox` / `tobox` seçimi (box pilleri halinde)
- `info` JSON alanı için ek bilgi girişi
- Gelir işlemi özel endpoint'i (`POST /incomes/transactions`) desteği

---

### `/islemler` — İşlemler (TransactionsPage)

- Tarih aralığı ve box bazlı filtre
- Tablo görünümü: tarih, from/to box adları, açıklama, tutar
- Satır üzerinden düzenleme ve silme

---

### `/harcamalar` — Harcamalar (HarcamalarPage)

Gider kategorisi (ExpenseType) odaklı analiz:

- **Sekmeler:** Tek Kategori / Tüm Kategoriler
- Aylık bar grafiği (Charged vs Settled)
- Seçili ay pasta grafiği — kategori bazlı dağılım (`/expensetypes/monthly-breakdown`)
- Kategori altındaki işlem listesi genişletme/daraltma

---

### `/hesaplar` — Hesaplar (HesaplarPage)

Finansal varlıklar ve yükümlülükler:

- **Güncel Bakiyeler:** Tüm Storage/CC/Investment bakiyeleri (live)
- **Sekmeler:** Kredi Kartları / Birikim Hesapları / Yatırımlar
- Her sekme: aylık bar grafiği (income vs expense) + işlem detayı genişletme

---

### `/plan` — Plan (PlanPage)

Taksit planı yönetimi:

- Aktif planların listesi: açıklama, aylık tutar, toplam tutar, tamamlanan taksit sayısı
- Plan oluşturma formu
- Plan silindiğinde ilgili tüm işlemler de silinir

---

### `/raporlar` — Raporlar (RaporlarPage)

Makro finansal bakış:

- **Aylık Özet sekmesi:** Tüm zamanlar için gelir/gider/bakiye line grafiği + tablo
- **Dönem Özeti sekmesi:** Tarih aralığı seçimi, her box için giriş/çıkış/net
- Dönem özeti tablosu yazdırma desteği

---

### `/akis` — Para Akışı (FlowPage)

- Tarih aralığı filtresi
- Kutular arası toplam para akışı görselleştirme (`/api/v1/flows`)
- Tutar büyüklüğüne göre sıralı liste

---

### `/ayarlar` — Ayarlar (DefinitionsPage)

Box tanım yönetimi:

- Tüm box tipleri için ayrı sekmeler
- CRUD: ekle, düzenle, sil
- CreditCard'da `settlement` ve `payment` günleri düzenlenebilir

---

## Veritabanı Şeması

### ERD

```
┌─────────────┐
│  box_types  │
├─────────────┤
│ id (PK)     │
│ name        │
└──────┬──────┘
       │ 1:N
       ▼
┌───────────────────────┐           ┌─────────────────────────┐
│        boxes          │           │     installment_plans    │
├───────────────────────┤           ├─────────────────────────┤
│ id (PK)               │◄──────────│ expense_box_id (FK)      │
│ boxtypeid (FK)        │◄──────────│ payment_box_id (FK)      │
│ name                  │           │ description              │
│ settlement            │           │ start_date               │
│ payment               │           │ total_installments       │
│ minuslimit            │           │ amount_per_month         │
│ pluslimit             │           │ total_amount             │
└──────┬────────────────┘           └─────────────────────────┘
       │ 1:N (frombox)
       │ 1:N (tobox)
       ▼
┌───────────────────────────────┐
│       box_transactions        │
├───────────────────────────────┤
│ id (PK)                       │
│ date                          │
│ frombox (FK → boxes)          │
│ tobox   (FK → boxes)          │
│ description                   │
│ amount                        │
│ info (JSON)                   │
└───────────────────────────────┘

┌────────────────────┐
│   box_directions   │
├────────────────────┤
│ id (PK)            │
│ fromid (FK → box_types) │
│ toid   (FK → box_types) │
└────────────────────┘
```

### SQL Tanımları

```sql
CREATE TABLE box_types (
  id   SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL
);

CREATE TABLE boxes (
  id         SERIAL PRIMARY KEY,
  boxtypeid  INTEGER REFERENCES box_types(id) ON DELETE CASCADE,
  name       VARCHAR NOT NULL,
  settlement INTEGER,
  payment    INTEGER,
  minuslimit NUMERIC(12,2),
  pluslimit  NUMERIC(12,2)
);

CREATE TABLE box_transactions (
  id          SERIAL PRIMARY KEY,
  date        DATE NOT NULL,
  frombox     INTEGER REFERENCES boxes(id) ON UPDATE CASCADE,
  tobox       INTEGER REFERENCES boxes(id) ON UPDATE CASCADE,
  description VARCHAR,
  amount      NUMERIC(12,2),
  info        JSON
);

CREATE TABLE installment_plans (
  id                 SERIAL PRIMARY KEY,
  description        VARCHAR NOT NULL,
  expense_box_id     INTEGER REFERENCES boxes(id) ON DELETE CASCADE,
  payment_box_id     INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
  start_date         DATE NOT NULL,
  total_installments INTEGER NOT NULL,
  amount_per_month   NUMERIC(12,2) NOT NULL,
  total_amount       NUMERIC(12,2)
);

CREATE TABLE box_directions (
  id     SERIAL PRIMARY KEY,
  fromid INTEGER REFERENCES box_types(id) ON DELETE CASCADE,
  toid   INTEGER REFERENCES box_types(id) ON DELETE CASCADE
);
```

**Kurallar:**
- `minuslimit = -1` veya `pluslimit = -1` → Sınırsız
- Taksit planı silinince `expense_box_id` referanslı `box_transactions` da silinir (`ON DELETE CASCADE`)
- `payment_box_id` silinirse `NULL` olur (`ON DELETE SET NULL`)

---

## Örnek Kullanım Senaryoları

### İlk Kurulum

```bash
# 1. Veritabanını formatla (opsiyonel — uygulama başlayınca otomatik oluşur)
curl -X POST http://localhost:5000/api/v1/create

# 2. Gelir kaynağı ekle
curl -X POST http://localhost:5000/api/v1/incomes \
  -H "Content-Type: application/json" \
  -d '{"name":"Maaşım","settlement":0,"payment":0,"minuslimit":0,"pluslimit":100000}'

# 3. Birikim hesabı ekle
curl -X POST http://localhost:5000/api/v1/storages \
  -H "Content-Type: application/json" \
  -d '{"name":"TEB Vadesiz","settlement":0,"payment":0,"minuslimit":0,"pluslimit":-1}'

# 4. Kredi kartı ekle (kesim: 15, ödeme: 5)
curl -X POST http://localhost:5000/api/v1/creditcards \
  -H "Content-Type: application/json" \
  -d '{"name":"Garanti Bonus","settlement":15,"payment":5,"minuslimit":30000,"pluslimit":0}'

# 5. Gider kategorisi ekle
curl -X POST http://localhost:5000/api/v1/expensetypes \
  -H "Content-Type: application/json" \
  -d '{"name":"Market","settlement":0,"payment":0,"minuslimit":0,"pluslimit":5000}'

# 6. Maaş girişi (Dış Kaynak → Maaşım)
curl -X POST http://localhost:5000/api/v1/incomes/transactions \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-01-15","frombox":1,"tobox":2,"description":"Ocak maaşı","amount":50000,"info":null}'

# 7. Maaşı hesaba aktar (Maaşım → TEB Vadesiz)
curl -X POST http://localhost:5000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-01-15","frombox":2,"tobox":3,"description":"Hesaba yatırma","amount":45000,"info":null}'
```

### Kredi Kartı Harcaması

```bash
# Garanti Bonus → Market (kesim 15'ten önce, bu aya ait)
curl -X POST http://localhost:5000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-01-10","frombox":4,"tobox":5,"description":"Migros haftalık","amount":850,"info":null}'

# Garanti Bonus → Market (kesim 15'ten sonra, GELECEK aya ait dönem)
curl -X POST http://localhost:5000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-01-20","frombox":4,"tobox":5,"description":"Migros haftalık","amount":750,"info":null}'
```

### Taksit Planı Oluşturma

```bash
curl -X POST http://localhost:5000/api/v1/installment-plans \
  -H "Content-Type: application/json" \
  -d '{
    "description": "iPhone 15 Pro 12 taksit",
    "expense_box_id": 8,
    "payment_box_id": 3,
    "start_date": "2025-01-10",
    "total_installments": 12,
    "total_amount": 45000
  }'
```

Bu çağrı 12 adet işlemi atomik olarak oluşturur. Her işlemin `info` alanı:
```json
{ "plan_id": 1, "installment_no": 1, "total": 12 }
```

### Bütçe Hedefi Ayarlama

Bir gider kategorisi için aylık bütçe hedefi koyun (gerçek harcamalar yerine plan görüntülenir):

```bash
curl -X POST http://localhost:5000/api/v1/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-02-01",
    "frombox": 5,
    "tobox": 99,
    "description": "Şubat market bütçesi",
    "amount": 3000,
    "info": {"type": "budget"}
  }'
```

---

## Troubleshooting

### "Connection refused" — API'ye bağlanılamıyor

```bash
# API ayakta mı?
curl http://localhost:5000/api/v1/boxtypes

# .env doğru mu?
cat budgetapi/.env

# PostgreSQL çalışıyor mu? (Windows)
net start postgresql-x64-13

# PostgreSQL çalışıyor mu? (Linux/Mac)
pg_ctl status
```

### CORS Hatası

`budgetapi/app.js` dosyasında `app.use(cors())` satırının mevcut olduğunu kontrol edin. Production'da belirli origin tanımlanması önerilir:

```js
app.use(cors({ origin: "https://your-domain.com" }));
```

### React UI API'ye bağlanamıyor

`budgetviewreact/.env` dosyasında:

```env
VITE_API_BASE_URL=http://localhost:5000/api/v1
```

### Tablo bulunamadı / DB hatası

```bash
# Box tabloları oluştu mu?
curl http://localhost:5000/api/v1/boxtypes

# Dış Kaynak box var mı?
curl http://localhost:5000/api/v1/generators

# Gerekirse tam sıfırlama (veri silinir!)
curl -X POST http://localhost:5000/api/v1/create
```

### Taksit işlemleri eksik

Plan oluşturma sırasında `Destroyer` tipinde bir box bulunması gerekir. Yoksa `400: Destroyer box bulunamadı` hatası alırsınız. Ayarlar sayfasından Destroyer tipi bir box ekleyin.

### `seedDatabase` tabloları oluşturmuyor

API başlarken terminalde `Database seed OK.` mesajı görünmüyorsa `.env` değişkenlerini kontrol edin. PostgreSQL'e bağlantı kurulamazsa seed atlanır.

---

## Güvenlik

- **Environment Variables:** Veritabanı bilgilerini `.env` dosyasında tutun, Git'e eklemeyin (`.gitignore`'a dahil)
- **SQL Injection:** Tüm DB sorguları parametreli (`$1`, `$2`, ...) yazılmıştır
- **CORS:** Production'da spesifik origin tanımı yapın
- **docker-compose:** `environment` bloğundaki şifreler production'da Docker secrets veya harici ortam değişkenleriyle yönetilmeli

---

## Versiyon Geçmişi

### v2.0 (2025) — React Frontend

- Vue.js + Quasar'dan React 19 + Vite 8 + TypeScript 6'ya tam geçiş
- TanStack Query 5 ile server state yönetimi ve cache
- Tailwind CSS 3 + Recharts 3 (Bar, Line, Pie)
- Mobil uyumlu bottom navigation (birincil + ikincil öğe ayrımı)
- Koyu/açık tema desteği
- Yeni sayfalar: Harcamalar (gider analizi), Hesaplar (varlık raporları), Raporlar (dönem özeti)
- Yeni box tipleri: Storage, Investment, Generator, Destroyer
- `box_directions` tablosu: hangi box tipinden hangisine transfer yapılabileceği kuralı
- Taksit planları: atomik oluşturma, `info.plan_id` ile işlem takibi
- Para akışı görselleştirme (`/akis`)
- Production Docker: multi-stage build, React statik dosyaları Express üzerinden servis
- Tek komutla başlatma (`npm start` — concurrently)

### v1.0 (2024) — İlk Stabil Versiyon

- Box sistemi implementasyonu (3 tip: Income, CreditCard, ExpenseType)
- CRUD operasyonları, temel raporlama
- Vue.js + Quasar frontend
- Docker desteği

---

Proje Sahibi: [setamodius](https://github.com/setamodius/MyBudget)
