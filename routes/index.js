const express = require('express');
const router = express.Router();
const db = require('../database/db');

// GET / — Customer storefront
router.get('/', (req, res) => {
  db.all('SELECT * FROM Products ORDER BY id DESC', [], (err, products) => {
    db.all('SELECT name FROM Categories ORDER BY name ASC', [], (catErr, catRows) => {
      const categories = (catRows && catRows.length > 0)
        ? catRows.map(c => c.name)
        : ['Decorated Bags', 'Decorated Parts', 'Decorated Nose Pin', 'Decorated Hair Clip', 'Silk Sarees', 'Haute Couture'];
      res.render('home', {
        title: 'Bunonmela | Luxury Boutique Couture',
        products: products || [],
        categories,
        error: err ? 'Unable to load products.' : null
      });
    });
  });
});

// GET /products/:id and /product/:id — Product Details Page
function handleProductDetail(req, res) {
  const productId = parseInt(req.params.id, 10);
  if (isNaN(productId)) {
    return res.status(404).redirect('/');
  }

  db.get('SELECT * FROM Products WHERE id = ?', [productId], (err, product) => {
    if (err || !product) {
      return res.status(404).render('home', {
        title: 'Product Not Found | Bunonmela',
        products: [],
        error: 'The requested luxury piece could not be located.'
      });
    }

    // Fetch related products (excluding current)
    db.all('SELECT * FROM Products WHERE id != ? ORDER BY id DESC LIMIT 3', [productId], (relErr, related) => {
      res.render('product-detail', {
        title: `${product.title} | Bunonmela Luxury`,
        product,
        relatedProducts: related || [],
        currentUser: req.session ? req.session.user : null
      });
    });
  });
}

router.get('/products/:id', handleProductDetail);
router.get('/product/:id', handleProductDetail);

module.exports = router;
