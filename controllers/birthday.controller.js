const Birthday = require('../models/Birthday.model');
const Student = require('../models/student.model');

/**
 * POST /api/birthdays/sync
 * Sync all students with birthdays
 */
exports.syncBirthdays = async (req, res) => {
  try {
    // Use dateOfBirth field instead of childAge
    const students = await Student.find({ 
      status: { $ne: 'cancelled' },
      dateOfBirth: { $ne: null } // Only students with DOB
    });
    
    let synced = 0;
    let skipped = 0;

    for (const student of students) {
      const dob = student.dateOfBirth;
      if (!dob || isNaN(dob.getTime())) {
        skipped++;
        continue;
      }

      const existing = await Birthday.findOne({ studentId: student._id });
      if (existing) {
        // Update existing
        existing.childName = student.childName;
        existing.parentName = student.parentName;
        existing.dateOfBirth = dob;
        existing.contact1 = student.contact1;
        existing.email = student.email;
        existing.year = dob.getFullYear();
        existing.month = dob.getMonth() + 1;
        existing.day = dob.getDate();
        await existing.save();
      } else {
        // Create new
        const birthday = new Birthday({
          studentId: student._id,
          childName: student.childName,
          parentName: student.parentName,
          dateOfBirth: dob,
          contact1: student.contact1,
          email: student.email,
          year: dob.getFullYear(),
          month: dob.getMonth() + 1,
          day: dob.getDate()
        });
        await birthday.save();
      }
      synced++;
    }

    res.json({
      success: true,
      message: `Synced ${synced} birthdays, skipped ${skipped} students`
    });

  } catch (error) {
    console.error('Sync Birthdays Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync birthdays'
    });
  }
};

/**
 * GET /api/birthdays/today
 * Get today's birthdays
 */
exports.getTodayBirthdays = async (req, res) => {
  try {
    const birthdays = await Birthday.getBirthdaysForDate(new Date());
    res.json({
      success: true,
      data: birthdays,
      count: birthdays.length
    });
  } catch (error) {
    console.error('Get Today Birthdays Error:', error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch today's birthdays"
    });
  }
};

/**
 * GET /api/birthdays/upcoming
 * Get upcoming birthdays (default: 7 days)
 */
exports.getUpcomingBirthdays = async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const upcoming = await Birthday.getUpcomingBirthdays(parseInt(days));
    
    // Flatten the array of days for easier consumption if needed, 
    // or keep structured by day. The model returns structured by day.
    // The UI expects an array of birthdays. Let's flatten it.
    let flattened = [];
    upcoming.forEach(day => {
      flattened = flattened.concat(day.birthdays);
    });

    res.json({
      success: true,
      data: flattened
    });
  } catch (error) {
    console.error('Get Upcoming Birthdays Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch upcoming birthdays'
    });
  }
};

/**
 * GET /api/birthdays
 * Get all birthdays (admin)
 */
exports.getAllBirthdays = async (req, res) => {
  try {
    const { month, year, search, page = 1, limit = 50 } = req.query;

    let query = {};
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { childName: searchRegex },
        { parentName: searchRegex },
        { contact1: searchRegex }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [birthdays, total] = await Promise.all([
      Birthday.find(query)
        .populate('studentId')
        .sort({ month: 1, day: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Birthday.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: birthdays,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('Get All Birthdays Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch birthdays'
    });
  }
};

/**
 * PUT /api/birthdays/:id
 * Update birthday record
 */
exports.updateBirthday = async (req, res) => {
  try {
    const { id } = req.params;
    const { dateOfBirth, isActive } = req.body;
    
    const updates = {};
    if (dateOfBirth) {
      const dob = new Date(dateOfBirth);
      updates.dateOfBirth = dob;
      updates.year = dob.getFullYear();
      updates.month = dob.getMonth() + 1;
      updates.day = dob.getDate();
    }
    if (isActive !== undefined) {
      updates.isActive = isActive;
    }

    const birthday = await Birthday.findByIdAndUpdate(id, updates, { new: true });
    
    if (!birthday) {
      return res.status(404).json({ success: false, error: 'Birthday not found' });
    }
    
    res.json({ success: true, data: birthday });
  } catch (error) {
    console.error('Update Birthday Error:', error);
    res.status(500).json({ success: false, error: 'Failed to update birthday' });
  }
};

/**
 * DELETE /api/birthdays/:id
 * Delete birthday record
 */
exports.deleteBirthday = async (req, res) => {
  try {
    const { id } = req.params;
    const birthday = await Birthday.findByIdAndDelete(id);
    
    if (!birthday) {
      return res.status(404).json({ success: false, error: 'Birthday not found' });
    }
    
    res.json({ success: true, message: 'Birthday deleted successfully' });
  } catch (error) {
    console.error('Delete Birthday Error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete birthday' });
  }
};
