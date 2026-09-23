document.addEventListener('DOMContentLoaded', () => {
  const qtyInput = document.getElementById('qtyInput');
  const qtyMinus = document.getElementById('qtyMinus');
  const qtyPlus = document.getElementById('qtyPlus');
  const btnAddToCart = document.getElementById('btnAddToCart');
  const btnBuyNow = document.getElementById('btnBuyNow');

  const authModal = document.getElementById('authRequiredModal');
  const closeAuthModal = document.getElementById('closeAuthModal');
  const modalAction = document.getElementById('modalAction');
  const modalQuantity = document.getElementById('modalQuantity');
  const modalSignupLink = document.getElementById('modalSignupLink');

  const cartToast = document.getElementById('cartToast');
  let toastTimeout = null;

  // Quantity handlers
  if (qtyMinus && qtyInput) {
    qtyMinus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value, 10) || 1;
      if (val > 1) {
        qtyInput.value = val - 1;
        updateModalQuantity(qtyInput.value);
      }
    });
  }

  if (qtyPlus && qtyInput) {
    qtyPlus.addEventListener('click', () => {
      let val = parseInt(qtyInput.value, 10) || 1;
      if (val < 10) {
        qtyInput.value = val + 1;
        updateModalQuantity(qtyInput.value);
      }
    });
  }

  function updateModalQuantity(qty) {
    if (modalQuantity) modalQuantity.value = qty;
  }

  function showToast(title, msg) {
    if (!cartToast) return;
    if (title) document.getElementById('toastTitle').textContent = title;
    if (msg) document.getElementById('toastMsg').textContent = msg;

    cartToast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    cartToast.classList.add('translate-y-0', 'opacity-100');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      cartToast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
      cartToast.classList.remove('translate-y-0', 'opacity-100');
    }, 4000);
  }

  function openAuthModal(action) {
    if (!authModal) {
      // Fallback: direct redirect
      const qty = qtyInput ? qtyInput.value : 1;
      window.location.href = `/auth/login?redirect=${encodeURIComponent(window.location.pathname)}&action=${action}&productId=${window.currentProductId}&quantity=${qty}`;
      return;
    }

    if (modalAction) modalAction.value = action;
    if (modalQuantity && qtyInput) modalQuantity.value = qtyInput.value;

    if (modalSignupLink) {
      const qty = qtyInput ? qtyInput.value : 1;
      modalSignupLink.href = `/auth/signup?redirect=${encodeURIComponent(window.location.pathname)}&action=${action}&productId=${window.currentProductId}&quantity=${qty}`;
    }

    authModal.classList.remove('opacity-0', 'pointer-events-none');
    authModal.querySelector('.auth-card').classList.remove('scale-95');
    authModal.querySelector('.auth-card').classList.add('scale-100');
  }

  function hideAuthModal() {
    if (!authModal) return;
    authModal.classList.add('opacity-0', 'pointer-events-none');
    authModal.querySelector('.auth-card').classList.remove('scale-100');
    authModal.querySelector('.auth-card').classList.add('scale-95');
  }

  if (closeAuthModal) {
    closeAuthModal.addEventListener('click', hideAuthModal);
  }

  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) hideAuthModal();
    });
  }

  // Add to Cart Click (Strictly requires sign in / sign up)
  if (btnAddToCart) {
    btnAddToCart.addEventListener('click', async () => {
      const isLogged = window.isUserLoggedIn === true;
      const qty = qtyInput ? parseInt(qtyInput.value, 10) : 1;

      if (!isLogged) {
        openAuthModal('add_cart');
        return;
      }

      try {
        btnAddToCart.disabled = true;
        btnAddToCart.classList.add('opacity-75');

        const res = await fetch('/cart/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            productId: window.currentProductId,
            quantity: qty
          })
        });

        const data = await res.json();

        if (res.status === 401 || data.requireAuth) {
          openAuthModal('add_cart');
          return;
        }

        if (data.success) {
          showToast('Added to Shopping Bag', `${qty} piece(s) added successfully.`);
          // Update navbar cart badge
          const cartBadges = document.querySelectorAll('.cart-badge');
          cartBadges.forEach(badge => {
            badge.textContent = data.totalCount;
            badge.classList.remove('hidden');
          });
        }
      } catch (err) {
        console.error('Error adding to cart:', err);
      } finally {
        btnAddToCart.disabled = false;
        btnAddToCart.classList.remove('opacity-75');
      }
    });
  }

  // Buy Now Click (Strictly requires sign in / sign up, then proceeds to checkout)
  if (btnBuyNow) {
    btnBuyNow.addEventListener('click', async () => {
      const isLogged = window.isUserLoggedIn === true;
      const qty = qtyInput ? parseInt(qtyInput.value, 10) : 1;

      if (!isLogged) {
        openAuthModal('buy_now');
        return;
      }

      try {
        btnBuyNow.disabled = true;
        btnBuyNow.classList.add('opacity-75');

        const res = await fetch('/cart/add', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({
            productId: window.currentProductId,
            quantity: qty,
            buyNow: true
          })
        });

        const data = await res.json();
        if (res.status === 401 || data.requireAuth) {
          openAuthModal('buy_now');
          return;
        }

        if (data.redirect) {
          window.location.href = data.redirect;
        } else {
          window.location.href = '/checkout';
        }
      } catch (err) {
        window.location.href = '/checkout';
      } finally {
        btnBuyNow.disabled = false;
        btnBuyNow.classList.remove('opacity-75');
      }
    });
  }
});
