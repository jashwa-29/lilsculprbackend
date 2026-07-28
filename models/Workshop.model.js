const mongoose = require('mongoose');

const WorkshopSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  shortDescription: String,
  description: String,
  price: { type: Number, required: true },
  date: { type: Date, required: true },
  timeStart: { type: String, default: '11:00 AM' },
  timeEnd: { type: String, default: '1:00 PM' },
  duration: { type: String, default: '2 Hours' },
  capacity: { type: Number, default: 30 },
  ageMin: { type: Number, default: 5 },
  ageMax: { type: Number, default: 14 },
  badge: { type: String, default: 'New' },
  badgeColor: { type: String, default: '#9c29b2' },
  backgroundColor: { type: String, default: '#f5f0ff' },
  emoji: String,
  image: String,
  registrationPageUrl: String,
  status: {
    type: String,
    enum: ['active', 'over', 'cancelled'],
    default: 'active'
  },
  highlights: [{
    icon: String,
    title: String,
    description: String
  }],
  features: [String],
}, { timestamps: true });

module.exports = mongoose.model('Workshop', WorkshopSchema);
