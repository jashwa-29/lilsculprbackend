// ==================================================================
// Blog Detail Page Generator + FTP Publisher
// ------------------------------------------------------------------
// When a blog is created (or updated) through the admin panel, this
// service:
//   1. Generates a full static HTML detail page (design identical to
//      why-clay-modelling-is-important-for-kids.html etc.)
//   2. Uploads it to the live website via FTP (FTP_* env vars,
//      reusing the same publisher as the workshop generator)
// ==================================================================

const { getFtpConfig, uploadToFTP } = require('./workshopPageGenerator.service');

// ==================== HELPERS ====================

const escapeHtml = (str) => String(str || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const slugify = (str) => String(str || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const normalizeBlog = (blog) => {
  const b = typeof blog.toObject === 'function' ? blog.toObject() : { ...blog };
  const title = String(b.title || '').trim() || 'Blog Post';
  const slug = slugify(b.slug) || slugify(title) || 'blog-post';
  const excerpt = String(b.excerpt || '').trim();
  const coverImage = String(b.coverImage || '').trim();
  const author = String(b.author || 'Lil Sculpr Team').trim();
  const authorRole = String(b.authorRole || '').trim();
  const category = String(b.category || '').trim();
  const tags = Array.isArray(b.tags) ? b.tags.filter(Boolean) : [];
  const blocks = Array.isArray(b.blocks) ? b.blocks : [];
  const metaTitle = String(b.metaTitle || `${title} | Lil Sculpr`).trim();
  const metaDescription = String(
    b.metaDescription ||
    excerpt ||
    'Read the latest clay art tips, news and stories from Lil Sculpr Clay Academy.'
  ).trim();
  const pageUrl = String(b.pageUrl || `${slug}.html`).trim();
  const publishedAt = b.publishedAt ? new Date(b.publishedAt) : new Date();

  // Design defaults mirror the model defaults so old records render fine
  const d = b.design || {};
  const design = {
    cardStyle: d.cardStyle || 'default',
    themeColor: d.themeColor || '#9c29b2',
    backgroundColor: d.backgroundColor || '#ffffff',
    textColor: d.textColor || '#2d3748',
    excerptColor: d.excerptColor || '#6b7280',
    metaColor: d.metaColor || '#9c29b2',
    buttonColor: d.buttonColor || '#9c29b2',
    buttonTextColor: d.buttonTextColor || '#ffffff',
    buttonText: d.buttonText || 'Read More',
    buttonStyle: d.buttonStyle || 'solid',
    borderRadius: Number(d.borderRadius ?? 20),
    cardPadding: Number(d.cardPadding ?? 30),
    shadow: d.shadow !== false,
    hoverEffect: d.hoverEffect || 'lift',
    imageHeight: Number(d.imageHeight ?? 240),
    showImage: d.showImage !== false,
    showDate: d.showDate !== false,
    showAuthor: !!d.showAuthor,
    showCategory: d.showCategory !== false,
    showBadge: !!d.showBadge,
    badgeText: d.badgeText || 'New',
    badgeColor: d.badgeColor || '#f59e0b',
    badgeTextColor: d.badgeTextColor || '#ffffff'
  };

  return {
    title, slug, excerpt, coverImage, author, authorRole, category, tags,
    blocks, metaTitle, metaDescription, pageUrl, publishedAt, design
  };
};

const formatDate = (date) =>
  date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });

// ==================== BLOCK RENDERERS ====================

const renderParagraph = (block, design) => {
  const styles = [
    `text-align:${block.align || 'left'}`,
    block.color ? `color:${block.color}` : '',
    block.fontSize ? `font-size:${block.fontSize}px` : '',
    block.bold ? 'font-weight:700' : '',
    block.italic ? 'font-style:italic' : ''
  ].filter(Boolean).join(';');
  return `<p${styles ? ` style="${styles}"` : ''}>${escapeHtml(block.text)}</p>`;
};

