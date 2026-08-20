// ==================================================================
// Workshop Registration Page Generator + FTP Publisher
// ----------------------------------------------------------------
// When a workshop is created (or updated) through the admin panel,
// this service:
//   1. Generates a full HTML registration page (design identical to
//      up-up-away-workshop-register.html / strawberry-cottage-register.html)
//   2. Generates the matching workshop JS file
//   3. Uploads both files to the live website via FTP (FTP_* env vars)
// ==================================================================

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const ftp = require('basic-ftp');
const workshopRuntimeConfig = require('./workshopRuntimeConfig.service');

// ==================== HELPERS ====================

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const normalizeWorkshop = (w) => {
  const name = String(w.name || '').trim() || 'Clay Workshop';
  const slug = String(w.slug || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'clay-workshop';
  const emoji = String(w.emoji || '').trim();
  const price = Number(w.price) || 0;
  const date = w.date ? new Date(w.date) : new Date();
  const timeStart = String(w.timeStart || '11:00 AM').trim();
  const timeEnd = String(w.timeEnd || '1:00 PM').trim();
  const duration = String(w.duration || '2 Hours').trim();
  const capacity = Number(w.capacity) || 30;
  const ageMin = Number(w.ageMin) || 5;
  const ageMax = Number(w.ageMax) || 14;
  const badge = String(w.badge || 'New').trim();
  const shortDescription = String(w.shortDescription || '').trim();
  const description = String(w.description || shortDescription || '').trim();
  const highlights = Array.isArray(w.highlights) ? w.highlights : [];
  const features = Array.isArray(w.features) ? w.features : [];

  // Registration page name (admin can override; fallback derives from slug)
  const slugBase = slug.replace(/-workshop$/i, '');
  const registrationPageUrl = String(w.registrationPageUrl || `${slugBase}-register.html`).trim();

  // JS filename derived from the page name so it always matches what the
  // generated HTML <script> tag points to, e.g.
  //   strawberry-cottage-register.html        -> strawberry-cottage-workshop.js
  //   up-up-away-workshop-register.html       -> up-up-away-workshop.js
  const pageBase = registrationPageUrl
    .replace(/\.html?$/i, '')
    .replace(/-(?:workshop-)?register$/i, '');
  const jsFileName = `${pageBase}-workshop.js`;

  const dateString = date.toISOString().split('T')[0];
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
  const dateNumber = date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const dateId = `date-${dateString}`;

  const batchValue = [name, emoji].filter(Boolean).join(' ') + ` ⏰ ${timeStart} - ${timeEnd}`;

  return {
    name, slug, emoji, price, date, dateString, weekday, dateNumber, dateId,
    timeStart, timeEnd, duration, capacity, ageMin, ageMax, badge,
    shortDescription, description, highlights, features,
    registrationPageUrl, jsFileName, batchValue
  };
};

const renderFeatureItem = (h) => {
  const icon = String(h.icon || h.icon || '').trim();
  let iconHtml;
  if (icon.indexOf('fa-') !== -1 || icon.indexOf('fa ') === 0) {
    iconHtml = `<i class="${escapeHtml(icon)}"></i>`;
  } else {
    iconHtml = escapeHtml(icon) || '🎨';
  }
  return `
                <li class="feature-item">
                  <div class="feature-icon-box">${iconHtml}</div>
                  <div class="feature-text">
                    <h5>${escapeHtml(h.title || '')}</h5>
                    <p>${escapeHtml(h.description || '')}</p>
                  </div>
                </li>`;
};

const renderExpectItem = (feature) => `
                  <li class="expect-item">${escapeHtml(feature)}</li>`;

// ==================== HTML TEMPLATE ====================

const generateHtml = (workshop) => {
  const w = normalizeWorkshop(workshop);

  const defaultHighlights = [
    { icon: w.emoji || '🎨', title: w.name, description: w.shortDescription || 'Kids create their very own masterpiece with expert guidance.' },
    { icon: '💰', title: `Price: Only ₹${w.price}`, description: 'All materials included! High-quality clay, tools, and expert guidance.' },
    { icon: '🎒', title: 'Certificate Included', description: 'Every participant gets a certificate from Lil Sculpr Clay Academy!' }
  ];

  const featureItems = (w.highlights.length ? w.highlights : defaultHighlights).map(renderFeatureItem).join('');

  const defaultExpect = [
    'Step-by-step expert guidance',
    'All clay & tools provided',
    'Take home your creation',
    'Certificate for all participants',
    `Fun & engaging ${w.duration.toLowerCase() || '2-hour'} session`,
    `Perfect for ages ${w.ageMin}-${w.ageMax}`
  ];

  const expectItems = (w.features.length ? w.features : defaultExpect).map(renderExpectItem).join('');

  const metaDescription = `${w.shortDescription || w.description} Ages ${w.ageMin}-${w.ageMax}. All materials included! Rs. ${w.price} only.`;
  const pageTitle = `${w.name}${w.emoji ? ' ' + w.emoji : ''} | Lil Sculpr`;
  const breadcrumbTitle = `${w.name}${w.emoji ? ' ' + w.emoji : ''}`;
  const formSubtitle = w.shortDescription || w.description;

  return `<!doctype html>
<html class="no-js" lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="IE=edge" />
    <title>${pageTitle}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <!-- SEO Essentials -->
    <meta name="author" content="Lil Sculpr Clay Modeling Academy" />
    <meta
      name="description"
      content="${escapeHtml(metaDescription)}"
    />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta
      property="og:title"
      content="${pageTitle}"
    />
    <meta
      property="og:description"
      content="${escapeHtml(metaDescription)}"
    />
    <meta property="og:image" content="assets/img/logo.webp" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta
      property="twitter:title"
      content="${pageTitle}"
    />
    <meta
      property="twitter:description"
      content="${escapeHtml(metaDescription)}"
    />
    <meta property="twitter:image" content="assets/img/logo.webp" />
    <link
      rel="canonical"
      href="https://www.lilsculpr.com/${w.registrationPageUrl}"
    />

    <!-- Google Tag Manager -->
    <script>
      (function (w, d, s, l, i) {
        w[l] = w[l] || [];
        w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
        var f = d.getElementsByTagName(s)[0],
          j = d.createElement(s),
          dl = l != "dataLayer" ? "&l=" + l : "";
        j.async = true;
        j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
        f.parentNode.insertBefore(j, f);
      })(window, document, "script", "dataLayer", "GTM-KK89945D");
    </script>

    <!-- Favicons -->
    <link rel="icon" href="favicon.ico" sizes="any" />
    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png" />
    <link
      rel="icon"
      type="image/png"
      sizes="192x192"
      href="android-chrome-192x192.png"
    />
    <link
      rel="icon"
      type="image/png"
      sizes="512x512"
      href="android-chrome-512x512.png"
    />
    <link rel="apple-touch-icon" sizes="180x180" href="apple-touch-icon.png" />

    <!-- Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@400;500;600;700;800&family=Catamaran:wght@100;200;300;400;500;600;700;800;900&display=swap"
      media="print"
      onload="this.media = 'all'"
    />

    <!-- Critical CSS -->
    <link rel="stylesheet" href="assets/css/bootstrap.min.css" />
    <link rel="stylesheet" href="assets/css/style.min.css" />

    <!-- Plugin CSS -->
    <link
      rel="stylesheet"
      href="assets/css/fontawesome.min.css"
      media="print"
      onload="this.media = 'all'"
    />
    <link
      rel="stylesheet"
      href="assets/css/magnific-popup.min.css"
      media="print"
      onload="this.media = 'all'"
    />
    <link
      rel="stylesheet"
      href="assets/css/slick.min.css"
      media="print"
      onload="this.media = 'all'"
    />

    <!-- Razorpay SDK -->
    <script src="https://checkout.razorpay.com/v1/checkout.js"></script>

    <noscript>
      <link rel="stylesheet" href="assets/css/fontawesome.min.css" />
      <link rel="stylesheet" href="assets/css/magnific-popup.min.css" />
      <link rel="stylesheet" href="assets/css/slick.min.css" />
    </noscript>

    <!-- Facebook Pixel -->
    <script>
      !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
          n.callMethod
            ? n.callMethod.apply(n, arguments)
            : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
      })(
        window,
        document,
        "script",
        "https://connect.facebook.net/en_US/fbevents.js"
      );
      fbq("init", "886450287373984");
      fbq("track", "PageView");
    </script>

    <style>
      .fal,
      .fab,
      .fas,
      .far {
        font-display: swap;
      }

      /* Custom Workshop Styles */
      .workshop-highlights-card {
        background: #fff;
        border-radius: 20px;
        padding: 35px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        border: 1px solid rgba(156, 41, 178, 0.1);
        position: relative;
        overflow: hidden;
      }

      .workshop-highlights-card .patriotic-border {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, #ff6b00, #ff9800, #ffc107);
      }

      .info-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
      }

      .info-tag {
        background: #f5f0ff;
        padding: 8px 16px;
        border-radius: 30px;
        font-size: 0.85rem;
        font-weight: 600;
        color: #4a4a4a;
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }

      .info-tag i {
        color: #9c29b2;
      }

      .feature-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .feature-item {
        display: flex;
        gap: 15px;
        padding: 12px 0;
        border-bottom: 1px solid #f0edf5;
      }

      .feature-item:last-child {
        border-bottom: none;
      }

      .feature-icon-box {
        font-size: 28px;
        flex-shrink: 0;
        width: 50px;
        text-align: center;
      }

      .feature-text h5 {
        font-size: 1rem;
        font-weight: 700;
        margin-bottom: 4px;
        color: #2d3748;
      }

      .feature-text p {
        font-size: 0.9rem;
        color: #6b7280;
        margin: 0;
      }

      .what-to-expect {
        margin-top: 20px;
        padding: 20px;
        background: #f8f7ff;
        border-radius: 12px;
      }

      .expect-title {
        font-weight: 700;
        font-size: 1rem;
        color: #2d3748;
        display: block;
        margin-bottom: 10px;
      }

      .expect-list {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .expect-item {
        font-size: 0.85rem;
        color: #4a5568;
        padding-left: 24px;
        position: relative;
      }

      .expect-item::before {
        content: "\\2713";
        position: absolute;
        left: 0;
        color: #9c29b2;
        font-weight: 700;
      }

      /* Glass Card Effect */
      .glass-card {
        background: rgba(255, 255, 255, 0.95);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
      }

      /* Form Styles */
      .appointment-form .form-control {
        border-radius: 10px;
        padding: 12px 16px;
        border: 1.5px solid #e8e4f0;
        font-size: 0.95rem;
        transition: all 0.3s ease;
      }

      .appointment-form .form-control:focus {
        border-color: #9c29b2;
        box-shadow: 0 0 0 3px rgba(156, 41, 178, 0.1);
      }

      .appointment-form label {
        font-weight: 600;
        color: #2d3748;
        font-size: 0.85rem;
        margin-bottom: 6px;
      }

      /* Date Selection */
      .date-selection {
        display: flex;
        flex-wrap: wrap;
        gap: 15px;
      }

      .date-option {
        flex: 1;
        min-width: 140px;
      }

      .date-option input[type="radio"] {
        display: none;
      }

      .date-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 15px 20px;
        border: 2px solid #e8e4f0;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
        background: #fff;
        text-align: center;
        height: 100%;
        min-height: 90px;
        justify-content: center;
      }

      .date-option input[type="radio"]:checked + .date-label {
        border-color: #9c29b2;
        background: #f8f0ff;
        box-shadow: 0 0 0 3px rgba(156, 41, 178, 0.15);
      }

      .date-option input[type="radio"]:checked + .date-label .date-number {
        color: #9c29b2;
      }

      .date-label:hover {
        border-color: #9c29b2;
        transform: translateY(-2px);
      }

      .date-day {
        font-size: 0.7rem;
        text-transform: uppercase;
        color: #6b7280;
        font-weight: 600;
        letter-spacing: 0.5px;
      }

      .date-number {
        font-size: 28px;
        font-weight: 800;
        color: #2d3748;
        line-height: 1.2;
      }

      .date-month {
        font-size: 0.75rem;
        color: #6b7280;
        font-weight: 500;
      }

      /* Payment Status */
      .payment-status {
        display: none;
        padding: 15px 20px;
        border-radius: 10px;
        margin-bottom: 20px;
        font-weight: 500;
      }

      .payment-status.success {
        display: block;
        background: #dcfce7;
        color: #166534;
        border: 1px solid #86efac;
      }

      .payment-status.error {
        display: block;
        background: #fee2e2;
        color: #991b1b;
        border: 1px solid #fca5a5;
      }

      .payment-status.info {
        display: block;
        background: #dbeafe;
        color: #1e40af;
        border: 1px solid #93c5fd;
      }

      /* Payment Loading Overlay */
      .payment-loading {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        z-index: 9999;
        align-items: center;
        justify-content: center;
      }

      .payment-loading.active {
        display: flex;
      }

      .payment-loading-content {
        background: #fff;
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        max-width: 400px;
        width: 90%;
      }

      .payment-spinner {
        width: 50px;
        height: 50px;
        border: 4px solid #f0edf5;
        border-top-color: #9c29b2;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin: 0 auto 20px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .payment-loading-content h4 {
        font-weight: 700;
        color: #2d3748;
        margin-bottom: 10px;
      }

      .payment-loading-content p {
        color: #6b7280;
        font-size: 0.9rem;
        margin: 0;
      }

      /* Button Loader */
      .button-loader {
        display: none;
        width: 20px;
        height: 20px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
        margin-left: 10px;
        vertical-align: middle;
      }

      .btn-loading .btn-text {
        opacity: 0.7;
      }

      .btn-loading .button-loader {
        display: inline-block;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .workshop-highlights-card {
          padding: 20px;
        }

        .expect-list {
          grid-template-columns: 1fr;
        }

        .date-label {
          padding: 12px 16px;
          min-height: 70px;
        }

        .date-number {
          font-size: 22px;
        }
      }

      @media (max-width: 480px) {
        .info-tags {
          gap: 6px;
        }

        .info-tag {
          font-size: 0.75rem;
          padding: 6px 12px;
        }

        .feature-item {
          flex-direction: column;
          gap: 5px;
          text-align: center;
        }

        .feature-icon-box {
          margin: 0 auto;
        }
      }

      /* Payment Result Modals */
      .payment-modal-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        z-index: 99999;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }

      .payment-modal-overlay.active {
        display: flex;
      }

      .payment-modal {
        background: #fff;
        border-radius: 24px;
        padding: 40px;
        text-align: center;
        max-width: 440px;
        width: 92%;
        position: relative;
        animation: modalIn 0.3s ease;
      }

      @keyframes modalIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      .modal-icon {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 20px;
        font-size: 40px;
        font-weight: 700;
      }

      .modal-icon.success {
        background: #dcfce7;
        color: #16a34a;
      }

      .modal-icon.failure {
        background: #fee2e2;
        color: #dc2626;
      }

      .payment-modal h3 {
        font-weight: 800;
        margin-bottom: 8px;
        color: #2d3748;
        font-size: 1.4rem;
      }

      .payment-modal p {
        color: #6b7280;
        font-size: 0.95rem;
        margin-bottom: 24px;
        line-height: 1.5;
      }

      .modal-btn {
        display: inline-block;
        padding: 12px 32px;
        border-radius: 12px;
        font-weight: 700;
        font-size: 0.95rem;
        border: none;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        font-family: inherit;
      }

      .modal-btn.success-btn {
        background: #9c29b2;
        color: #fff;
      }

      .modal-btn.success-btn:hover {
        background: #7e22a0;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(156, 41, 178, 0.3);
      }

      .modal-btn.failure-btn {
        background: #dc2626;
        color: #fff;
      }

      .modal-btn.failure-btn:hover {
        background: #b91c1c;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(220, 38, 38, 0.3);
      }

      .modal-details {
        background: #f8f7ff;
        border-radius: 12px;
        padding: 16px 20px;
        margin-bottom: 24px;
        text-align: left;
      }

      .modal-details .detail-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 0;
        border-bottom: 1px solid #f0edf5;
      }

      .modal-details .detail-row:last-child {
        border-bottom: none;
      }

      .modal-details .detail-label {
        font-size: 0.8rem;
        color: #6b7280;
        font-weight: 500;
      }

      .modal-details .detail-value {
        font-size: 0.9rem;
        color: #2d3748;
        font-weight: 600;
      }
    </style>
  </head>

  <body>
    <!-- Google Tag Manager (noscript) -->
    <noscript
      ><iframe
        src="https://www.googletagmanager.com/ns.html?id=GTM-KK89945D"
        height="0"
        width="0"
        style="display: none; visibility: hidden"
      ></iframe
    ></noscript>
    <noscript
      ><img
        height="1"
        width="1"
        style="display: none"
        src="https://www.facebook.com/tr?id=886450287373984&ev=PageView&noscript=1"
    /></noscript>

    <!-- Search Popup -->
    <div class="popup-search-box d-none d-lg-block">
      <button class="searchClose border-theme text-theme">
        <i class="fal fa-times"></i>
      </button>
      <form action="#">
        <input
          type="text"
          class="border-theme"
          placeholder="What are you looking for"
        />
        <button type="submit"><i class="fal fa-search"></i></button>
      </form>
    </div>

    <!-- Mobile Menu -->
    <div class="vs-menu-wrapper">
      <div class="vs-menu-area">
        <button class="vs-menu-toggle" aria-label="Open mobile menu">
          <i class="fal fa-times"></i>
        </button>
        <div class="mobile-logo">
          <a href="index.html"
            ><img
              src="assets/img/logo.webp"
              alt="Lil Sculpr Logo"
              width="188"
              height="102"
          /></a>
        </div>
        <div class="vs-mobile-menu">
          <ul>
            <li><a href="index.html">Home</a></li>
            <li><a href="about.html">About</a></li>
            <li><a href="classes.html">Classes</a></li>
            <li><a href="gallery.html">Gallery</a></li>
            <li><a href="blog.html">Blog</a></li>
            <li><a href="awards.html">Awards</a></li>
            <li><a href="contact.html">Contact</a></li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Header -->
    <header class="vs-header">
      <!-- Top Bar -->
      <div class="header-top-area d-none d-lg-block">
        <div class="container">
          <div class="row align-items-center justify-content-between">
            <div class="col-auto">
              <div class="header-links">
                <ul>
                  <li>
                    <i class="fal fa-clock"></i>3:00 pm - 8:00 pm - Tue - Sun
                  </li>
                  <li>
                    <i class="fal fa-phone"></i
                    ><a href="tel:+919600443185">+91 96 00 44 31 85</a>
                  </li>
                  <li>
                    <i class="fal fa-map-marker-alt"></i>468 A, C sector, 2nd
                    Street, AE Block, Anna Nagar West Extension, Chennai -
                    600101
                  </li>
                </ul>
              </div>
            </div>
            <div class="col-auto">
              <div class="header-social">
                <ul>
                  <li>
                    <a
                      href="https://www.facebook.com/profile.php?id=61583300934216"
                      ><i class="fab fa-facebook-f"></i
                    ></a>
                  </li>
                  <li>
                    <a href="https://www.pinterest.com/lilsculpr/"
                      ><i class="fab fa-pinterest-p"></i
                    ></a>
                  </li>
                  <li>
                    <a href="https://www.instagram.com/lilsculpr/"
                      ><i class="fab fa-instagram"></i
                    ></a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Menu -->
      <div class="sticky-wrapper">
        <div class="sticky-active">
          <div class="header-menu-area">
            <div class="container position-relative">
              <div class="row gx-20 align-items-center justify-content-between">
                <div class="col-auto">
                  <div class="header-logo">
                    <a href="index.html">
                      <img
                        src="assets/img/logo.webp"
                        alt="Lil Sculpr Logo"
                        width="188"
                        height="102"
                      />
                    </a>
                  </div>
                </div>
                <div class="col-auto">
                  <nav class="main-menu menu-style1 d-none d-lg-inline-block">
                    <ul>
                      <li><a href="index.html">Home</a></li>
                      <li><a href="about.html">About</a></li>
                      <li><a href="classes.html">Classes</a></li>
                      <li><a href="gallery.html">Gallery</a></li>
                      <li><a href="blog.html">Blog</a></li>
                      <li>
                        <a href="./workshops.html">Workshop</a>
                      </li>
                      <li><a href="awards.html">Awards</a></li>
                    </ul>
                  </nav>
                  <button
                    type="button"
                    class="vs-menu-toggle d-block d-lg-none"
                    aria-label="Open mobile menu"
                  >
                    <i class="fal fa-bars"></i> Menu
                  </button>
                </div>
                <div class="col-auto d-none d-xl-block">
                  <div class="header-button">
                    <a href="contact.html" class="vs-btn wave-btn"
                      >Contact Us</a
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Breadcrumb -->
    <div
      class="breadcumb-wrapper"
      data-bg-src="./assets/img/lil-sculpr/coverimg.webp"
    >
      <div class="container">
        <div class="breadcumb-content">
          <h2 class="breadcumb-title">${escapeHtml(breadcrumbTitle)}</h2>
          <ul class="breadcumb-menu">
            <li><a href="index.html">Home</a></li>
            <li><a href="workshops.html">Workshops</a></li>
            <li class="active">${escapeHtml(w.name)}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Workshop Registration Section -->
    <section
      class="appointment-section space-bottom space-top-shape-plus position-relative overflow-hidden"
    >
      <!-- Background Blobs -->
      <div class="design-blob blob-saffron"></div>
      <div class="design-blob blob-green"></div>

      <div class="container position-relative z-index-2">
        <div
          class="row gx-60 gy-30 flex-column-reverse flex-lg-row align-items-center"
        >
          <!-- Form Column -->
          <div class="col-lg-7 wow fadeInLeft" data-wow-delay="0.1s">
            <!-- Payment Status -->
            <div id="payment-status" class="payment-status"></div>

            <form id="workshopForm" class="appointment-form ajax-contact glass-card">
              <div class="patriotic-border"></div>

              <!-- Form Header -->
              <div class="form-header-decoration mb-3 text-center">
                <span
                  class="badge bg-soft-saffron text-saffron px-3 py-1 rounded-pill mb-1 bouncy"
                >
                  ${escapeHtml(w.emoji + ' ' + w.badge)} — Only ${w.capacity} Seats!
                </span>
                <h2 class="form-title h4 mb-1">${escapeHtml(breadcrumbTitle)}</h2>
                <p class="text-muted small mb-0">
                  ${escapeHtml(formSubtitle)}${w.emoji ? ' ' + escapeHtml(w.emoji) : ''}
                </p>
              </div>

              <div class="row gx-20">
                <!-- Parent Name -->
                <div class="form-group col-sm-6 mb-2">
                  <label for="parentName"
                    ><i class="fas fa-user-tie mr-2"></i> Parent Name</label
                  >
                  <input
                    type="text"
                    class="form-control"
                    name="parentName"
                    id="parentName"
                    placeholder="Parent name"
                    required
                  />
                </div>

                <!-- Phone Number -->
                <div class="form-group col-sm-6 mb-2">
                  <label for="phone"
                    ><i class="fas fa-phone-alt mr-2"></i> Phone Number</label
                  >
                  <input
                    type="tel"
                    class="form-control"
                    name="phone"
                    id="phone"
                    placeholder="Mobile number"
                    required
                  />
                </div>

                <!-- Email -->
                <div class="form-group col-12 mb-2">
                  <label for="email"
                    ><i class="fas fa-envelope mr-2"></i> Email Address</label
                  >
                  <input
                    type="email"
                    class="form-control"
                    name="email"
                    id="email"
                    placeholder="example@email.com"
                    required
                  />
                </div>

                <!-- Child Name -->
                <div class="form-group col-sm-6 mb-2">
                  <label for="childName"
                    ><i class="fas fa-child mr-2"></i> Child's Name</label
                  >
                  <input
                    type="text"
                    class="form-control"
                    name="childName"
                    id="childName"
                    placeholder="Child's name"
                    required
                  />
                </div>

                <!-- Child Age -->
                <div class="form-group col-sm-6 mb-2">
                  <label for="childAge"
                    ><i class="fas fa-birthday-cake mr-2"></i> Child's Age</label
                  >
                  <input
                    type="number"
                    class="form-control"
                    name="childAge"
                    id="childAge"
                    placeholder="Age (${w.ageMin}-${w.ageMax})"
                    min="${w.ageMin}"
                    max="${w.ageMax}"
                    required
                  />
                </div>

                <!-- Workshop Date -->
                <div class="form-group col-12 mb-3">
                  <label class="form-label fw-bold mb-2">
                    <i class="fas fa-calendar-alt me-2 text-saffron"></i>Workshop Date
                  </label>

                  <div class="date-selection">
                    <div class="date-option" style="width: 100%;">
                      <input
                        type="radio"
                        name="selectedDate"
                        id="${w.dateId}"
                        value="${w.dateString}"
                        class="date-radio"
                        required
                        checked
                      />
                      <label for="${w.dateId}" class="date-label">
                        <span class="date-day">${w.weekday}</span>
                        <span class="date-number">${w.dateNumber}</span>
                        <span class="date-month">${w.timeStart} - ${w.timeEnd}</span>
                      </label>
                    </div>
                  </div>
                  <div
                    id="date-error"
                    class="text-danger small mt-1"
                    style="display: none"
                  ></div>
                </div>

                <!-- Slot Availability -->
                <div class="form-group col-12 mb-3" style="display: none;">
                  <div id="slotIndicator" class="slot-indicator p-3 rounded text-center" style="background: #f0fdf4; border: 1px solid #86efac;">
                    <div style="font-size: 14px; font-weight: 600; color: #166534;">
                      <span id="slotCount">—</span> / <span id="slotCapacity">${w.capacity}</span> slots remaining
                    </div>
                    <div class="slot-bar mt-2" style="height: 6px; background: #dcfce7; border-radius: 3px; overflow: hidden;">
                      <div id="slotFill" style="height: 100%; width: 0%; background: #22c55e; border-radius: 3px; transition: width 0.5s ease;"></div>
                    </div>
                    <div id="slotStatusText" style="font-size: 12px; color: #166534; margin-top: 4px;">Checking availability...</div>
                  </div>
                </div>

                <!-- Batch Selection -->
                <div class="form-group col-12 mb-3">
                  <label class="form-label fw-bold mb-2">
                    <i class="fas fa-clock me-2 text-navy"></i>Workshop Time
                  </label>
                  <select
                    name="selectedBatch"
                    id="selectedBatch"
                    class="form-select style2"
                    required
                  >
                    <option value="${escapeHtml(w.batchValue)}" selected>
                      ${escapeHtml(w.batchValue)}
                    </option>
                  </select>
                  <div
                    id="batch-error"
                    class="text-danger small mt-1"
                    style="display: none"
                  ></div>
                </div>

                <!-- Hidden Fields -->
                <input type="hidden" name="materialType" id="materialTypeHidden" value="true" />
                <input type="hidden" name="carnivalName" id="carnivalName" value="${escapeHtml(w.name)}" />

                <!-- Payment Confirmation -->
                <div class="col-12 mb-3">
                  <div class="custom-checkbox-wrapper p-2 rounded bg-light border">
                    <div class="form-check">
                      <input
                        class="form-check-input"
                        type="checkbox"
                        id="paymentConfirm"
                        required
                      />
                      <label class="form-check-label small" for="paymentConfirm">
                        I understand that payment of <strong>₹${w.price}</strong> is required to confirm registration.
                        All materials and certificate are included.
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Submit Button -->
                <div class="col-12 text-center">
                  <button type="submit" class="vs-btn wave-btn w-100" id="submitBtn">
                    <span class="btn-text">💰 Pay ₹${w.price} & Register Now</span>
                    <span class="button-loader"></span>
                  </button>
                </div>
              </div>
            </form>
          </div>

          <!-- Info Column -->
          <div class="col-lg-5 wow fadeInRight" data-wow-delay="0.1s">
            <div class="workshop-highlights-card glass-card">
              <div class="patriotic-border"></div>
              <span class="sec-subtitle text-danger mb-2 d-block"
                >${escapeHtml(breadcrumbTitle)}</span
              >
              <h3 class="h2 mb-3">
                ${escapeHtml(w.name)}${w.emoji ? ' ' + escapeHtml(w.emoji) : ''}
              </h3>

              <div class="info-tags mb-4">
                <span class="info-tag"
                  ><i class="fas fa-calendar-alt"></i> ${w.dateNumber}</span
                >
                <span class="info-tag"
                  ><i class="fas fa-money-bill-wave"></i> ₹${w.price} Only</span
                >
                <span class="info-tag"
                  ><i class="fas fa-clock"></i> ${w.timeStart} - ${w.timeEnd}</span
                >
                <span class="info-tag"
                  ><i class="fas fa-users"></i> ${w.capacity} Slots Only</span
                >
              </div>

              <ul class="feature-list">
                ${featureItems}
              </ul>

              <div class="what-to-expect">
                <span class="expect-title">🎯 Workshop Highlights:</span>
                <ul class="expect-list">
                  ${expectItems}
                </ul>
              </div>

              <div class="mt-4 text-center">
                <p class="small text-muted mb-0">
                  ${w.emoji ? escapeHtml(w.emoji) + ' ' : ''}Limited to ${w.capacity} seats — secure your child's spot today!${w.emoji ? ' ' + escapeHtml(w.emoji) : ''}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Payment Loading Overlay -->
      <div id="paymentLoading" class="payment-loading">
        <div class="payment-loading-content">
          <div class="payment-spinner"></div>
          <h4>Processing Payment...</h4>
          <p>Please wait while we process your payment. Do not close this window.</p>
        </div>
      </div>

      <!-- Payment Success Modal -->
      <div id="paymentSuccessModal" class="payment-modal-overlay">
        <div class="payment-modal">
          <div class="modal-icon success">&#10003;</div>
          <h3>Payment Successful! &#127881;</h3>
          <p>Your child's seat is confirmed. Check your email for the workshop details.</p>
          <div class="modal-details">
            <div class="detail-row">
              <span class="detail-label">Workshop</span>
              <span class="detail-value" id="successWorkshop">${escapeHtml(w.name)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Date &amp; Time</span>
              <span class="detail-value">${w.dateNumber} &#183; ${w.timeStart} - ${w.timeEnd}</span>
            </div>
          </div>
          <button class="modal-btn success-btn" id="successModalBtn">Continue</button>
        </div>
      </div>

      <!-- Payment Failure Modal -->
      <div id="paymentFailureModal" class="payment-modal-overlay">
        <div class="payment-modal">
          <div class="modal-icon failure">&#10007;</div>
          <h3>Payment Failed</h3>
          <p id="failureMessage">Something went wrong. Please try again.</p>
          <button class="modal-btn failure-btn" id="failureModalBtn">Try Again</button>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer
      class="footer-wrapper footer-layout3"
      data-bg-src="assets/img/bg/footer-4.webp"
    >
      <div class="widget-area">
        <div class="container">
          <div class="row justify-content-between">
            <div class="col-xl-auto col-md-6">
              <div class="widget footer-widget">
                <div class="vs-widget-about">
                  <div class="about-logo">
                    <a href="index.html">
                      <img
                        src="./assets/img/logo.webp"
                        alt="Lil Sculpr Logo"
                        width="180"
                        height="60"
                        loading="lazy"
                      />
                    </a>
                  </div>
                  <p class="about-text">
                    Lil Sculpr offers fun and structured clay modelling classes
                    for kids in Chennai. Learn clay art from basics to advanced
                    with expert guidance.
                  </p>
                  <div class="multi-social">
                    <a href="https://www.facebook.com/profile.php?id=61583300934216"
                      ><i class="fab fa-facebook-f"></i
                    ></a>
                    <a href="https://www.pinterest.com/lilsculpr/"
                      ><i class="fab fa-pinterest-p"></i
                    ></a>
                    <a href="https://www.instagram.com/lilsculpr/"
                      ><i class="fab fa-instagram"></i
                    ></a>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-xl-auto col-md-6">
              <div class="widget footer-widget widget_nav_menu">
                <h4 class="widget_title">Details Info</h4>
                <ul class="menu">
                  <li><a href="classes.html">Classes</a></li>
                  <li><a href="contact.html">Appointment</a></li>
                  <li><a href="about.html">About Us</a></li>
                  <li><a href="gallery.html">Gallery</a></li>
                  <li>
                    <a href="return-refund-policy.html">Return & Refund Policy</a>
                  </li>
                  <li><a href="terms-and-conditions.html">Terms & Conditions</a></li>
                  <li><a href="privacy-policy.html">Privacy Policy</a></li>
                </ul>
              </div>
            </div>

            <div class="col-xl-auto col-md-6">
              <div class="widget footer-widget">
                <h3 class="widget_title">Contact Us</h3>
                <div class="vs-widget-contact">
                  <p class="footer-info">
                    <i class="fas fa-map-marker-alt"></i>468 A, C sector, 2nd
                    Street, AE Block, Anna Nagar West Extension,
                    Chennai - 600101
                  </p>
                  <p class="footer-info">
                    <i class="fas fa-envelope"></i
                    ><a href="mailto:lilsculpr@gmail.com">lilsculpr@gmail.com</a>
                  </p>
                  <p class="footer-info">
                    <i class="fas fa-phone-alt"></i
                    ><a href="tel:+919600443185">+91 96 00 44 31 85</a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="footer-copyright">
        <div class="container">
          <p class="copyright">
            &copy; Lil Sculpr. All Rights Reserved. |
            <a href="https://www.swiflare.com/"
              >Designed & Developed by Swiflare Ai Innovations</a
            >
          </p>
        </div>
      </div>
    </footer>

    <!-- Scroll To Top -->
    <a href="#" class="scrollToTop scroll-btn"
      ><i class="fas fa-chevron-up"></i
    ></a>
    <a href="https://wa.me/919600443185" class="whatsapp-float" target="_blank">
      <i class="fab fa-whatsapp"></i>
      <div class="whatsapp-tooltip">Tap to Book Free Assessment</div>
    </a>

    <!-- Scripts -->
    <script src="assets/js/jquery-3.5.0.min.js"></script>
    <script src="assets/js/slick.min.js"></script>
    <script src="assets/js/bootstrap.min.js"></script>
    <script src="assets/js/jquery.magnific-popup.min.js"></script>
    <script src="assets/js/imagesloaded.pkgd.min.js"></script>
    <script src="assets/js/isotope.pkgd.min.js"></script>
    <script src="assets/js/jquery.counterup.min.js"></script>
    <script src="assets/js/parallax.min.js"></script>
    <script src="assets/js/vscustom-carousel.min.js"></script>
    <script src="assets/js/jquery-ui.min.js"></script>
    <script src="assets/js/wow.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="assets/js/main.min.js"></script>
    <script src="./assets/js/spinner.js"></script>
    <script src="./assets/js/${w.jsFileName}"></script>
  </body>
</html>
`;
};

// ==================== JS TEMPLATE ====================

const generateJs = (workshop) => {
  const w = normalizeWorkshop(workshop);
  const nameJson = JSON.stringify(w.name);
  const batchJson = JSON.stringify(w.batchValue);
  const dateJson = JSON.stringify(w.dateString);

  return `(function() {
  'use strict';
const API_BASE = 'https://backend.lilsculpr.com/api/special-course';
  // const API_BASE = 'http://localhost:5000/api/special-course';
  const WORKSHOP_NAME = ${nameJson};
  const WORKSHOP_PRICE = ${w.price};
  const WORKSHOP_DATE = ${dateJson};

  const form = document.getElementById('workshopForm');
  const submitBtn = document.getElementById('submitBtn');
  const paymentStatus = document.getElementById('payment-status');
  const paymentLoading = document.getElementById('paymentLoading');
  const successModal = document.getElementById('paymentSuccessModal');
  const failureModal = document.getElementById('paymentFailureModal');
  const successWorkshop = document.getElementById('successWorkshop');
  const failureMessage = document.getElementById('failureMessage');

  async function checkSlotAvailability() {
    try {
      const params = new URLSearchParams({
        carnivalName: WORKSHOP_NAME,
        batch: ${batchJson},
        date: WORKSHOP_DATE
      });
      const response = await axios.get(API_BASE + '/check-slots?' + params);
      const data = response.data;
      if (data.success) {
        const avail = data.data.availableSlots;
        const cap = data.data.capacity;

        console.log('Slots: ' + avail + ' / ' + cap + ' remaining');

        if (avail === 0) {
          submitBtn.disabled = true;
          submitBtn.title = 'No slots available';
          console.log('❌ Workshop is full!');
        } else if (avail <= 5) {
          console.log('⚠️ Only ' + avail + ' slot' + (avail > 1 ? 's' : '') + ' remaining!');
        } else {
          console.log('✅ Slots available — register now!');
        }
      }
    } catch (err) {
      console.error('Slot check failed:', err);
      console.log('Could not check availability');
    }
  }

  function showStatus(message, type) {
    paymentStatus.className = 'payment-status ' + (type || 'info');
    paymentStatus.textContent = message;
    paymentStatus.style.display = 'block';
    setTimeout(function() {
      paymentStatus.style.display = 'none';
    }, 8000);
  }

  function setLoading(loading) {
    if (loading) {
      submitBtn.classList.add('btn-loading');
      submitBtn.disabled = true;
      paymentLoading.classList.add('active');
    } else {
      submitBtn.classList.remove('btn-loading');
      submitBtn.disabled = false;
      paymentLoading.classList.remove('active');
    }
  }

  function showSuccessModal() {
    if (!successModal) return;
    if (successWorkshop) successWorkshop.textContent = WORKSHOP_NAME;
    successModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function hideSuccessModal() {
    if (!successModal) return;
    successModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  function showFailureModal(message) {
    if (!failureModal) return;
    if (failureMessage) failureMessage.textContent = message;
    failureModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function hideFailureModal() {
    if (!failureModal) return;
    failureModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function(e) {
    if (e.target === successModal) hideSuccessModal();
    if (e.target === failureModal) hideFailureModal();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      hideSuccessModal();
      hideFailureModal();
    }
  });

  function getFormData() {
    return {
      parentName: document.getElementById('parentName').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      childName: document.getElementById('childName').value.trim(),
      childAge: document.getElementById('childAge').value.trim(),
      selectedDate: WORKSHOP_DATE,
      selectedBatch: document.getElementById('selectedBatch').value,
      carnivalName: WORKSHOP_NAME,
      materialType: document.getElementById('materialTypeHidden').value === 'true'
    };
  }

  function validateForm(data) {
    const errors = [];

    if (!data.parentName || data.parentName.length < 2) {
      errors.push('Please enter a valid parent name');
    }

    if (!data.email || !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.email)) {
      errors.push('Please enter a valid email address');
    }

    if (!data.phone || !/^\\d{10}$/.test(data.phone.replace(/\\D/g, ''))) {
      errors.push('Please enter a valid 10-digit phone number');
    }

    if (!data.childName || data.childName.length < 2) {
      errors.push('Please enter a valid child name');
    }

    const age = parseInt(data.childAge);
    if (!data.childAge || isNaN(age) || age < ${w.ageMin} || age > ${w.ageMax}) {
      errors.push('Child age must be between ${w.ageMin} and ${w.ageMax} years');
    }

    if (!document.getElementById('paymentConfirm').checked) {
      errors.push('Please confirm the payment terms');
    }

    return errors;
  }

  async function registerWorkshop(data) {
    try {
      const response = await axios.post(API_BASE + '/register', data);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw error.response.data;
      }
      throw { message: 'Network error. Please check your connection.' };
    }
  }

  async function createPaymentOrder(registrationId) {
    try {
      const response = await axios.post(API_BASE + '/create-order', {
        registrationId: registrationId
      });
      return response.data;
    } catch (error) {
      if (error.response) {
        throw error.response.data;
      }
      throw { message: 'Failed to create payment order.' };
    }
  }

  async function verifyPayment(paymentData) {
    try {
      const response = await axios.post(API_BASE + '/verify-payment', paymentData);
      return response.data;
    } catch (error) {
      if (error.response) {
        throw error.response.data;
      }
      throw { message: 'Payment verification failed.' };
    }
  }

  function openRazorpay(orderData, registrationId) {
    return new Promise(function(resolve, reject) {
      const options = {
        key: orderData.data.key_id,
        amount: orderData.data.amount * 100,
        currency: orderData.data.currency,
        name: 'Lil Sculpr Clay Academy',
        description: WORKSHOP_NAME,
        image: 'https://www.lilsculpr.com/assets/img/logo.webp',
        order_id: orderData.data.orderId,
        prefill: {
          name: document.getElementById('parentName').value,
          email: document.getElementById('email').value,
          contact: document.getElementById('phone').value
        },
        theme: {
          color: '#9C29B2'
        },
        handler: function(response) {
          resolve({
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_signature: response.razorpay_signature,
            registrationId: registrationId
          });
        },
        modal: {
          ondismiss: function() {
            reject({ message: 'Payment was cancelled by user.' });
          }
        }
      };

      const rzp = new Razorpay(options);
      rzp.open();
    });
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = getFormData();
    const errors = validateForm(formData);

    if (errors.length > 0) {
      showStatus('❌ ' + errors.join(' • '), 'error');
      return;
    }

    setLoading(true);
    showStatus('⏳ Registering for workshop...', 'info');

    try {
      const registerResult = await registerWorkshop(formData);

      if (!registerResult.success) {
        throw { message: registerResult.message || 'Registration failed' };
      }

      const registrationId = registerResult.data.registrationId;
      showStatus('✅ Registration created! Creating payment order...', 'info');

      const orderResult = await createPaymentOrder(registrationId);

      if (!orderResult.success) {
        throw { message: orderResult.message || 'Failed to create payment order' };
      }

      showStatus('💳 Opening payment gateway...', 'info');

      const paymentResponse = await openRazorpay(orderResult, registrationId);

      showStatus('✅ Payment successful! Verifying...', 'info');

      const verifyResult = await verifyPayment({
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        registrationId: registrationId
      });

      if (verifyResult.success) {
        setLoading(false);
        showSuccessModal();
        form.reset();
        document.getElementById('paymentConfirm').checked = false;
        checkSlotAvailability();
      } else {
        throw { message: verifyResult.message || 'Payment verification failed' };
      }

    } catch (error) {
      console.error('Workshop registration error:', error);
      setLoading(false);
      showFailureModal(error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  });

  document.getElementById('successModalBtn').addEventListener('click', hideSuccessModal);
  document.getElementById('failureModalBtn').addEventListener('click', hideFailureModal);

  document.getElementById('phone').addEventListener('input', function() {
    this.value = this.value.replace(/\\D/g, '').slice(0, 10);
  });

  window.addEventListener('beforeunload', function() {
    if (paymentLoading.classList.contains('active')) {
      setLoading(false);
    }
  });

  console.log('✅ ' + WORKSHOP_NAME + ' registration form initialized');
  checkSlotAvailability();
})();
`;
};

// ==================== FTP PUBLISHER ====================

const getFtpConfig = () => {
  const rawHost = String(process.env.FTP_HOST || '').trim();
  const host = rawHost
    .replace(/^ftp:\/\//i, '')
    .replace(/^sftp:\/\//i, '')
    .replace(/\/+$/, '');
  const port = parseInt(process.env.FTP_PORT, 10) || 21;
  const user = String(process.env.FTP_USER || '').trim();
  const password = String(process.env.FTP_PASS || '').trim();
  const targetDir = String(process.env.FTP_TARGET_DIR || '/').trim();
  return { host, port, user, password, targetDir };
};

const uploadToFTP = async (files) => {
  const { host, port, user, password, targetDir } = getFtpConfig();

  if (!host || !user) {
    console.warn('⚠️ FTP details missing (FTP_HOST/FTP_USER) — skipping FTP upload');
    return { success: false, message: 'FTP details not configured', files };
  }

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  try {
    console.log(`📡 Connecting to FTP ${host}:${port}...`);
    await client.access({ host, port, user, password, secure: false });
    console.log('✅ FTP connected');

    // The FTP account is chrooted into the hosting root. The website lives in
    // the FTP_TARGET_DIR folder (e.g. /public_html), which is where all pages
    // are uploaded. All operations start from the FTP root ("/") and paths are
    // prefixed with the base directory.
    const baseDir = String(targetDir || '/').replace(/^\/+|\/+$/g, '');

    const resetToRoot = async () => {
      await client.cd('/');
    };

    await resetToRoot();

    const uploaded = [];
    for (const file of files) {
      const remotePath = baseDir ? path.posix.join(baseDir, file.remotePath) : file.remotePath;
      const remoteDir = path.posix.dirname(remotePath);

      // Create sub-directories (this changes the FTP working directory)...
      await resetToRoot();
      if (remoteDir && remoteDir !== '.') {
        await client.ensureDir(remoteDir);
      }

      // ...then reset back to the FTP root so the path resolves correctly.
      await resetToRoot();

      const tmpPath = path.join(os.tmpdir(), `lilsculpr-${crypto.randomBytes(6).toString('hex')}.tmp`);
      fs.writeFileSync(tmpPath, file.content, 'utf8');
      try {
        await client.uploadFrom(tmpPath, remotePath);
      } finally {
        fs.unlinkSync(tmpPath);
      }

      uploaded.push(remotePath);
      console.log(`📤 Uploaded: ${remotePath} (${file.content.length} bytes)`);
    }

    return { success: true, uploaded, count: uploaded.length };
  } catch (error) {
    console.error('❌ FTP upload failed:', error.message);
    return { success: false, message: error.message, files };
  } finally {
    client.close();
  }
};

// ==================== MAIN ====================

// Delete a workshop's generated files (HTML page + JS) from the live site
const deleteWorkshopFiles = async (workshop) => {
  const { host, port, user, password, targetDir } = getFtpConfig();

  if (!host || !user) {
    console.warn('⚠️ FTP details missing (FTP_HOST/FTP_USER) — skipping FTP delete');
    return { success: false, message: 'FTP details not configured', removed: [] };
  }

  // Compute the exact file names that were uploaded for this workshop
  const w = normalizeWorkshop(workshop);
  const relPaths = [
    w.registrationPageUrl,
    `assets/js/${w.jsFileName}`
  ];
  const baseDir = String(targetDir || '/').replace(/^\/+|\/+$/g, '');

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  try {
    console.log(`📡 Connecting to FTP ${host}:${port}...`);
    await client.access({ host, port, user, password, secure: false });
    await client.cd('/');

    const removed = [];
    for (const relPath of relPaths) {
      const remotePath = baseDir ? path.posix.join(baseDir, relPath) : relPath;
      try {
        await client.remove(remotePath);
        removed.push(remotePath);
        console.log(`🗑️ Removed: ${remotePath}`);
      } catch (e) {
        console.log(`⚠️ Could not delete ${remotePath}: ${e.message}`);
      }
    }

    return { success: true, removed, count: removed.length };
  } catch (error) {
    console.error('❌ FTP delete failed:', error.message);
    return { success: false, message: error.message };
  } finally {
    client.close();
  }
};

const generateAndUpload = async (workshop) => {
  const w = normalizeWorkshop(workshop);
  const html = generateHtml(w);
  const js = generateJs(w);

  const files = [
    { remotePath: w.registrationPageUrl, content: html },
    { remotePath: `assets/js/${w.jsFileName}`, content: js }
  ];

  const result = await uploadToFTP(files);
  result.htmlFileName = w.registrationPageUrl;
  result.jsFileName = w.jsFileName;

  return result;
};

// Register the workshop config so special-course payments use the correct fee/capacity
const registerConfig = (workshop) => workshopRuntimeConfig.register(workshop);

module.exports = {
  generateHtml,
  generateJs,
  normalizeWorkshop,
  uploadToFTP,
  generateAndUpload,
  deleteWorkshopFiles,
  registerConfig,
  getFtpConfig
};