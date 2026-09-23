# shadcn/ui, Tailwind CSS & TypeScript Integration Guide

This guide details how to integrate and use the `ShaderShowcase` component ([hero.tsx](file:///d:/bunonmela/components/ui/hero.tsx)) within a shadcn/ui, Tailwind CSS, and TypeScript environment.

---

## 1. Codebase Architecture Overview

The Bunonmela boutique codebase currently runs as a high-performance **Node.js + Express + EJS + SQLite** application:
- **Server:** Express.js (`server.js`, `routes/index.js`, `routes/cart.js`, `routes/auth.js`)
- **Templates:** EJS (`views/home.ejs`, `views/product-detail.ejs`, `views/cart.ejs`)
- **Styling:** Vanilla CSS design system (`public/css/style.css`) + Tailwind CSS engine
- **Live Animated Hero:** High-performance Canvas/WebGL shader matching the exact visual aesthetics of Paper Shaders

The component files have been copied to the standard shadcn directory:
- [hero.tsx](file:///d:/bunonmela/components/ui/hero.tsx)
- [demo.tsx](file:///d:/bunonmela/components/ui/demo.tsx)

If you plan to develop a Next.js/React frontend with shadcn/ui, follow the setup instructions below.

---

## 2. Setting Up a Project via shadcn CLI, Tailwind & TypeScript

### Step 1: Initialize Next.js with TypeScript & Tailwind CSS
```bash
npx create-next-app@latest my-app --typescript --tailwind --eslint --app --src-dir=false --import-alias="@/*"
cd my-app
```

### Step 2: Initialize shadcn/ui CLI
Run the official shadcn CLI initialization:
```bash
npx shadcn@latest init
```

You will be prompted with configuration choices:
- **Style:** New York (recommended for luxury/modern look)
- **Base color:** Zinc or Slate
- **CSS variables:** Yes (enables dynamic color schemes)
- **Where is your global CSS file?** `app/globals.css`
- **Where is your tailwind.config.js?** `tailwind.config.ts` (or `tailwind.config.js`)
- **Configure import alias for components:** `@/components`
- **Configure import alias for utils:** `@/lib/utils`

### Step 3: Install Required Dependencies for ShaderShowcase
```bash
npm install framer-motion @paper-design/shaders-react clsx tailwind-merge lucide-react
```

---

## 3. Path Standards & Why `/components/ui` Is Critical

### Default Paths
- **Components default path:** `components/ui/`
- **Styles default path:** `app/globals.css` (or `src/app/globals.css`)
- **Utilities path:** `lib/utils.ts`

### Why the `/components/ui` Folder Is Essential
1. **Automated CLI Tooling:**
   The `shadcn` CLI (`npx shadcn@latest add button`, `dialog`, etc.) automatically generates component code into `components/ui/`. If this path does not exist or differs from `components.json`, CLI installations will fail or misplace files.
2. **Separation of Concerns:**
   - `components/ui/`: Contains atomic, unstyled/primitive reusable UI elements (buttons, inputs, cards, shaders, badges).
   - `components/`: Contains domain-specific, composite business components (e.g., `ProductCard`, `CartDrawer`, `Navbar`).
3. **TypeScript Module Aliasing:**
   Configured in `tsconfig.json` so you can cleanly import primitives across the entire application without relative directory traversal:
   ```tsx
   import ShaderShowcase from "@/components/ui/hero";
   import { Button } from "@/components/ui/button";
   ```

---

## 4. Implementation Guidelines & Component Review

### A. Component Structure & Dependencies
- **Motion & Physics:** `framer-motion` for spring animations, hover effects, and continuous SVG rotations.
- **WebGL Shaders:** `@paper-design/shaders-react` for `MeshGradient` and `PulsingBorder`.
- **SVG Filters:** Inline `<svg>` defining `#glass-effect`, `#gooey-filter`, `#logo-glow`, `#logo-gradient`, `#hero-gradient`, and `#text-glow`.

### B. State Management
- `containerRef` (`useRef<HTMLDivElement>`): Handles hover tracking on the canvas container.
- `isActive` (`useState<boolean>`): Toggles interactive states during mouseenter/mouseleave.

### C. Responsive Design
- Desktop: Full viewport (`min-h-screen`), large typography (`text-8xl`), absolute floating action clusters.
- Mobile (Android & iOS): Text adapts via Tailwind's responsive classes (`text-4xl md:text-6xl lg:text-8xl`), overflow hidden prevents horizontal scrolling, and touch events cleanly interface with canvas shaders.
