// In-memory registry of dynamically created workshops (from admin panel).
// The SpecialCourse payment flow reads fee/capacity from this registry so that
// generated registration pages always charge the correct amount.

const configs = {};

// Register a workshop config (or update it)
const register = (workshop) => {
  if (!workshop || !workshop.name) return;

  const date = workshop.date ? new Date(workshop.date) : null;
  const dateString = date ? date.toISOString().split('T')[0] : null;

  configs[workshop.name] = {
    fee: Number(workshop.price) || 399,
    capacity: Number(workshop.capacity) || 30,
    prefix: buildPrefix(workshop.slug || workshop.name),
    dates: dateString ? [dateString] : []
  };

  return configs[workshop.name];
};

// Remove a workshop config
const unregister = (name) => {
  delete configs[name];
};

const get = (name) => configs[name] || null;

// Build a short unique registration prefix from the slug, e.g.
// "magic-clay-day" -> "LS-MCD26"
const buildPrefix = (slug) => {
  const words = String(slug || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(Boolean);

  let letters = '';
  if (words.length >= 1) {
    letters = words.slice(0, 3).map((w) => w.charAt(0).toUpperCase()).join('');
  }
  if (letters.length < 2) {
    letters = 'WS';
  }

  const year = new Date().getFullYear().toString().slice(-2);
  return `LS-${letters}${year}`;
};

module.exports = { register, unregister, get, buildPrefix };