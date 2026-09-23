// Universal in-website Toast Notification System (replaces native alert)
let toastTimer = null;
window.showLuxuryToast = function (title, msg, isError = false) {
  // Allow calling showLuxuryToast("Some message") directly
  if (typeof msg === 'undefined' || typeof msg === 'boolean') {
    isError = typeof msg === 'boolean' ? msg : false;
    msg = title;
    title = isError ? 'Attention' : 'Notification';
  }

  const toast = document.getElementById('universalToast');
  if (!toast) return;

  const toastTitle = document.getElementById('universalToastTitle');
  const toastMsg = document.getElementById('universalToastMsg');
  const toastIcon = document.getElementById('universalToastIcon');

  if (toastTitle) toastTitle.textContent = title || 'Notification';
  if (toastMsg) toastMsg.textContent = msg || '';

  if (toastIcon) {
    if (isError) {
      toastIcon.className = 'w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0';
      toastIcon.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"/></svg>';
    } else {
      toastIcon.className = 'w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0';
      toastIcon.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>';
    }
  }

  toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
  toast.classList.add('translate-y-0', 'opacity-100');

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    toast.classList.remove('translate-y-0', 'opacity-100');
  }, 4000);
};

// Site-wide interceptor: Never allow any native browser alert() dialogs to show!
window.alert = function (message) {
  if (typeof window.showLuxuryToast === 'function') {
    window.showLuxuryToast('Notice', String(message || ''));
  }
};

// Universal in-website Confirmation Modal System (replaces native confirm)
let currentConfirmAction = null;
window.showLuxuryConfirm = function (title, desc, confirmBtnText, onConfirm) {
  const modal = document.getElementById('universalConfirmModal');
  if (!modal) {
    // Fallback if modal DOM is missing
    if (typeof onConfirm === 'function') onConfirm();
    return;
  }

  const titleEl = document.getElementById('confirmModalTitle');
  const descEl = document.getElementById('confirmModalDesc');
  const actionBtn = document.getElementById('confirmModalActionBtn');

  if (titleEl) titleEl.textContent = title || 'Confirmation';
  if (descEl) descEl.textContent = desc || 'Please confirm your action.';
  if (actionBtn) actionBtn.textContent = confirmBtnText || 'Confirm';

  currentConfirmAction = onConfirm;

  modal.classList.remove('opacity-0', 'pointer-events-none');
  const card = modal.querySelector('div');
  if (card) {
    card.classList.remove('scale-95');
    card.classList.add('scale-100');
  }
};

window.hideLuxuryConfirm = function () {
  const modal = document.getElementById('universalConfirmModal');
  if (!modal) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  const card = modal.querySelector('div');
  if (card) {
    card.classList.remove('scale-100');
    card.classList.add('scale-95');
  }
  currentConfirmAction = null;
};

document.addEventListener('DOMContentLoaded', () => {
  // Mobile Navigation Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');

  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileMenu.classList.toggle('hidden');
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', function (e) {
      const id = this.getAttribute('href');
      if (id && id !== '#') {
        const el = document.querySelector(id);
        if (el) {
          e.preventDefault();
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
          }
        }
      }
    });
  });

  // Modal Cancel & Action button handlers
  const cancelBtn = document.getElementById('confirmModalCancelBtn');
  const actionBtn = document.getElementById('confirmModalActionBtn');
  const confirmModal = document.getElementById('universalConfirmModal');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', window.hideLuxuryConfirm);
  }
  if (actionBtn) {
    actionBtn.addEventListener('click', () => {
      const action = currentConfirmAction;
      window.hideLuxuryConfirm();
      if (typeof action === 'function') action();
    });
  }
  if (confirmModal) {
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) window.hideLuxuryConfirm();
    });
  }

  // Fetch and update Cart Count
  async function updateCartCount() {
    try {
      const res = await fetch('/cart/count');
      const data = await res.json();
      const count = data.count || 0;
      document.querySelectorAll('.cart-badge').forEach((badge) => {
        badge.textContent = count;
        if (count === 0) {
          badge.classList.add('opacity-80');
        } else {
          badge.classList.remove('opacity-80');
        }
      });
    } catch (e) {
      // ignore
    }
  }

  updateCartCount();

  // Wishlist handler (in-website luxury toast notification, no native alert)
  document.addEventListener('click', (e) => {
    const wishlistBtn = e.target.closest('[data-action="wishlist"]');
    if (wishlistBtn) {
      e.preventDefault();
      e.stopPropagation();
      const title = wishlistBtn.dataset.title || 'Item';
      if (window.showLuxuryToast) {
        window.showLuxuryToast('Wishlist Updated', `Added "${title}" to your curated wishlist.`);
      }
    }
  });
});
