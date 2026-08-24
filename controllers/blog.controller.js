const Blog = require('../models/Blog.model');
const fs = require('fs');
const path = require('path');
const {
  generateAndUpload,
  deleteBlogFiles,
  normalizeBlog
} = require('../services/blogPageGenerator.service');

// Fetch the latest published posts (for the footer "Our Blogs" widget on the static page)
const getRecentPosts = async (excludeId) => {
  try {
    return await Blog.find({
      status: 'published',
      ...(excludeId ? { _id: { $ne: excludeId } } : {})
    })
      .sort({ isFeatured: -1, publishedAt: -1 })
      .limit(2)
      .select('title slug pageUrl coverImage author category tags blocks metaTitle metaDescription status displayOrder views design publishedAt')
      .lean();
  } catch (e) {
    console.warn('Recent posts fetch skipped:', e.message);
    return [];
  }
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const slugify = (str) => String(str || '')
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

// Build a unique slug — appends -2, -3 ... when a collision is found
const buildUniqueSlug = async (baseSlug, excludeId) => {
  let slug = slugify(baseSlug) || 'blog-post';
  let candidate = slug;
  let counter = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await Blog.exists({ slug: candidate, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    candidate = `${slug}-${counter}`;
    counter += 1;
  }
  return candidate;
};

const sanitizeTags = (tags) => {
  if (Array.isArray(tags)) return tags.map((t) => String(t).trim()).filter(Boolean);
  if (typeof tags === 'string') {
    return tags.split(',').map((t) => t.trim()).filter(Boolean);
  }
  return [];
};

const sanitizeBlocks = (blocks) => {
  if (!Array.isArray(blocks)) return [];
  const allowed = ['paragraph', 'heading', 'list', 'quote', 'image', 'divider'];
  const str = (v) => (v === undefined || v === null ? '' : String(v));
  return blocks
    .filter((b) => b && allowed.includes(b.type))
    .map((b) => ({
      type: b.type,
      text: str(b.text),
      level: ['h2', 'h3', 'h4'].includes(b.level) ? b.level : 'h2',
      align: ['left', 'center', 'right', 'justify'].includes(b.align) ? b.align : 'left',
      color: str(b.color),
      fontSize: Number(b.fontSize) || undefined,
      bold: !!b.bold,
      italic: !!b.italic,
      items: Array.isArray(b.items) ? b.items.map((i) => String(i)).filter(Boolean) : [],
      ordered: !!b.ordered,
      listStyle: ['dot', 'check', 'arrow'].includes(b.listStyle) ? b.listStyle : 'dot',
      author: str(b.author),
      url: str(b.url),
      caption: str(b.caption),
      rounded: b.rounded !== false,
      width: ['full', 'wide', 'medium', 'small'].includes(b.width) ? b.width : 'full'
    }));
};

const sanitizeDesign = (design) => {
  const d = design && typeof design === 'object' ? design : {};
  return {
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
};

// Delete a local uploaded image (uploads/blogs/...) safely
const deleteLocalImage = (imageUrl) => {
  try {
    if (!imageUrl) return;
    const m = String(imageUrl).match(/\/uploads\/([^?#]+)/);
    if (!m) return;
    const resolved = path.resolve(path.join(__dirname, '..', 'uploads', m[1]));
    const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
    if (resolved.startsWith(uploadsRoot + path.sep) && fs.existsSync(resolved)) {
      fs.unlinkSync(resolved);
      console.log(`🗑️ Removed blog image: ${resolved}`);
    }
  } catch (err) {
    console.warn('⚠️ Could not delete blog image:', err.message);
  }
};

// Absolute image URL builder (same logic as workshop uploadImage)
const buildAbsoluteImageUrl = (req, filename) => {
  const host = req.get('host') || '';
  const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const baseUrl = !isLocal && process.env.PUBLIC_BASE_URL
    ? process.env.PUBLIC_BASE_URL
    : `${req.protocol}://${host}`;
  return `${baseUrl}/uploads/blogs/${filename}`;
};

// ─── Public Routes ──────────────────────────────────────────────────────────

/**
 * GET /api/blogs?limit=&featured=true&category=
 * Published blogs for the public site (listing data — full content excluded)
 */
exports.getPublished = async (req, res) => {
  try {
    const { limit, featured, category } = req.query;
    const filter = { status: 'published' };
    if (featured === 'true') filter.isFeatured = true;
    if (category) filter.category = category;

    let query = Blog.find(filter)
      .select('-blocks')
      .sort({ isFeatured: -1, displayOrder: 1, publishedAt: -1 });

    const lim = parseInt(limit, 10);
    if (lim > 0) query = query.limit(lim);

    const blogs = await query.lean();
    res.json({ success: true, data: blogs });
  } catch (error) {
    console.error('Get published blogs error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/blogs/:slugOrId
 * Full single blog (by slug or id). Increments the view counter.
 */
exports.getBySlugOrId = async (req, res) => {
  try {
    const { slugOrId } = req.params;
    const isObjectId = /^[0-9a-fA-F]{24}$/.test(slugOrId);
    const filter = isObjectId ? { _id: slugOrId } : { slug: slugOrId };

    const blog = await Blog.findOneAndUpdate(
      { ...filter, status: 'published' },
      { $inc: { views: 1 } },
      { new: true }
    ).lean();

    if (!blog) {
      return res.status(404).json({ success: false, message: 'Blog not found' });
    }

    res.json({ success: true, data: blog });
  } catch (error) {
    console.error('Get blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── Admin Routes ───────────────────────────────────────────────────────────

/** GET /api/blogs/admin/all — every blog incl. drafts */
exports.getAll = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: blogs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/blogs/admin/upload-image — cover/block images → uploads/blogs/ */
exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }
    const imageUrl = buildAbsoluteImageUrl(req, req.file.filename);
    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/** POST /api/blogs/admin — create blog (+ publish page to live site) */
exports.create = async (req, res) => {
  try {
    const body = req.body || {};

    const slug = await buildUniqueSlug(body.slug || body.title);
    const isPublished = body.status === 'published';

    const blog = await Blog.create({
      title: body.title,
      slug,
      excerpt: body.excerpt || '',
      coverImage: body.coverImage || '',
      author: body.author || 'Lil Sculpr Team',
      authorRole: body.authorRole || '',
      category: body.category || '',
      tags: sanitizeTags(body.tags),
      blocks: sanitizeBlocks(body.blocks),
      metaTitle: body.metaTitle || '',
      metaDescription: body.metaDescription || '',
      status: isPublished ? 'published' : 'draft',
      isFeatured: !!body.isFeatured,
      displayOrder: Number(body.displayOrder) || 0,
      design: sanitizeDesign(body.design),
      publishedAt: isPublished ? new Date() : undefined
    });

    // Generate & upload the static detail page when publishing
    let pageGeneration = null;
    if (blog.status === 'published') {
      pageGeneration = await generateAndUpload(blog, { recentPosts: await getRecentPosts(blog._id) });
      if (pageGeneration.pageFileName) {
        blog.pageUrl = pageGeneration.pageFileName;
        await blog.save();
      }
    }

    res.status(201).json({ success: true, data: blog, pageGeneration });
  } catch (error) {
    console.error('Create blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** PUT /api/blogs/admin/:id — update blog (+ re-publish page) */
exports.update = async (req, res) => {
  try {
    const existing = await Blog.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Blog not found' });

    const body = req.body || {};
    const wasPublished = existing.status === 'published';
    const previousSlug = existing.slug;
    const previousPageUrl = existing.pageUrl;

    // Slug: only change when an explicit slug is sent (keeps published URLs stable)
    if (body.slug !== undefined) {
      const next = slugify(body.slug);
      if (next && next !== existing.slug) {
        existing.slug = await buildUniqueSlug(next, existing._id);
      }
    }

    if (body.title !== undefined) existing.title = body.title;
    if (body.excerpt !== undefined) existing.excerpt = body.excerpt;
    if (body.coverImage !== undefined) existing.coverImage = body.coverImage;
    if (body.author !== undefined) existing.author = body.author;
    if (body.authorRole !== undefined) existing.authorRole = body.authorRole;
    if (body.category !== undefined) existing.category = body.category;
    if (body.tags !== undefined) existing.tags = sanitizeTags(body.tags);
    if (body.blocks !== undefined) existing.blocks = sanitizeBlocks(body.blocks);
    if (body.metaTitle !== undefined) existing.metaTitle = body.metaTitle;
    if (body.metaDescription !== undefined) existing.metaDescription = body.metaDescription;
    if (body.displayOrder !== undefined) existing.displayOrder = Number(body.displayOrder) || 0;
    if (body.design !== undefined) {
      const currentDesign = existing.design && typeof existing.design.toObject === 'function'
        ? existing.design.toObject()
        : (existing.design || {});
      existing.design = sanitizeDesign({ ...currentDesign, ...body.design });
    }

    // Status transitions manage the publish date
    const nowPublished = body.status === 'published';
    const wasDraft = existing.status === 'draft';
    if (nowPublished && wasDraft) existing.publishedAt = new Date();
    if (body.status !== undefined) existing.status = nowPublished ? 'published' : 'draft';
    if (body.isFeatured !== undefined) existing.isFeatured = !!body.isFeatured;

    await existing.save();

    // Publish / re-publish / un-publish the static page accordingly
    let pageGeneration = null;
    if (existing.status === 'published') {
      // Slug/pageUrl changed on a live page: remove the stale file first
      if ((previousSlug && previousSlug !== existing.slug) ||
          (previousPageUrl && previousPageUrl !== `${existing.slug}.html`)) {
        try {
          await deleteBlogFiles({ pageUrl: previousPageUrl || `${previousSlug}.html`, slug: previousSlug });
        } catch (e) {
          console.warn('Old blog page cleanup skipped:', e.message);
        }
        existing.pageUrl = '';
      }
      pageGeneration = await generateAndUpload(existing, { recentPosts: await getRecentPosts(existing._id) });
      if (pageGeneration.pageFileName) {
        existing.pageUrl = pageGeneration.pageFileName;
        await existing.save();
      }
    } else if (wasPublished && existing.status === 'draft') {
      // Un-published: remove the live page
      pageGeneration = await deleteBlogFiles(existing);
      existing.pageUrl = '';
      await existing.save();
    }

    res.json({ success: true, data: existing, pageGeneration });
  } catch (error) {
    console.error('Update blog error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/** DELETE /api/blogs/admin/:id — delete blog + live page + local image */
exports.remove = async (req, res) => {
  try {
    const blog = await Blog.findByIdAndDelete(req.params.id);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog not found' });

    // Remove the generated page from the live site
    const ftpResult = blog.pageUrl ? await deleteBlogFiles(blog) : null;

    // Remove the local cover image upload
    deleteLocalImage(blog.coverImage);

    res.json({
      success: true,
      message: 'Blog deleted',
      ftpDelete: ftpResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
