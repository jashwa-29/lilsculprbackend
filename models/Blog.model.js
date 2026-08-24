const mongoose = require('mongoose');

// ─── Content block schema (structured, design-customizable article body) ───
// type: paragraph | heading | list | quote | image | divider
const BlockSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['paragraph', 'heading', 'list', 'quote', 'image', 'divider'],
    required: true
  },
  // paragraph / heading / quote / list-items text
  text: String,
  // heading level: h2 | h3 | h4
  level: { type: String, enum: ['h2', 'h3', 'h4'], default: 'h2' },
  // text alignment: left | center | right | justify
  align: { type: String, enum: ['left', 'center', 'right', 'justify'], default: 'left' },
  // custom colors / sizes (empty = inherit theme defaults)
  color: String,
  fontSize: Number,
  bold: { type: Boolean, default: false },
  italic: { type: Boolean, default: false },
  // list options
  items: [String],
  ordered: { type: Boolean, default: false },
  listStyle: { type: String, enum: ['dot', 'check', 'arrow'], default: 'dot' },
  // quote author line
  author: String,
  // image block
  url: String,
  caption: String,
  rounded: { type: Boolean, default: true },
  width: { type: String, enum: ['full', 'wide', 'medium', 'small'], default: 'full' },
}, { _id: false });

// ─── Card design customization ──────────────────────────────────────────────
const DesignSchema = new mongoose.Schema({
  cardStyle: {
    type: String,
    enum: ['default', 'modern', 'minimal', 'gradient', 'bordered'],
    default: 'default'
  },
  themeColor: { type: String, default: '#9c29b2' },
  backgroundColor: { type: String, default: '#ffffff' },
  textColor: { type: String, default: '#2d3748' },
  excerptColor: { type: String, default: '#6b7280' },
  metaColor: { type: String, default: '#9c29b2' },
  buttonColor: { type: String, default: '#9c29b2' },
  buttonTextColor: { type: String, default: '#ffffff' },
  buttonText: { type: String, default: 'Read More' },
  buttonStyle: { type: String, enum: ['solid', 'outline', 'pill'], default: 'solid' },
  borderRadius: { type: Number, default: 20 },
  cardPadding: { type: Number, default: 30 },
  shadow: { type: Boolean, default: true },
  hoverEffect: { type: String, enum: ['lift', 'zoom', 'glow', 'none'], default: 'lift' },
  imageHeight: { type: Number, default: 240 },
  showImage: { type: Boolean, default: true },
    showDate: { type: Boolean, default: true },
    showAuthor: { type: Boolean, default: true },
    showCategory: { type: Boolean, default: true },
  showBadge: { type: Boolean, default: false },
  badgeText: { type: String, default: 'New' },
  badgeColor: { type: String, default: '#f59e0b' },
  badgeTextColor: { type: String, default: '#ffffff' },
}, { _id: false });

const BlogSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  excerpt: { type: String, trim: true },
  coverImage: String,
  author: { type: String, default: 'Lil Sculpr Team', trim: true },
  authorRole: { type: String, trim: true },
  category: { type: String, trim: true },
  tags: [String],
  blocks: [BlockSchema],
  metaTitle: String,
  metaDescription: String,
  pageUrl: String,
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  isFeatured: { type: Boolean, default: false },
  displayOrder: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  design: { type: DesignSchema, default: () => ({}) },
  publishedAt: Date,
}, { timestamps: true });

BlogSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model('Blog', BlogSchema);
