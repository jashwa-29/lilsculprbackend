const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  // Basic identifying info
  type: { 
    type: String, 
    enum: ['offline', 'online'], 
    required: true 
  },
  dayId: { 
    type: String, 
    enum: ['monfri', 'tuethu', 'satsu'], 
    required: true 
  },
  time: { 
    type: String, 
    required: true 
  },
  
  // Operational controls
  capacity: { 
    type: Number, 
    default: 8, 
    required: true 
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'filling', 'full', 'completed', 'archived'],
    default: 'draft'
  },

  // Associated students
  enrolledStudents: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Student' 
  }],
  
  // Metadata
  instructor: { 
    type: String, 
    trim: true 
  },
  notes: { 
    type: String, 
    trim: true 
  }
}, { timestamps: true });

// Ensure unique batch slot
batchSchema.index({ type: 1, dayId: 1, time: 1 }, { unique: true });
// Index for querying active batches
batchSchema.index({ status: 1, type: 1 });

module.exports = mongoose.model('Batch', batchSchema);