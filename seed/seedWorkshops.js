const Workshop = require('../models/Workshop.model');

const workshops = [
  {
    name: 'Strawberry Cottage Workshop',
    slug: 'strawberry-cottage-workshop',
    shortDescription: 'Kids sculpt their own magical strawberry cottage — a delightful keepsake!',
    description: 'Kids sculpt their own magical strawberry cottage — a delightful keepsake! All materials included. Perfect for beginners.',
    price: 399,
    date: new Date('2026-07-26'),
    timeStart: '11:00 AM',
    timeEnd: '1:00 PM',
    duration: '2 Hours',
    capacity: 30,
    ageMin: 5,
    ageMax: 14,
    badge: 'Popular',
    badgeColor: '#9c29b2',
    backgroundColor: '#fdf2f8',
    emoji: '🍓',
    image: 'assets/img/lil-sculpr/strawberry-cottage.jpeg',
    registrationPageUrl: 'strawberry-cottage-register.html',
    status: 'active',
    highlights: [
      { icon: 'fas fa-clock', title: '2 Hours', description: 'Fun-filled session' },
      { icon: 'fas fa-users', title: '30 Slots', description: 'Limited seats' }
    ],
    features: ['All materials included', 'Expert guidance', 'Take home your creation']
  },
  {
    name: 'Koi Fish Frame Art',
    slug: 'koi-fish-frame-art',
    shortDescription: 'Create a stunning koi fish clay art on a decorative frame.',
    description: 'Create a stunning koi fish clay art on a decorative frame. All materials, frame base, and expert guidance included!',
    price: 499,
    date: new Date('2026-07-27'),
    timeStart: '11:00 AM',
    timeEnd: '1:00 PM',
    duration: '2 Hours',
    capacity: 30,
    ageMin: 5,
    ageMax: 14,
    badge: 'New',
    badgeColor: '#9c29b2',
    backgroundColor: '#eff6ff',
    emoji: '🐟',
    image: 'assets/img/lil-sculpr/koi-fish-art.jpeg',
    registrationPageUrl: 'koi-fish-register.html',
    status: 'active',
    highlights: [
      { icon: 'fas fa-clock', title: '2 Hours', description: 'Fun-filled session' },
      { icon: 'fas fa-users', title: '30 Slots', description: 'Limited seats' }
    ],
    features: ['All materials included', 'Frame base provided', 'Expert guidance']
  },
  {
    name: 'Kids Fruit & Vegetable Clay Mirror Workshop',
    slug: 'kids-fruit-vegetable-clay-mirror',
    shortDescription: 'Kids sculpt colorful fruits and vegetables around a beautiful mirror frame.',
    description: 'Kids sculpt colorful fruits and vegetables around a beautiful mirror frame. All materials, mirror base, and expert guidance included!',
    price: 750,
    date: new Date('2026-08-02'),
    timeStart: '11:00 AM',
    timeEnd: '1:00 PM',
    duration: '2 Hours',
    capacity: 30,
    ageMin: 5,
    ageMax: 14,
    badge: 'New',
    badgeColor: '#9c29b2',
    backgroundColor: '#f0fdf4',
    emoji: '',
    image: 'assets/img/lil-sculpr/Kids Fruit & Vegetable.jpeg',
    registrationPageUrl: 'kids-mirror-workshop-register.html',
    status: 'active',
    highlights: [
      { icon: 'fas fa-clock', title: '2 Hours', description: 'Fun-filled session' },
      { icon: 'fas fa-users', title: '30 Slots', description: 'Limited seats' }
    ],
    features: ['All materials included', 'Mirror base provided', 'Expert guidance']
  },
  {
    name: 'Up, Up & Away! - 3D Clay Canvas',
    slug: 'up-up-away-3d-clay-canvas',
    shortDescription: 'Create a beautiful floating house with colorful balloons on a premium canvas.',
    description: 'Create a beautiful floating house with colorful balloons on a premium canvas. All materials, canvas, and expert guidance included!',
    price: 699,
    date: new Date('2026-08-09'),
    timeStart: '11:00 AM',
    timeEnd: '1:00 PM',
    duration: '2 Hours',
    capacity: 30,
    ageMin: 5,
    ageMax: 14,
    badge: 'New',
    badgeColor: '#9c29b2',
    backgroundColor: '#fdf4ff',
    emoji: '🎈',
    image: 'assets/img/lil-sculpr/Up, Up & Away.jpeg',
    registrationPageUrl: 'up-up-away-workshop-register.html',
    status: 'active',
    highlights: [
      { icon: 'fas fa-clock', title: '2 Hours', description: 'Fun-filled session' },
      { icon: 'fas fa-users', title: '30 Slots', description: 'Limited seats' }
    ],
    features: ['All materials included', 'Premium canvas', 'Expert guidance']
  }
];

const seedWorkshops = async () => {
  try {
    const count = await Workshop.countDocuments();
    if (count > 0) {
      console.log(`✅ Workshops already seeded (${count} existing), skipping...`);
      return;
    }
    await Workshop.insertMany(workshops);
    console.log(`✅ Seeded ${workshops.length} workshops`);
  } catch (error) {
    console.error('❌ Error seeding workshops:', error.message);
  }
};

module.exports = seedWorkshops;