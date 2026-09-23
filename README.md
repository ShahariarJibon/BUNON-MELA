# 💎 BUNON-MELA (বুনন মেলা) — Luxury Handcrafted Boutique

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-4.21-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![EJS](https://img.shields.io/badge/EJS-Templates-B4CA65?style=for-the-badge&logo=ejs&logoColor=white)](https://ejs.co/)

**Bunon-Mela** is an exclusive, luxury Bangladeshi artisanal boutique and modern e-commerce web platform. Designed to honor authentic heritage weaving and bespoke craftsmanship, it features silk sarees, decorated clutches and bags, antique jewelry, hair jewels, and haute couture apparel.

Built with a fast, dependency-lean stack (**Node.js**, **Express**, **SQLite3**, **EJS**, and **Tailwind CSS**), Bunon-Mela provides an end-to-end shopping experience tailored for Bangladesh—complete with real-time location cascading, dynamic courier rates, promo coupons, manual mobile banking verification, and a comprehensive administrative command center.

---

## 🌟 Key Highlights & Features

### 🛍️ Client Storefront Experience
- **Luxury Aesthetic & Responsive Design:** Elegant typography, fluid micro-interactions, dark plum/amethyst palette, and clean product galleries.
- **Categorized Artisanal Catalogue:**
  - *Silk Sarees*
  - *Decorated Bags & Clutches*
  - *Decorated Nose Pins*
  - *Decorated Hair Clips*
  - *Haute Couture & Festive Wear*
  - *Decorated Parts & Zari Brooches*
- **Rich Product Detail Pages:** High-resolution zoom views, category tags, stock details, and instant "Add to Cart" or "Buy Now".
- **Dynamic Shopping Cart:** Real-time quantity adjustments, price calculations, and subtotal updates.

### 🇧🇩 Bangladesh-Native Checkout Engine
- **3-Tier Cascading Geo-Location System:**
  - Division $\rightarrow$ District $\rightarrow$ Upazila / Thana auto-filtering powered by localized data (`bd_locations.json`).
- **Automated Delivery Fee Calculation:**
  - **Inside Dhaka:** ৳70
  - **Outside Dhaka (Rest of Bangladesh):** ৳130
- **Promotional Coupon Engine:**
  - Apply instant free delivery promo vouchers (e.g. `FREESHIP`, `BUNONMELA`).
- **Flexible Payment Methods:**
  - **Cash on Delivery (COD)**
  - **bKash** (Merchant / Personal with TrxID logging)
  - **Nagad** (Personal with TrxID logging)
  - **Bank Transfer** (Direct invoice & reference slip attachment)

### 🔐 User & Customer Portal
- Secure account registration and login powered by **bcrypt** password hashing.
- **Customer Profile:** View real-time order progression (Pending $\rightarrow$ Processing $\rightarrow$ Shipped $\rightarrow$ Delivered), payment breakdown, delivery addresses, and purchase history.

### 👑 Administrative Command Center (`/admin`)
- **Executive KPI Dashboard:** Total revenue (BDT ৳), total orders count, product count, and registered customer metrics.
- **Order Management:** Filter orders by status, inspect itemized lists, customer contact info, delivery locations, and update statuses in real-time.
- **Product & Inventory Management:** Add, edit, or delete items; upload custom photography; assign categories and adjust pricing.

---

## 🛠️ Tech Stack & Architecture

| Layer | Technology |
| :--- | :--- |
| **Backend Runtime** | Node.js (v18+) |
| **Web Framework** | Express.js 4.x |
| **Database** | SQLite3 (Persistent disk storage, zero configuration) |
| **Session Management** | `express-session` with secure cookies |
| **Authentication** | `bcrypt` (Salt rounds = 10) |
| **Template Engine** | EJS (Embedded JavaScript) |
| **Styling & UI** | Tailwind CSS + Custom Design System (`public/css/style.css`) |
| **File Uploads** | Multer (Direct image storage to `public/uploads`) |

---

## 📂 Project Directory Structure

```text
bunonmela/
├── components/            # UI component definitions (Next.js / shadcn bridge)
│   └── ui/
│       ├── demo.tsx
│       └── hero.tsx       # Live Canvas / WebGL Shader Hero showcase
├── database/
│   └── db.js              # SQLite schema initialization & auto-seeding
├── middleware/
│   └── auth.js            # Authentication & session guard middleware
├── public/
│   ├── css/
│   │   └── style.css      # Core styles & luxury theme definitions
│   ├── images/
│   │   └── payments/      # Payment gateway badges (bKash, Nagad, COD, Banking)
│   ├── js/                # Client-side scripts
│   └── uploads/           # Uploaded product and payment slip images
├── routes/
│   ├── admin.js           # Admin portal routing & CRUD actions
│   ├── auth.js            # Customer registration, login & logout
│   ├── cart.js            # Cart items & quantity modification
│   ├── checkout.js        # Checkout, location cascading & order submission
│   ├── index.js           # Home catalogue & product detail routes
│   └── profile.js         # Customer profile & past orders
├── views/
│   ├── admin.ejs          # Admin control panel
│   ├── checkout.ejs       # 2-step checkout view
│   ├── home.ejs           # Main boutique storefront
│   ├── order-success.ejs  # Post-order confirmation invoice
│   ├── product-detail.ejs # Detailed product preview
│   ├── profile.ejs        # User dashboard & order tracking
│   ├── auth/              # Login & Signup views
│   └── partials/          # Reusable header, footer & navigation
├── bd_locations.json      # Structured Bangladesh administrative divisions data
├── database.sqlite        # SQLite local database
├── package.json           # Dependencies and project scripts
├── server.js              # Application entrypoint & HTTP server
└── SHADCN_SETUP_GUIDE.md  # Guide for optional shadcn / React integration
```

---

## 🚀 Quickstart & Setup Guide

### 1. Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm** or **yarn** / **pnpm**

### 2. Clone the Repository
```bash
git clone https://github.com/ShahariarJibon/BUNON-MELA.git
cd BUNON-MELA
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Run the Application

#### Development Mode (Auto-restart on change):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

### 5. Access the Platform
- **Storefront:** [http://localhost:3000](http://localhost:3000)
- **Admin Dashboard:** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Customer Login:** [http://localhost:3000/auth/login](http://localhost:3000/auth/login)

---

## 🔑 Default Credentials & Demo Keys

### Admin Access
The SQLite database automatically provisions the default administrator account upon initial startup:
- **Email:** `admin@bunonmela.luxury`
- **Password:** `admin123`

### Promotional Coupon Codes
Use these codes at the checkout screen for free delivery:
- `FREESHIP`
- `BUNONMELA`

---

## 📦 Database & Auto-Seed
When the application starts, `database/db.js` automatically creates all required relational tables:
- `Users`
- `Products`
- `Categories`
- `CartItems`
- `Orders`
- `OrderItems`
- `Coupons`

If `database.sqlite` is absent, the system will initialize a fresh database and seed pre-configured artisanal boutique collections.

---

## 🤝 Contributing
Contributions, issues, and feature requests are welcome!
1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License
Distributed under the ISC License. See `package.json` for details.

Developed with passion by **[Shahariar Jibon](https://github.com/ShahariarJibon)**.