const renderHeading = (block, design) => {
  const tag = ['h2', 'h3', 'h4'].includes(block.level) ? block.level : 'h2';
  const styles = [
    `text-align:${block.align || 'left'}`,
    `color:${block.color || design.themeColor}`,
    block.fontSize ? `font-size:${block.fontSize}px` : ''
  ].filter(Boolean).join(';');
  return `<${tag} class="blog-block-heading"${styles ? ` style="${styles}"` : ''}>${escapeHtml(block.text)}</${tag}>`;
};

const renderList = (block, design) => {
  const tag = block.ordered ? 'ol' : 'ul';
  const markerClass = block.listStyle === 'check'
    ? 'blog-list-check'
    : block.listStyle === 'arrow'
      ? 'blog-list-arrow'
      : '';
  const items = (block.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('');
  const color = block.color || design.themeColor;
  return `<div class="blog-inner-list ${markerClass}" style="--list-accent:${color}">
                  <${tag}>
                    ${items}
                  </${tag}>
                </div>`;
};

const renderQuote = (block, design) => `
                <blockquote class="blog-quote" style="border-left-color:${design.themeColor};background:${design.themeColor}12">
                  <p>${escapeHtml(block.text)}</p>
                  ${block.author ? `<cite>&mdash; ${escapeHtml(block.author)}</cite>` : ''}
                </blockquote>`;

const renderImage = (block) => {
  if (!block.url) return '';
  const widthMap = { full: '100%', wide: '85%', medium: '65%', small: '45%' };
  const w = widthMap[block.width] || '100%';
  return `<figure class="blog-figure" style="text-align:center">
                  <img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.caption || 'Lil Sculpr blog image')}" style="width:${w}${block.rounded ? ';border-radius:16px' : ''}" loading="lazy" />
                  ${block.caption ? `<figcaption style="font-size:0.85rem;color:#8a94a6;margin-top:10px">${escapeHtml(block.caption)}</figcaption>` : ''}
                </figure>`;
};

const renderDivider = () => `<hr class="blog-divider" />`;

const renderBlock = (block, design) => {
  switch (block.type) {
    case 'heading': return renderHeading(block, design);
    case 'list': return renderList(block, design);
    case 'quote': return renderQuote(block, design);
    case 'image': return renderImage(block);
    case 'divider': return renderDivider();
    case 'paragraph':
    default: return renderParagraph(block, design);
  }
};

// ==================== CSS ====================

const pageStyles = (design) => `
      /* Blog detail custom design tokens */
      .blog-single .blog-content p {
        font-size: 1rem;
        line-height: 1.9;
        margin-bottom: 18px;
      }

      .blog-block-heading {
        font-family: 'Baloo 2', cursive;
        font-weight: 700;
        line-height: 1.35;
        margin: 30px 0 14px;
      }

      .blog-inner-list {
        background: #f8f7ff;
        border-radius: 14px;
        padding: 22px 28px;
        margin: 24px 0;
        --list-accent: ${design.themeColor};
      }

      .blog-inner-list ul,
      .blog-inner-list ol {
        margin: 0;
        padding-left: 20px;
      }

      .blog-inner-list li {
        padding: 6px 0;
        font-weight: 500;
      }

      .blog-list-check ul { list-style: none; padding-left: 4px; }
      .blog-list-check li::before {
        content: "\\2713";
        color: var(--list-accent);
        font-weight: 800;
        margin-right: 10px;
      }

      .blog-list-arrow ul { list-style: none; padding-left: 4px; }
      .blog-list-arrow li::before {
        content: "\\2192";
        color: var(--list-accent);
        font-weight: 800;
        margin-right: 10px;
      }

      .blog-quote {
        border-left: 5px solid;
        padding: 22px 28px;
        margin: 26px 0;
        border-radius: 0 14px 14px 0;
        font-style: italic;
      }

      .blog-quote p {
        font-size: 1.05rem !important;
        margin-bottom: 10px !important;
        color: #2d3748;
      }

      .blog-quote cite {
        display: block;
        font-size: 0.9rem;
        color: #6b7280;
        font-style: normal;
        font-weight: 600;
      }

      .blog-figure { margin: 26px 0; }
      .blog-figure img { max-width: 100%; height: auto; }

      .blog-divider {
        border: 0;
        height: 1px;
        background: linear-gradient(90deg, transparent, ${design.themeColor}55, transparent);
        margin: 34px 0;
      }

      .blog-cover-wrap {
        border-radius: 18px;
        overflow: hidden;
        margin-bottom: 8px;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.08);
      }

      .blog-cover-wrap img {
        width: 100%;
        max-height: 520px;
        object-fit: cover;
        display: block;
      }

      .badge-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 18px;
        border-radius: 999px;
        font-size: 0.78rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: ${design.badgeTextColor};
        background: ${design.badgeColor};
        margin-bottom: 14px;
      }`;

// ==================== HTML TEMPLATE ====================

const generateHtml = (blog) => {
  const b = normalizeBlog(blog);
  const design = b.design;

  const metaParts = [];
  if (design.showDate) metaParts.push(`<span><i class="fal fa-calendar-alt"></i><a href="#">${formatDate(b.publishedAt)}</a></span>`);
  if (design.showAuthor) metaParts.push(`<span><i class="fal fa-user-tag"></i>by <a href="#">${escapeHtml(b.author)}</a></span>`);
  if (design.showCategory && b.category) metaParts.push(`<span><i class="fal fa-folder-open"></i><a href="#">${escapeHtml(b.category)}</a></span>`);

  const bodyHtml = b.blocks.length
    ? b.blocks.map((block) => renderBlock(block, design)).join('\n')
    : (b.excerpt ? `<p>${escapeHtml(b.excerpt)}</p>` : '');

  const tagCloud = b.tags.length
    ? b.tags.map((t) => `<a href="#">${escapeHtml(t)}</a>`).join('\n')
    : '';

  const shareUrl = `https://www.lilsculpr.com/${b.pageUrl}`;

  return `<!doctype html>
<html class="no-js" lang="en">
  <head>
    <!-- Google tag (gtag.js) -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-D1YV5MFGNH"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag("js", new Date());
      gtag("config", "G-D1YV5MFGNH");
    </script>
    <meta charset="utf-8" />
    <meta http-equiv="x-ua-compatible" content="IE=edge" />
    <title>${escapeHtml(b.metaTitle)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />

    <!-- SEO Essentials -->
    <meta name="author" content="Lil Sculpr Clay Modeling Academy" />
    <meta name="description" content="${escapeHtml(b.metaDescription)}" />

    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${escapeHtml(b.title)}" />
    <meta property="og:description" content="${escapeHtml(b.metaDescription)}" />
    <meta property="og:url" content="${shareUrl}" />
    <meta property="og:image" content="${escapeHtml(b.coverImage || 'assets/img/logo.webp')}" />

    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:title" content="${escapeHtml(b.title)}" />
    <meta property="twitter:description" content="${escapeHtml(b.metaDescription)}" />
    <meta property="twitter:image" content="${escapeHtml(b.coverImage || 'assets/img/logo.webp')}" />
    <link rel="canonical" href="${shareUrl}" />

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
    <link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="favicon-32x32.png" />
    <link rel="icon" type="image/png" sizes="16x16" href="favicon-16x16.png" />
    <link rel="icon" type="image/png" sizes="192x192" href="android-chrome-192x192.png" />
    <link rel="icon" type="image/png" sizes="512x512" href="android-chrome-512x512.png" />
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
    <link rel="stylesheet" href="assets/css/fontawesome.min.css" media="print" onload="this.media = 'all'" />
    <link rel="stylesheet" href="assets/css/magnific-popup.min.css" media="print" onload="this.media = 'all'" />
    <link rel="stylesheet" href="assets/css/slick.min.css" media="print" onload="this.media = 'all'" />

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
      .fal, .fab, .fas, .far { font-display: swap; }
${pageStyles(design)}
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
        <input type="text" class="border-theme" placeholder="What are you looking for" />
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
          <a href="index.html"><img src="assets/img/logo.webp" alt="Lil Sculpr Logo" /></a>
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
      <div class="header-top-area d-none d-lg-block">
        <div class="container">
          <div class="row align-items-center justify-content-between">
            <div class="col-auto">
              <div class="header-links">
                <ul>
                  <li><i class="fal fa-clock"></i>3:00 pm - 8:00 pm - Tue - Sun</li>
                  <li>
                    <i class="fal fa-phone"></i
                    ><a href="tel:+919600443185">+91 96 00 44 31 85</a>
                  </li>
                  <li>
                    <i class="fal fa-map-marker-alt"></i>468 A, C sector, 2nd Street, AE
                    Block, Anna Nagar West Extension, Chennai - 600101
                  </li>
                </ul>
              </div>
            </div>
            <div class="col-auto">
              <div class="header-social">
                <ul>
                  <li>
                    <a href="https://www.facebook.com/profile.php?id=61583300934216"
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

      <div class="sticky-wrapper">
        <div class="sticky-active">
          <div class="header-menu-area">
            <div class="container position-relative">
              <div class="row gx-20 align-items-center justify-content-between">
                <div class="col-auto">
                  <div class="header-logo">
                    <a href="index.html">
                      <img src="assets/img/logo.webp" alt="Lil Sculpr Logo" />
                    </a>
                  </div>
                </div>
                <div class="col-auto">
                  <nav class="main-menu menu-style1 d-none d-lg-inline-block">
                    <ul>
                      <li><a href="index.html">Home</a></li>
                      <li><a href="about.html">About</a></li>
                      <li><a href="./classes.html">Classes</a></li>
                      <li><a href="gallery.html">Gallery</a></li>
                      <li><a href="./blog.html">Blog</a></li>
                      <li><a href="./workshops.html">Workshop</a></li>
                      <li><a href="awards.html">Awards</a></li>
                    </ul>
                  </nav>
                  <button
                    type="button"
                    class="vs-menu-toggle d-block d-lg-none"
                    aria-label="Open mobile menu"
                  >
                    <i class="fal fa-bars" aria-hidden="true"></i> Menu
                  </button>
                </div>
                <div class="col-auto d-none d-xl-block">
                  <div class="header-button">
                    <a href="contact.html" class="vs-btn wave-btn">Contact Us</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Breadcrumb -->
    <div class="breadcumb-wrapper" data-bg-src="assets/img/claymodeling/coverimg.webp">
      <div class="container">
        <div class="breadcumb-content">
          <h1 class="breadcumb-title">${escapeHtml(b.title)}</h1>
          <ul class="breadcumb-menu">
            <li><a href="index.html">Home</a></li>
            <li><a href="blog.html">Blog</a></li>
            <li class="active">${escapeHtml(b.title)}</li>
          </ul>
        </div>
      </div>
    </div>

    <!--======== Blog Section ========-->
    <section class="vs-blog-wrapper blog-details space-page">
      <div class="container">
        <div class="row gx-60">
          <div class="">
            <article class="vs-blog blog-single wow fadeInUp" data-wow-delay="0.1s">
              ${design.showBadge ? `<div class="text-center"><span class="badge-pill">${escapeHtml(design.badgeText)}</span></div>` : ''}
              ${b.coverImage && design.showImage ? `<div class="blog-cover-wrap"><img src="${escapeHtml(b.coverImage)}" alt="${escapeHtml(b.title)}" /></div>` : ''}
              <div class="blog-content">
                <div class="blog-meta">
                  ${metaParts.join('\n                  ')}
                </div>

                <h2 class="blog-title">${escapeHtml(b.title)}</h2>
                ${bodyHtml}
              </div>

              ${b.tags.length || true ? `
              <!-- Share Links -->
              <div class="share-links clearfix wow fadeInUp" data-wow-delay="0.1s">
                <div class="row justify-content-between">
                  <div class="col-md-auto">
                    ${b.tags.length ? `<span class="share-links-title">Tags: </span>
                    <div class="tagcloud">
                      ${tagCloud}
                    </div>` : ''}
                  </div>
                  <div class="col-md-auto text-md-end">
                    <span class="share-links-title">Share Now:</span>
                    <ul class="multi-social">
                      <li>
                        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener"><i class="fab fa-facebook-f"></i></a>
                      </li>
                      <li>
                        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(b.title)}" target="_blank" rel="noopener"><i class="fab fa-twitter"></i></a>
                      </li>
                      <li>
                        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}" target="_blank" rel="noopener"><i class="fab fa-linkedin-in"></i></a>
                      </li>
                      <li>
                        <a href="https://wa.me/?text=${encodeURIComponent(b.title + ' ' + shareUrl)}" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i></a>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>` : ''}
            </article>
          </div>
        </div>
      </div>
    </section>
    <!--======== / Blog Section ========-->

    <!-- Footer -->
    <footer class="footer-wrapper footer-layout3" data-bg-src="assets/img/bg/footer-4.webp">
      <div class="widget-area">
        <div class="container">
          <div class="row justify-content-between">
            <div class="col-xl-auto col-md-6 wow fadeInUp" data-wow-delay="0.1s">
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
                    Lil Sculpr offers fun and structured clay modelling classes for kids in
                    Chennai. Learn clay art from basics to advanced with expert guidance.
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

            <div class="col-xl-auto col-md-6 wow fadeInUp" data-wow-delay="0.1s">
              <div class="widget footer-widget widget_nav_menu">
                <h4 class="widget_title">Details Info</h4>
                <ul class="menu">
                  <li><a href="classes.html">Classes</a></li>
                  <li><a href="contact.html">Appointment</a></li>
                  <li><a href="about.html">About Us</a></li>
                  <li><a href="gallery.html">Gallery</a></li>
                  <li><a href="return-refund-policy.html">Return &amp; Refund Policy</a></li>
                  <li><a href="terms-and-conditions.html">Terms &amp; Conditions</a></li>
                  <li><a href="privacy-policy.html">Privacy Policy</a></li>
                </ul>
              </div>
            </div>

            <div class="col-xl-auto col-md-6 wow fadeInUp" data-wow-delay="0.1s">
              <div class="widget footer-widget">
                <h3 class="widget_title">Contact Us</h3>
                <div class="vs-widget-contact">
                  <p class="footer-info">
                    <i class="fas fa-map-marker-alt"></i>468 A, C sector, 2nd Street, AE
                    Block, Anna Nagar West Extension, Chennai - 600101
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
            <a href="https://www.swiflare.com/">Designed &amp; Developed by Swiflare Ai Innovations</a>
          </p>
        </div>
      </div>
    </footer>

    <!-- Scroll To Top -->
    <a href="#" class="scrollToTop scroll-btn"><i class="fas fa-chevron-up"></i></a>
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
    <script src="assets/js/ajax-mail.js"></script>
    <script src="./assets/js/spinner.js"></script>
    <script src="assets/js/main.min.js"></script>
  </body>
</html>
`;
};

// ==================== MAIN ====================

const generateAndUpload = async (blog) => {
  const b = normalizeBlog(blog);
  const html = generateHtml(b);

  const files = [{ remotePath: b.pageUrl, content: html }];
  const result = await uploadToFTP(files);
  result.pageFileName = b.pageUrl;
  return result;
};

const deleteBlogFiles = async (blog) => {
  const { host, port, user, password, targetDir } = getFtpConfig();

  if (!host || !user) {
    console.warn('⚠️ FTP details missing (FTP_HOST/FTP_USER) — skipping FTP delete');
    return { success: false, message: 'FTP details not configured', removed: [] };
  }

  const ftp = require('basic-ftp');
  const b = normalizeBlog(blog);
  const baseDir = String(targetDir || '/').replace(/^\/+|\/+$/g, '');
  const remotePath = baseDir ? require('path').posix.join(baseDir, b.pageUrl) : b.pageUrl;

  const client = new ftp.Client(30000);
  client.ftp.verbose = false;

  try {
    console.log(`📡 Connecting to FTP ${host}:${port}...`);
    await client.access({ host, port, user, password, secure: false });
    await client.cd('/');
    try {
      await client.remove(remotePath);
      console.log(`🗑️ Removed: ${remotePath}`);
      return { success: true, removed: [remotePath] };
    } catch (e) {
      console.log(`⚠️ Could not delete ${remotePath}: ${e.message}`);
      return { success: true, removed: [], message: e.message };
    }
  } catch (error) {
    console.error('❌ FTP delete failed:', error.message);
    return { success: false, message: error.message };
  } finally {
    client.close();
  }
};

module.exports = {
  normalizeBlog,
  generateHtml,
  generateAndUpload,
  deleteBlogFiles
};
