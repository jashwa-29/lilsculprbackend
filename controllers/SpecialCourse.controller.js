const SpecialCourse = require('../models/SpecialCourse.model');
const SpecialCoursePayment = require('../models/SpecialCoursePayment.model');
const emailService = require('../services/email.service');
const validationService = require('../services/validation.service');
const crypto = require('crypto');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ==================== CONSTANTS ====================
const BATCH_CAPACITY = 20;
const MAX_PENDING_MINUTES = 15;
const DELETE_PENDING_AFTER_MINUTES = 10; // Delete pending registrations after 10 minutes
const CLEANUP_INTERVAL_MINUTES = 5; // Run cleanup every 5 minutes

// ==================== HELPER FUNCTIONS ====================

// Generate unique registration ID with format LS-RD26-00001
const generateRegistrationId = async () => {
    try {
        // Find the latest registration ID for this workshop
        const latestRegistration = await SpecialCourse.findOne({
            registrationId: /^LS-RD26-\d{5}$/
        }).sort({ registrationId: -1 }).select('registrationId');

        let nextNumber = 1;
        
        if (latestRegistration && latestRegistration.registrationId) {
            // Extract the number from the last ID (e.g., "LS-RD26-00042" -> 42)
            const match = latestRegistration.registrationId.match(/LS-RD26-(\d{5})$/);
            if (match) {
                nextNumber = parseInt(match[1], 10) + 1;
            }
        }

        // Format with leading zeros (e.g., 1 -> "00001")
        const paddedNumber = String(nextNumber).padStart(5, '0');
        return `LS-RD26-${paddedNumber}`;
    } catch (error) {
        console.error('❌ Error generating registration ID:', error);
        // Fallback to timestamp-based ID if database query fails
        return 'LS-RD26-' + Date.now().toString().slice(-5);
    }
};

// Extract time from batch string
const extractBatchTime = (batchString) => {
    const match = batchString.match(/⏰\s*(.+)/);
    return match ? match[1] : batchString;
};

// Parse date for database queries
const parseDateForQuery = (dateString) => {
    if (dateString instanceof Date) return dateString;
    
    const parts = dateString.split('-');
    if (parts.length === 3) {
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        return new Date(Date.UTC(year, month, day));
    }
    
    const date = new Date(dateString);
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
};

// Check if child is already registered
const checkDuplicateRegistration = async (carnivalName, email, phone, childName, selectedDate) => {
    try {
        console.log(`🔍 Checking duplicate registration for: ${childName} on ${selectedDate} for ${carnivalName}`);
        
        const queryDate = parseDateForQuery(selectedDate);
        
        const existing = await SpecialCourse.findOne({
            carnivalName: carnivalName,
            selectedDate: queryDate,
            childName: { $regex: new RegExp(`^${childName.trim()}$`, 'i') },
            status: 'registered',
            payment_status: 'paid',
            $or: [
                { email: email.toLowerCase().trim() },
                { phone: phone.trim() }
            ]
        });

        if (existing) {
            console.log(`⚠️ Duplicate found! Registration ID: ${existing.registrationId}`);
            return {
                exists: true,
                data: existing
            };
        }
        
        console.log(`✅ No duplicate found for: ${childName} on ${selectedDate}`);
        return { exists: false };
        
    } catch (error) {
        console.error('❌ Duplicate check error:', error);
        return { exists: false, error: error.message };
    }
};

// Check slot availability for specific carnival, date and batch
const checkSlotAvailability = async (carnivalName, batchName, selectedDate) => {
    try {
        console.log(`🎯 Checking slot availability for ${carnivalName}, batch: ${batchName} on ${selectedDate}`);
        
        const queryDate = parseDateForQuery(selectedDate);
        const displayDate = new Date(queryDate.toISOString().split('T')[0]);
        
        const now = new Date();
        const deleteThreshold = new Date(now.getTime() - (DELETE_PENDING_AFTER_MINUTES * 60 * 1000));
        
        console.log(`📅 Query Date (UTC): ${queryDate.toISOString()}`);
        console.log(`📅 Display Date: ${displayDate.toLocaleDateString()}`);
        console.log(`🎪 Carnival: ${carnivalName}`);
        console.log(`🗑️ Delete threshold (${DELETE_PENDING_AFTER_MINUTES} min ago): ${deleteThreshold.toLocaleTimeString()}`);

        // FIRST: Delete old pending registrations for this specific slot
        const oldPendingQuery = {
            carnivalName: carnivalName,
            selectedBatch: batchName,
            selectedDate: queryDate,
            status: 'pending_payment',
            payment_status: 'pending',
            createdAt: { $lt: deleteThreshold }
        };

        const oldPendingCount = await SpecialCourse.countDocuments(oldPendingQuery);
        
        if (oldPendingCount > 0) {
            console.log(`🗑️ Immediate DELETE triggered for ${oldPendingCount} old pending registrations`);
            const deleteResult = await SpecialCourse.deleteMany(oldPendingQuery);
            console.log(`✅ Deleted ${deleteResult.deletedCount} old pending registrations`);
            
            // Also delete payment records
            try {
                const regIds = await SpecialCourse.find(oldPendingQuery).distinct('registrationId');
                if (regIds.length > 0) {
                    await SpecialCoursePayment.deleteMany({
                        registrationId: { $in: regIds }
                    });
                    console.log(`💰 Also deleted payment records for ${regIds.length} registrations`);
                }
            } catch (err) {
                console.warn('⚠️ Could not delete old payment records:', err.message);
            }
        }

        // Query for paid registrations
        const paidCount = await SpecialCourse.countDocuments({
            carnivalName: carnivalName,
            selectedBatch: batchName,
            selectedDate: queryDate,
            status: 'registered',
            payment_status: 'paid'
        });
        
        console.log(`💰 Paid registrations count: ${paidCount}`);

        // Query for active pending payments (not older than 10 minutes)
        const activePendingQuery = {
            carnivalName: carnivalName,
            selectedBatch: batchName,
            selectedDate: queryDate,
            status: 'pending_payment',
            payment_status: 'pending',
            createdAt: { $gte: deleteThreshold }
        };
        
        const activePendingCount = await SpecialCourse.countDocuments(activePendingQuery);
        console.log(`⏳ Active pending registrations (within ${DELETE_PENDING_AFTER_MINUTES} min): ${activePendingCount}`);

        // Query for expired pending payments (marked as expired)
        const expiredPendingCount = await SpecialCourse.countDocuments({
            carnivalName: carnivalName,
            selectedBatch: batchName,
            selectedDate: queryDate,
            status: 'expired',
            payment_status: 'expired'
        });

        console.log(`⌛ Expired pending registrations count: ${expiredPendingCount}`);

        const dateString = displayDate.toISOString().split('T')[0];
        const isOnline = dateString === '2026-01-25';
        const effectiveCapacity = isOnline ? 9999 : BATCH_CAPACITY;

        // Total registered count (paid + active pending)
        const registeredCount = paidCount + activePendingCount;
        console.log(`📊 Total registered count (paid + active pending): ${registeredCount}`);

        const availableSlots = Math.max(0, effectiveCapacity - registeredCount);
        
        console.log(`🎫 DATE: ${dateString} (${isOnline ? 'ONLINE' : 'OFFLINE'})`);
        console.log(`🎫 EFFECTIVE CAPACITY: ${effectiveCapacity}`);
        console.log(`🎫 AVAILABLE SLOTS: ${availableSlots}`);
        
        let status = 'available';
        let statusEmoji = '✅';
        let statusColor = 'green';
        
        if (!isOnline && availableSlots === 0) {
            status = 'full';
            statusEmoji = '❌';
            statusColor = 'red';
            console.log(`🚫 BATCH FULL`);
        } else if (!isOnline && availableSlots <= 3) {
            status = 'limited';
            statusEmoji = '⚠️';
            statusColor = 'orange';
            console.log(`🚨 WARNING: Only ${availableSlots} slot(s) remaining`);
        }
        
        return {
            carnivalName: carnivalName,
            batch: batchName,
            batchTime: extractBatchTime(batchName),
            date: displayDate,
            dateString: dateString,
            isOnline: isOnline,
            formattedDate: displayDate.toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            shortDate: displayDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            registeredCount: registeredCount,
            availableSlots: isOnline ? 999 : availableSlots,
            isFull: !isOnline && availableSlots === 0,
            capacity: effectiveCapacity,
            status: status,
            statusEmoji: statusEmoji,
            statusColor: statusColor,
            details: {
                paidCount: paidCount,
                activePendingCount: activePendingCount,
                expiredPendingCount: expiredPendingCount,
                oldPendingDeleted: oldPendingCount,
                totalCount: paidCount + activePendingCount + expiredPendingCount
            },
            lastCalculated: now.toISOString(),
            calculatedAt: now.toLocaleTimeString()
        };
    } catch (error) {
        console.error('❌ Slot check error:', error);
        return {
            carnivalName: carnivalName,
            batch: batchName,
            date: selectedDate,
            registeredCount: 0,
            availableSlots: BATCH_CAPACITY,
            isFull: false,
            capacity: BATCH_CAPACITY,
            status: 'error',
            statusEmoji: '❌',
            statusColor: 'red',
            details: {
                paidCount: 0,
                activePendingCount: 0,
                expiredPendingCount: 0,
                oldPendingDeleted: 0,
                totalCount: 0
            },
            lastCalculated: new Date().toISOString(),
            error: error.message
        };
    }
};

// Check multiple slots availability
const checkMultipleSlotsAvailability = async (carnivalName, selectedDate, batchList) => {
    try {
        const availability = [];
        
        for (const batch of batchList) {
            const slotInfo = await checkSlotAvailability(carnivalName, batch, selectedDate);
            availability.push(slotInfo);
        }
        
        return availability;
    } catch (error) {
        console.error('❌ Multiple slots check error:', error);
        throw error;
    }
};

// Clean up expired pending registrations - DELETE VERSION
const cleanupExpiredRegistrations = async () => {
    try {
        const now = new Date();
        const deleteThreshold = new Date(now.getTime() - (DELETE_PENDING_AFTER_MINUTES * 60 * 1000));
        
        console.log(`🧹 Starting cleanup (DELETE) at: ${now.toLocaleTimeString()}`);
        console.log(`🗑️ Delete threshold: ${DELETE_PENDING_AFTER_MINUTES} minute(s) ago (${deleteThreshold.toLocaleTimeString()})`);
        
        // Find ALL pending registrations first (for logging)
        const allPending = await SpecialCourse.find({
            status: 'pending_payment',
            payment_status: 'pending'
        }).select('registrationId carnivalName childName selectedBatch createdAt updatedAt')
          .sort({ createdAt: 1 });
        
        console.log(`📊 Total pending registrations in system: ${allPending.length}`);
        
        if (allPending.length > 0) {
            console.log(`📝 All pending registrations (oldest to newest):`);
            allPending.forEach(reg => {
                const ageMs = now - reg.createdAt;
                const ageMinutes = Math.floor(ageMs / (1000 * 60));
                const ageSeconds = Math.floor((ageMs % (1000 * 60)) / 1000);
                const willDelete = reg.createdAt < deleteThreshold;
                
                console.log(`  - ${reg.registrationId} | ${reg.childName} | Age: ${ageMinutes}m ${ageSeconds}s | Created: ${reg.createdAt.toLocaleTimeString()} | Delete: ${willDelete ? 'YES 🗑️' : 'NO'}`);
            });
        }

        // Find registrations to DELETE (older than DELETE_PENDING_AFTER_MINUTES)
        const deleteQuery = {
            status: 'pending_payment',
            payment_status: 'pending',
            createdAt: { $lt: deleteThreshold }
        };

        console.log(`🔍 Finding registrations to DELETE...`);
        const registrationsToDelete = await SpecialCourse.find(deleteQuery)
            .select('registrationId carnivalName childName selectedBatch createdAt');
        
        console.log(`📊 Found ${registrationsToDelete.length} registrations to DELETE`);

        if (registrationsToDelete.length === 0) {
            console.log(`✅ No registrations to delete`);
            return {
                success: true,
                deletedCount: 0,
                pendingTotal: allPending.length,
                message: 'No registrations to delete',
                timestamp: now.toISOString()
            };
        }

        console.log(`🗑️ Deleting ${registrationsToDelete.length} registrations:`);
        registrationsToDelete.forEach(reg => {
            const ageMs = now - reg.createdAt;
            const ageMinutes = Math.floor(ageMs / (1000 * 60));
            const ageSeconds = Math.floor((ageMs % (1000 * 60)) / 1000);
            console.log(`  - ${reg.registrationId} | ${reg.carnivalName} | ${reg.childName} | Age: ${ageMinutes}m ${ageSeconds}s`);
        });

        // DELETE all found registrations
        const registrationIds = registrationsToDelete.map(r => r.registrationId);
        
        const deleteResult = await SpecialCourse.deleteMany({
            registrationId: { $in: registrationIds }
        });

        console.log(`✅ DELETE completed: ${deleteResult.deletedCount} registrations removed from database`);
        
        // Also delete corresponding payment records
        try {
            const paymentDeleteResult = await SpecialCoursePayment.deleteMany({
                registrationId: { $in: registrationIds }
            });
            console.log(`💰 Also deleted ${paymentDeleteResult.deletedCount} payment records`);
        } catch (paymentError) {
            console.warn('⚠️ Could not delete payment records:', paymentError.message);
        }

        return {
            success: true,
            deletedCount: deleteResult.deletedCount,
            pendingTotal: allPending.length,
            pendingRemaining: allPending.length - deleteResult.deletedCount,
            timestamp: now.toISOString(),
            deleteThresholdMinutes: DELETE_PENDING_AFTER_MINUTES,
            deleteThresholdTime: deleteThreshold.toISOString(),
            details: registrationsToDelete.map(r => ({
                id: r.registrationId,
                carnival: r.carnivalName,
                child: r.childName,
                batch: r.selectedBatch,
                createdAt: r.createdAt,
                ageMinutes: Math.floor((now - r.createdAt) / (1000 * 60))
            }))
        };
        
    } catch (error) {
        console.error('❌ Cleanup (DELETE) error:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// ==================== AUTOMATIC CLEANUP SCHEDULER ====================

// Start automatic cleanup scheduler
const startAutoCleanupScheduler = () => {
    console.log('🚀 Starting automatic cleanup scheduler...');
    console.log(`⏰ Delete pending after: ${DELETE_PENDING_AFTER_MINUTES} minutes`);
    console.log(`🔄 Cleanup interval: ${CLEANUP_INTERVAL_MINUTES} minutes`);
    
    // Run initial cleanup 10 seconds after server starts
    setTimeout(async () => {
        try {
            console.log('🔍 Running initial cleanup check...');
            const result = await cleanupExpiredRegistrations();
            console.log(`✅ Initial cleanup: ${result.deletedCount} registrations deleted`);
        } catch (error) {
            console.error('❌ Initial cleanup failed:', error.message);
        }
    }, 10000);
    
    // Schedule cleanup to run every CLEANUP_INTERVAL_MINUTES
    setInterval(async () => {
        try {
            const now = new Date();
            console.log(`⏰ [${now.toLocaleTimeString()}] Running scheduled cleanup...`);
            const result = await cleanupExpiredRegistrations();
            
            if (result.deletedCount > 0) {
                console.log(`✅ Scheduled cleanup: ${result.deletedCount} registrations deleted`);
            } else {
                console.log(`✅ Scheduled cleanup: No registrations to delete`);
            }
        } catch (error) {
            console.error('❌ Scheduled cleanup failed:', error.message);
        }
    }, CLEANUP_INTERVAL_MINUTES * 60 * 1000);
    
    console.log(`✅ Auto-cleanup scheduled to run every ${CLEANUP_INTERVAL_MINUTES} minutes`);
};

// Start the scheduler when module loads (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
    // Use setTimeout to ensure server is fully started
    setTimeout(() => {
        startAutoCleanupScheduler();
    }, 5000);
}

// ==================== CONTROLLER METHODS ====================

// 1. CHECK SLOT AVAILABILITY FOR SPECIFIC CARNIVAL
exports.checkSlots = async (req, res) => {
    try {
        const { carnivalName, batch, date } = req.query;
        console.log(`🎯 Checking slots for ${carnivalName}, batch: ${batch} on ${date}`);

        if (!carnivalName || !batch || !date) {
            console.log(`❌ Carnival name, batch, and date are required`);
            return res.status(400).json({
                success: false,
                message: 'Carnival name, batch, and date are required'
            });
        }

        const slotInfo = await checkSlotAvailability(carnivalName, batch, date);
        
        if (slotInfo.error) {
            return res.status(400).json({
                success: false,
                message: slotInfo.error
            });
        }
        
        console.log(`✅ Slot check completed for ${carnivalName}: ${batch} on ${slotInfo.dateString}`);
        
        res.json({
            success: true,
            data: {
                carnivalName: carnivalName,
                batch: slotInfo.batch,
                batchTime: slotInfo.batchTime,
                date: slotInfo.dateString,
                formattedDate: new Date(slotInfo.date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                shortDate: new Date(slotInfo.date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                availableSlots: slotInfo.availableSlots,
                isFull: slotInfo.isFull,
                isOnline: slotInfo.isOnline,
                capacity: slotInfo.capacity,
                registeredCount: slotInfo.registeredCount,
                status: slotInfo.status,
                statusEmoji: slotInfo.statusEmoji,
                statusColor: slotInfo.statusColor,
                lastUpdated: slotInfo.lastCalculated
            }
        });

    } catch (error) {
        console.error('❌ Slot check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check slot availability'
        });
    }
};

// 2. CHECK MULTIPLE SLOTS AVAILABILITY
exports.checkMultipleSlots = async (req, res) => {
    try {
        const { carnivalName, date, batches } = req.body;
        console.log(`🎯 Checking multiple slots for ${carnivalName} on ${date}`);

        if (!carnivalName || !date || !batches || !Array.isArray(batches)) {
            console.log(`❌ Carnival name, date, and batches array are required`);
            return res.status(400).json({
                success: false,
                message: 'Carnival name, date, and batches array are required'
            });
        }

        const slotAvailability = await checkMultipleSlotsAvailability(carnivalName, date, batches);
        
        const hasAvailableSlots = slotAvailability.some(slot => !slot.isFull);
        
        console.log(`✅ Multiple slots check completed for ${carnivalName} on ${date}`);
        console.log(`📊 Has available slots: ${hasAvailableSlots}`);
        
        res.json({
            success: true,
            data: {
                carnivalName: carnivalName,
                date: date,
                formattedDate: new Date(date).toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                shortDate: new Date(date).toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                slots: slotAvailability,
                hasAvailableSlots: hasAvailableSlots,
                availableSlotsCount: slotAvailability.filter(slot => !slot.isFull).length,
                totalSlotsAvailable: slotAvailability.reduce((sum, slot) => sum + slot.availableSlots, 0)
            },
            lastUpdated: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Multiple slots check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check multiple slots availability'
        });
    }
};

// 3. INITIAL REGISTRATION (dynamic carnival)
exports.register = async (req, res) => {
    try {
        console.log('\n📝 ============ NEW REGISTRATION REQUEST ============');
        console.log('📝 Registration request received');

        const validation = validationService.validateRegistrationData(req.body);
        if (!validation.isValid) {
            console.log(`❌ Validation failed:`, validation.errors);
            return res.status(400).json({
                success: false,
                errors: validation.errors
            });
        }

        const { carnivalName, selectedDate, selectedBatch, availableDates } = req.body;
        
        console.log(`🎪 Carnival: ${carnivalName}`);
        console.log(`📅 Selected Date: ${selectedDate}`);
        console.log(`🎯 Selected Batch: ${selectedBatch}`);
        
        if (!carnivalName) {
            console.log(`❌ Carnival name is required`);
            return res.status(400).json({
                success: false,
                message: 'Carnival name is required'
            });
        }

        console.log(`🔍 Validating date: ${selectedDate}`);
        const dateValidation = validationService.validateDate(selectedDate, availableDates);
        
        if (!dateValidation.isValid) {
            console.log(`❌ Invalid date for ${carnivalName}: ${selectedDate} - ${dateValidation.error}`);
            return res.status(400).json({
                success: false,
                message: dateValidation.error
            });
        }

        const batchValidation = validationService.validateBatch(selectedBatch);
        if (!batchValidation.isValid) {
            console.log(`❌ Invalid batch format: ${selectedBatch}`);
            return res.status(400).json({
                success: false,
                message: batchValidation.message
            });
        }

        // Check for duplicate PAID registration
        const duplicateCheck = await checkDuplicateRegistration(
            carnivalName,
            req.body.email,
            req.body.phone,
            req.body.childName,
            selectedDate
        );

        if (duplicateCheck.exists) {
            console.log(`❌ Registration blocked: Duplicate found for ${req.body.childName} on ${selectedDate}`);
            return res.status(409).json({
                success: false,
                message: 'This child is already registered and paid for this carnival on this date.',
                data: {
                    existingRegistration: duplicateCheck.data.registrationId,
                    existingBatch: duplicateCheck.data.selectedBatch
                }
            });
        }

        // Check slot availability
        const slotInfo = await checkSlotAvailability(carnivalName, selectedBatch, selectedDate);
        
        if (slotInfo.isFull) {
            console.log(`❌ Registration blocked: Batch ${selectedBatch} on ${selectedDate} for ${carnivalName} is full`);
            
            return res.status(400).json({
                success: false,
                message: 'Sorry, this batch on the selected date is currently full. Please select another time slot or date.',
                data: {
                    carnivalName: carnivalName,
                    batch: selectedBatch,
                    date: dateValidation.dateString,
                    availableSlots: slotInfo.availableSlots,
                    capacity: slotInfo.capacity,
                    registeredCount: slotInfo.registeredCount
                }
            });
        }

        // Sanitize input
        const sanitizedData = validationService.sanitizeInput(req.body);

        // Extract batch time
        const batchTime = extractBatchTime(selectedBatch);

        // Create registration
        const registrationId = await generateRegistrationId();
        const now = new Date();
        const paymentExpiresAt = new Date(now.getTime() + (MAX_PENDING_MINUTES * 60 * 1000));
        
        const registrationDate = dateValidation.date;
        
        const registration = new SpecialCourse({
            registrationId: registrationId,
            carnivalName: carnivalName,
            parentName: sanitizedData.parentName.trim(),
            email: sanitizedData.email.toLowerCase().trim(),
            phone: sanitizedData.phone.trim(),
            childName: sanitizedData.childName.trim(),
            childAge: sanitizedData.childAge.trim(),
            selectedBatch: sanitizedData.selectedBatch.trim(),
            batchTime: batchTime,
            selectedDate: dateValidation.date,
            materialType: req.body.materialType || false,
            status: 'pending_payment',
            payment_status: 'pending',
            payment_expires_at: paymentExpiresAt,
            ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
            user_agent: req.headers['user-agent'],
            source: 'website_form'
        });

        await registration.save();

        console.log(`✅ Registration saved successfully: ${registrationId}`);
        console.log(`👤 Child: ${registration.childName}`);
        console.log(`🎯 Batch: ${registration.selectedBatch}`);
        console.log(`⏰ Batch Time: ${registration.batchTime}`);
        console.log(`📅 Date: ${dateValidation.dateString}`);
        console.log(`⏳ Registration will be deleted if not paid within ${DELETE_PENDING_AFTER_MINUTES} minute(s)`);
        
        const timeLeftMs = paymentExpiresAt - now;
        const timeLeftMinutes = Math.max(0, Math.floor(timeLeftMs / (1000 * 60)));
        
        res.status(201).json({
            success: true,
            message: 'Registration saved successfully',
            data: {
                registrationId: registrationId,
                carnivalName: carnivalName,
                parentName: registration.parentName,
                childName: registration.childName,
                batch: registration.selectedBatch,
                batchTime: registration.batchTime,
                date: dateValidation.dateString,
                formattedDate: dateValidation.date.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                shortDate: dateValidation.date.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                expiresAt: paymentExpiresAt,
                expiresInMinutes: MAX_PENDING_MINUTES,
                deleteAfterMinutes: DELETE_PENDING_AFTER_MINUTES,
                timeLeftMinutes: timeLeftMinutes,
                timeLeftSeconds: timeLeftMinutes * 60,
                slotInfo: {
                    available: slotInfo.availableSlots - 1,
                    capacity: slotInfo.capacity,
                    isFull: slotInfo.availableSlots - 1 <= 0,
                    registeredCount: slotInfo.registeredCount + 1
                },
                createdAt: registration.createdAt
            }
        });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
// 4. CREATE RAZORPAY ORDER
exports.createOrder = async (req, res) => {
    try {
        console.log('\n📦 ============ CREATE ORDER REQUEST ============');
        const { registrationId } = req.body;

        if (!registrationId) {
            return res.status(400).json({
                success: false,
                message: 'Registration ID is required'
            });
        }

        const registration = await SpecialCourse.findOne({ registrationId });
        if (!registration) {
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        // Calculate amount based on material type
        // Jan 25 (Online) = 299, Jan 26 (Offline) = 499
        // Alternatively, use the fee passed from frontend or stored in registration
        const amount = registration.materialType ? 499 : 299;
        
        console.log(`💰 Creating order for ${registrationId}: ₹${amount}`);

        const options = {
            amount: amount * 100, // amount in the smallest currency unit
            currency: "INR",
            receipt: registrationId,
            notes: {
                registrationId: registrationId,
                childName: registration.childName,
                carnivalName: registration.carnivalName
            }
        };

        const order = await razorpay.orders.create(options);
        
        console.log(`✅ Order created: ${order.id}`);

        // Update registration with order ID
        registration.payment = registration.payment || {};
        registration.payment.razorpay_order_id = order.id;
        registration.payment.amount = amount;
        await registration.save();

        res.json({
            success: true,
            data: {
                orderId: order.id,
                amount: amount,
                currency: "INR",
                key_id: process.env.RAZORPAY_KEY_ID
            }
        });

    } catch (error) {
        console.error('❌ Create order error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create payment order',
            error: error.message || 'Unknown error',
            details: process.env.NODE_ENV === 'development' ? (error.response || error) : undefined
        });
    }
};

// 5. VERIFY AND STORE PAYMENT - FIXED VERSION
exports.verifyPayment = async (req, res) => {
    try {
        console.log('\n💰 ============ PAYMENT VERIFICATION REQUEST ============');

        const { 
            razorpay_payment_id, 
            razorpay_order_id, 
            razorpay_signature,
            registrationId,
            paymentDetails = {}
        } = req.body;

        if (!razorpay_payment_id || !registrationId) {
            console.log(`❌ Payment verification failed: Missing required fields`);
            return res.status(400).json({
                success: false,
                message: 'Payment ID and Registration ID are required'
            });
        }

        console.log(`🔍 Looking up registration: ${registrationId}`);
        
        const registration = await SpecialCourse.findOne({ registrationId });
        if (!registration) {
            console.log(`❌ Registration not found: ${registrationId}`);
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        console.log(`✅ Found registration: ${registrationId}`);
        console.log(`🎪 Carnival: ${registration.carnivalName}`);
        console.log(`👤 Child: ${registration.childName}`);
        console.log(`⏳ Current status: ${registration.status}`);
        console.log(`💳 Current payment status: ${registration.payment_status}`);
        console.log(`📅 Created at: ${registration.createdAt.toLocaleTimeString()}`);

        // Check if already paid
        if (registration.payment_status === 'paid') {
            console.log(`ℹ️ Payment already processed for: ${registrationId}`);
            return res.status(200).json({
                success: true,
                message: 'Payment already processed',
                data: { 
                    registrationId,
                    emailSent: true
                }
            });
        }

        // FIX: Check registration status - only allow if status is 'pending_payment'
        if (registration.status !== 'pending_payment') {
            console.log(`❌ Registration ${registrationId} has status: ${registration.status}, cannot accept payment`);
            
            if (registration.status === 'expired') {
                console.log(`❌ Registration ${registrationId} is expired and cannot accept payment`);
                return res.status(400).json({
                    success: false,
                    message: 'This registration has expired. Please register again.',
                    data: {
                        registrationId: registrationId,
                        status: registration.status
                    }
                });
            }
            
            return res.status(400).json({
                success: false,
                message: `Cannot process payment for registration with status: ${registration.status}`,
                data: {
                    registrationId: registrationId,
                    status: registration.status
                }
            });
        }

        const now = new Date();
        console.log(`🕒 Current time: ${now.toLocaleTimeString()}`);
        console.log(`📅 Registration created: ${registration.createdAt.toLocaleTimeString()}`);
        
        const registrationAgeMs = now - registration.createdAt;
        const registrationAgeMinutes = Math.floor(registrationAgeMs / (1000 * 60));
        const registrationAgeSeconds = Math.floor((registrationAgeMs % (1000 * 60)) / 1000);
        
        console.log(`⏳ Registration age: ${registrationAgeMinutes}m ${registrationAgeSeconds}s`);
        
        // Calculate delete threshold (10 minutes ago)
        const deleteThreshold = new Date(now.getTime() - (DELETE_PENDING_AFTER_MINUTES * 60 * 1000));
        console.log(`🗑️ Delete threshold (${DELETE_PENDING_AFTER_MINUTES} min ago): ${deleteThreshold.toLocaleTimeString()}`);
        
        // FIX: Check if registration should be deleted based on threshold
        // IMPORTANT: If registration is OLDER than 10 minutes, DELETE it and block payment
        if (registration.createdAt < deleteThreshold) {
            console.log(`🚨 ALERT: Registration ${registrationId} created at ${registration.createdAt.toLocaleTimeString()} is OLDER than threshold ${deleteThreshold.toLocaleTimeString()}`);
            console.log(`🗑️ Registration should be deleted - Age: ${registrationAgeMinutes}m ${registrationAgeSeconds}s`);
            
            // Delete the registration
            await SpecialCourse.deleteOne({ registrationId: registrationId });
            
            // Also delete payment records
            try {
                await SpecialCoursePayment.deleteMany({ registrationId: registrationId });
            } catch (err) {
                console.warn('⚠️ Could not delete payment records:', err.message);
            }
            
            return res.status(400).json({
                success: false,
                message: `Registration expired and was deleted. Please register again. (Registrations are deleted after ${DELETE_PENDING_AFTER_MINUTES} minute(s) if not paid)`,
                data: {
                    registrationId: registrationId,
                    ageMinutes: registrationAgeMinutes,
                    ageSeconds: registrationAgeSeconds,
                    deleteThreshold: DELETE_PENDING_AFTER_MINUTES,
                    createdAt: registration.createdAt.toISOString(),
                    thresholdTime: deleteThreshold.toISOString(),
                    currentTime: now.toISOString()
                }
            });
        } else {
            console.log(`✅ Registration is still valid (within ${DELETE_PENDING_AFTER_MINUTES} minute limit)`);
            const timeLeftMs = deleteThreshold.getTime() - now.getTime() + (DELETE_PENDING_AFTER_MINUTES * 60 * 1000);
            const timeLeftMinutes = Math.max(0, Math.floor(timeLeftMs / (1000 * 60)));
            const timeLeftSeconds = Math.max(0, Math.floor((timeLeftMs % (1000 * 60)) / 1000));
            console.log(`⏰ Time left to complete payment: ${timeLeftMinutes}m ${timeLeftSeconds}s`);
        }

        // Check if slot is still available
        const slotInfo = await checkSlotAvailability(
            registration.carnivalName,
            registration.selectedBatch, 
            registration.selectedDate
        );
        
        if (slotInfo.isFull) {
            console.log(`❌ Slot no longer available for: ${registrationId} on ${slotInfo.dateString}`);
            
            return res.status(400).json({
                success: false,
                message: 'Sorry, this slot on the selected date is no longer available.',
                data: {
                    registrationId: registrationId,
                    carnivalName: registration.carnivalName,
                    date: slotInfo.dateString,
                    batch: registration.selectedBatch,
                    availableSlots: slotInfo.availableSlots
                }
            });
        }

        console.log(`✅ Slot available! Proceeding with payment...`);
        
        // --- SIGNATURE VERIFICATION ---
        if (razorpay_signature !== 'direct_payment') {
            console.log('� Verifying Razorpay signature...');
            const body = razorpay_order_id + "|" + razorpay_payment_id;
            const expectedSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(body.toString())
                .digest("hex");

            if (expectedSignature !== razorpay_signature) {
                console.log('❌ Invalid signature detected!');
                return res.status(400).json({
                    success: false,
                    message: 'Invalid payment signature'
                });
            }
            console.log('✅ Signature verified successfully');
        } else {
            console.warn('⚠️ Skipping signature verification for direct payment (legacy)');
        }

        // Calculate amount dynamically
        const amount = registration.materialType ? 499 : 299;
        console.log(`💰 Final amount verified: ₹${amount}`);

        // --- FETCH ACTUAL PAYMENT DETAILS FROM RAZORPAY ---
        let actualPaymentMethod = 'card';
        let paymentInfo = { bank: '', wallet: '', vpa: '' };

        if (razorpay_payment_id !== 'direct_payment') {
            try {
                console.log(`📡 Fetching payment details from Razorpay for: ${razorpay_payment_id}`);
                const razorpayPayment = await razorpay.payments.fetch(razorpay_payment_id);
                if (razorpayPayment) {
                    actualPaymentMethod = razorpayPayment.method || 'card';
                    paymentInfo = {
                        bank: razorpayPayment.bank || '',
                        wallet: razorpayPayment.wallet || '',
                        vpa: razorpayPayment.vpa || ''
                    };
                    console.log(`✅ Payment method identified: ${actualPaymentMethod}`);
                }
            } catch (fetchError) {
                console.warn('⚠️ Could not fetch payment method from Razorpay:', fetchError.message);
                // Fallback to what was sent or 'card'
                actualPaymentMethod = paymentDetails.method || 'card';
            }
        }
        
        // Update registration with payment info
        registration.payment = {
            razorpay_payment_id: razorpay_payment_id,
            razorpay_order_id: razorpay_order_id || registration.payment?.razorpay_order_id || 'direct_payment',
            razorpay_signature: razorpay_signature || 'direct_payment',
            amount: amount,
            currency: "INR",
            status: 'paid',
            payment_date: now,
            method: actualPaymentMethod,
            bank: paymentInfo.bank || paymentDetails.bank || '',
            wallet: paymentInfo.wallet || paymentDetails.wallet || '',
            vpa: paymentInfo.vpa || paymentDetails.vpa || ''
        };
        
        registration.status = 'registered';
        registration.payment_status = 'paid';
        registration.payment_confirmed_at = now;
        registration.updatedAt = now;

        await registration.save();

        console.log(`✅ Payment stored successfully for: ${registrationId}`);
        console.log(`📊 Status updated to: ${registration.status}`);

        // Create payment log
        try {
            await SpecialCoursePayment.create({
                registrationId: registrationId,
                razorpay_payment_id: razorpay_payment_id,
                razorpay_order_id: razorpay_order_id || 'direct_payment',
                razorpay_signature: razorpay_signature || 'direct_payment',
                amount: amount, // Use the dynamic amount
                currency: "INR",
                status: 'captured',
                method: actualPaymentMethod,
                bank: paymentInfo.bank || paymentDetails.bank || '',
                wallet: paymentInfo.wallet || paymentDetails.wallet || '',
                vpa: paymentInfo.vpa || paymentDetails.vpa || '',
                carnivalName: registration.carnivalName,
                source: 'frontend_verification',
                registration_date: registration.selectedDate,
                registration_batch: registration.selectedBatch,
                child_name: registration.childName,
                parent_email: registration.email
            });
            console.log(`📝 Payment log created successfully`);
        } catch (paymentLogError) {
            console.warn('⚠️ Could not create payment log:', paymentLogError.message);
        }

        // Send confirmation email
        let emailResult = { success: false };
        try {
            console.log(`📧 Sending confirmation email to: ${registration.email}`);
            emailResult = await emailService.sendRegistrationConfirmation(
                registration.email, 
                {
                    carnivalName: registration.carnivalName,
                    parentName: registration.parentName,
                    childName: registration.childName,
                    batch: registration.selectedBatch,
                    batchTime: registration.batchTime,
                    date: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    }) : '',
                    shortDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric'
                    }) : '',
                    registrationId: registration.registrationId,
                    paymentId: razorpay_payment_id,
                    amount: registration.payment?.amount || amount,
                    paymentDate: now.toLocaleDateString('en-IN'),
                    paymentTime: now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                }
            );
            
            if (emailResult.success) {
                console.log(`✅ Confirmation email sent successfully`);
            } else {
                console.warn(`⚠️ Email sending failed:`, emailResult.error);
            }
        } catch (emailError) {
            console.error('❌ Email sending error:', emailError);
        }

        // Send admin notification
        try {
            console.log(`📧 Sending admin notification...`);
            await emailService.sendAdminNotification(registration);
            console.log(`✅ Admin notification sent`);
        } catch (adminEmailError) {
            console.warn('⚠️ Admin email failed:', adminEmailError.message);
        }

        console.log(`🎉 PAYMENT COMPLETED SUCCESSFULLY FOR: ${registrationId}`);
        console.log(`🎪 Carnival: ${registration.carnivalName}`);
        console.log(`� Amount: ${registration.payment?.amount || amount}`);

        res.json({
            success: true,
            message: 'Payment verified and registration confirmed',
            data: {
                registrationId: registration.registrationId,
                carnivalName: registration.carnivalName,
                paymentId: razorpay_payment_id,
                date: registration.selectedDate ? registration.selectedDate.toISOString().split('T')[0] : null,
                formattedDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : null,
                shortDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }) : null,
                batch: registration.selectedBatch,
                batchTime: registration.batchTime,
                childName: registration.childName,
                emailSent: emailResult.success,
                timestamp: now.toISOString(),
                slotInfo: {
                    currentAvailable: slotInfo.availableSlots - 1,
                    capacity: BATCH_CAPACITY,
                    registeredCount: slotInfo.registeredCount + 1
                }
            }
        });

    } catch (error) {
        console.error('❌ Payment verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Payment verification failed. Please contact support.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// 5. CHECK DUPLICATE REGISTRATION
exports.checkDuplicate = async (req, res) => {
    try {
        const { carnivalName, email, phone, childName, selectedDate } = req.body;
        console.log(`🔍 Checking duplicate for: ${childName} on ${selectedDate} for ${carnivalName}`);

        if (!carnivalName || !email || !phone || !childName || !selectedDate) {
            console.log(`❌ Missing required fields for duplicate check`);
            return res.status(400).json({
                success: false,
                message: 'Carnival name, email, phone, child name, and date are required'
            });
        }

        const duplicateCheck = await checkDuplicateRegistration(carnivalName, email, phone, childName, selectedDate);
        
        if (duplicateCheck.error) {
            return res.status(400).json({
                success: false,
                message: duplicateCheck.error
            });
        }

        const result = {
            success: true,
            exists: duplicateCheck.exists,
            message: duplicateCheck.exists 
                ? 'This child is already registered and paid for this carnival on this date.' 
                : 'No duplicate found'
        };

        console.log(`✅ Duplicate check completed: ${result.exists ? 'DUPLICATE FOUND' : 'NO DUPLICATE'}`);
        
        if (duplicateCheck.exists && duplicateCheck.data) {
            result.existingRegistration = {
                registrationId: duplicateCheck.data.registrationId,
                batch: duplicateCheck.data.selectedBatch,
                date: duplicateCheck.data.selectedDate.toISOString().split('T')[0]
            };
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Duplicate check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check duplicate registration'
        });
    }
};

// 6. GET REGISTRATION DETAILS
exports.getRegistration = async (req, res) => {
    try {
        const { registrationId } = req.params;
        console.log(`🔍 Getting registration details for: ${registrationId}`);

        const registration = await SpecialCourse.findOne({ registrationId })
            .select('-__v -_id -ip_address -user_agent');
        
        if (!registration) {
            console.log(`❌ Registration not found: ${registrationId}`);
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        console.log(`✅ Found registration: ${registrationId}`);
        console.log(`🎪 Carnival: ${registration.carnivalName}`);
        
        // Check if registration should be deleted (older than 10 minutes)
        const now = new Date();
        const ageMs = now - registration.createdAt;
        const ageMinutes = Math.floor(ageMs / (1000 * 60));
        const ageSeconds = Math.floor((ageMs % (1000 * 60)) / 1000);
        const deleteThreshold = new Date(now.getTime() - (DELETE_PENDING_AFTER_MINUTES * 60 * 1000));
        
        if (registration.status === 'pending_payment' && registration.createdAt < deleteThreshold) {
            console.log(`🗑️ Registration ${registrationId} is ${ageMinutes}m ${ageSeconds}s old - deleting`);
            
            // Delete the registration
            await SpecialCourse.deleteOne({ registrationId: registrationId });
            
            return res.status(404).json({
                success: false,
                message: `Registration expired and was deleted. (Registrations are deleted after ${DELETE_PENDING_AFTER_MINUTES} minute(s) if not paid)`,
                data: {
                    registrationId: registrationId,
                    ageMinutes: ageMinutes,
                    ageSeconds: ageSeconds,
                    deleteThreshold: DELETE_PENDING_AFTER_MINUTES
                }
            });
        }

        const safeData = {
            registrationId: registration.registrationId,
            carnivalName: registration.carnivalName,
            parentName: registration.parentName,
            childName: registration.childName,
            childAge: registration.childAge,
            selectedBatch: registration.selectedBatch,
            batchTime: registration.batchTime,
            selectedDate: registration.selectedDate,
            dateString: registration.selectedDate ? registration.selectedDate.toISOString().split('T')[0] : null,
            formattedDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }) : null,
            shortDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }) : null,
            email: registration.email,
            phone: registration.phone,
            status: registration.status,
            payment_status: registration.payment_status,
            payment: registration.payment ? {
                status: registration.payment.status,
                amount: registration.payment.amount,
                currency: registration.payment.currency,
                payment_date: registration.payment.payment_date,
                method: registration.payment.method
            } : null,
            payment_expires_at: registration.payment_expires_at,
            createdAt: registration.createdAt,
            updatedAt: registration.updatedAt,
            ageMinutes: ageMinutes,
            ageSeconds: ageSeconds,
            willDeleteInMinutes: registration.createdAt < deleteThreshold ? 0 : 
                Math.max(0, Math.floor((deleteThreshold.getTime() - now.getTime() + (DELETE_PENDING_AFTER_MINUTES * 60 * 1000)) / (1000 * 60)))
        };

        console.log(`✅ Returning registration details for: ${registrationId}`);

        res.json({
            success: true,
            data: safeData
        });

    } catch (error) {
        console.error('❌ Get registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch registration'
        });
    }
};

// 7. CHECK REGISTRATION STATUS
exports.checkRegistrationStatus = async (req, res) => {
    try {
        const { registrationId } = req.body;
        console.log(`🔍 Checking registration status for: ${registrationId}`);

        if (!registrationId) {
            console.log(`❌ Registration ID is required`);
            return res.status(400).json({
                success: false,
                message: 'Registration ID is required'
            });
        }

        const registration = await SpecialCourse.findOne({ registrationId });
        
        if (!registration) {
            console.log(`❌ Registration not found: ${registrationId}`);
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        console.log(`✅ Found registration: ${registrationId}`);
        
        // Check if registration should be deleted
        const now = new Date();
        const ageMs = now - registration.createdAt;
        const ageMinutes = Math.floor(ageMs / (1000 * 60));
        const ageSeconds = Math.floor((ageMs % (1000 * 60)) / 1000);
        const deleteThreshold = new Date(now.getTime() - (DELETE_PENDING_AFTER_MINUTES * 60 * 1000));
        
        if (registration.status === 'pending_payment' && registration.createdAt < deleteThreshold) {
            console.log(`🗑️ Registration ${registrationId} is ${ageMinutes}m ${ageSeconds}s old - deleting`);
            
            // Delete the registration
            await SpecialCourse.deleteOne({ registrationId: registrationId });
            
            return res.status(404).json({
                success: false,
                message: `Registration expired and was deleted. Please register again.`,
                data: {
                    registrationId: registrationId,
                    ageMinutes: ageMinutes,
                    ageSeconds: ageSeconds,
                    deleteThreshold: DELETE_PENDING_AFTER_MINUTES
                }
            });
        }

        // Check if slot is still available
        let slotInfo = null;
        let slotStillAvailable = true;
        
        if (registration.status === 'pending_payment') {
            slotInfo = await checkSlotAvailability(
                registration.carnivalName,
                registration.selectedBatch, 
                registration.selectedDate
            );
            slotStillAvailable = !slotInfo.isFull;
            
            console.log(`📊 Slot still available: ${slotStillAvailable} for ${registration.carnivalName}`);
        }

        const timeLeftMs = deleteThreshold.getTime() - now.getTime() + (DELETE_PENDING_AFTER_MINUTES * 60 * 1000);
        const timeLeftMinutes = Math.max(0, Math.floor(timeLeftMs / (1000 * 60)));
        const timeLeftSeconds = Math.max(0, Math.floor((timeLeftMs % (1000 * 60)) / 1000));

        const result = {
            success: true,
            data: {
                registrationId: registration.registrationId,
                carnivalName: registration.carnivalName,
                status: registration.status,
                payment_status: registration.payment_status,
                batch: registration.selectedBatch,
                batchTime: registration.batchTime,
                date: registration.selectedDate,
                dateString: registration.selectedDate ? registration.selectedDate.toISOString().split('T')[0] : null,
                formattedDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }) : null,
                shortDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }) : null,
                expiresAt: registration.payment_expires_at,
                ageMinutes: ageMinutes,
                ageSeconds: ageSeconds,
                willDeleteInMinutes: timeLeftMinutes,
                willDeleteInSeconds: timeLeftSeconds,
                isActive: registration.status === 'pending_payment' && registration.createdAt >= deleteThreshold && slotStillAvailable,
                canProceed: registration.status === 'pending_payment' && registration.createdAt >= deleteThreshold && slotStillAvailable,
                slotAvailable: slotStillAvailable,
                slotInfo: slotInfo ? {
                    date: slotInfo.dateString,
                    available: slotInfo.availableSlots,
                    isFull: slotInfo.isFull,
                    capacity: slotInfo.capacity,
                    registeredCount: slotInfo.registeredCount,
                    status: slotInfo.status
                } : null,
                timestamp: now.toISOString()
            }
        };

        console.log(`✅ Status check completed for: ${registrationId}`);

        res.json(result);

    } catch (error) {
        console.error('❌ Registration status check error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check registration status'
        });
    }
};

// 8. GET SYSTEM STATISTICS
exports.getStatistics = async (req, res) => {
    try {
        console.log(`📊 Fetching system statistics...`);
        const now = new Date();
        
        // Get counts
        const totalRegistrations = await SpecialCourse.countDocuments();
        const paidRegistrations = await SpecialCourse.countDocuments({ 
            status: 'registered', 
            payment_status: 'paid' 
        });
        const pendingRegistrations = await SpecialCourse.countDocuments({ 
            status: 'pending_payment', 
            payment_status: 'pending' 
        });
        const expiredRegistrations = await SpecialCourse.countDocuments({ 
            status: 'expired' 
        });
        
        // Get carnival-wise statistics
        const carnivalStats = await SpecialCourse.aggregate([
            {
                $group: {
                    _id: "$carnivalName",
                    total: { $sum: 1 },
                    paid: { 
                        $sum: { 
                            $cond: [
                                { $and: [
                                    { $eq: ["$status", "registered"] },
                                    { $eq: ["$payment_status", "paid"] }
                                ]},
                                1,
                                0
                            ]
                        }
                    },
                    pending: { 
                        $sum: { 
                            $cond: [
                                { $and: [
                                    { $eq: ["$status", "pending_payment"] },
                                    { $eq: ["$payment_status", "pending"] }
                                ]},
                                1,
                                0
                            ]
                        }
                    },
                    expired: { 
                        $sum: { 
                            $cond: [
                                { $eq: ["$status", "expired"] },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Calculate rates
        const successRate = totalRegistrations > 0 ? ((paidRegistrations / totalRegistrations) * 100).toFixed(2) + '%' : '0%';
        const conversionRate = (pendingRegistrations + paidRegistrations) > 0 ? 
            ((paidRegistrations / (pendingRegistrations + paidRegistrations)) * 100).toFixed(2) + '%' : '0%';

        console.log(`✅ Statistics calculated successfully`);
        
        res.json({
            success: true,
            data: {
                summary: {
                    totalRegistrations: totalRegistrations,
                    paidRegistrations: paidRegistrations,
                    pendingRegistrations: pendingRegistrations,
                    expiredRegistrations: expiredRegistrations,
                    successRate: successRate,
                    conversionRate: conversionRate,
                    totalRevenue: paidRegistrations * WORKSHOP_FEE
                },
                carnivalStatistics: carnivalStats,
                systemSettings: {
                    maxPendingMinutes: MAX_PENDING_MINUTES,
                    deletePendingAfterMinutes: DELETE_PENDING_AFTER_MINUTES,
                    batchCapacity: BATCH_CAPACITY,
                    workshopFee: WORKSHOP_FEE,
                    cleanupIntervalMinutes: CLEANUP_INTERVAL_MINUTES
                },
                timestamp: now.toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch statistics'
        });
    }
};

// 9. GET CARNIVAL STATISTICS
exports.getCarnivalStatistics = async (req, res) => {
    try {
        const { carnivalName } = req.params;
        console.log(`📊 Fetching statistics for carnival: ${carnivalName}`);

        if (!carnivalName) {
            return res.status(400).json({
                success: false,
                message: 'Carnival name is required'
            });
        }

        const now = new Date();
        
        // Get unique dates for this carnival
        const uniqueDates = await SpecialCourse.distinct('selectedDate', { carnivalName });
        
        const dateStats = [];
        
        for (const date of uniqueDates) {
            const batches = await SpecialCourse.distinct('selectedBatch', { 
                carnivalName, 
                selectedDate: date 
            });
            
            const batchDetails = [];
            let totalForDate = 0;
            
            for (const batch of batches) {
                const slotInfo = await checkSlotAvailability(carnivalName, batch, date);
                batchDetails.push({
                    batch: batch,
                    batchTime: slotInfo.batchTime,
                    paidCount: slotInfo.details.paidCount,
                    activePending: slotInfo.details.activePendingCount,
                    total: slotInfo.registeredCount,
                    availableSlots: slotInfo.availableSlots,
                    isFull: slotInfo.isFull,
                    status: slotInfo.status
                });
                totalForDate += slotInfo.registeredCount;
            }
            
            dateStats.push({
                date: date.toISOString().split('T')[0],
                displayDate: date.toLocaleDateString('en-IN', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }),
                shortDate: date.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric'
                }),
                batches: batches.length,
                totalRegistrations: totalForDate,
                batchDetails: batchDetails
            });
        }
        
        // Get summary counts
        const totalForCarnival = await SpecialCourse.countDocuments({ carnivalName });
        const paidForCarnival = await SpecialCourse.countDocuments({ 
            carnivalName, 
            status: 'registered', 
            payment_status: 'paid' 
        });
        const pendingForCarnival = await SpecialCourse.countDocuments({ 
            carnivalName, 
            status: 'pending_payment', 
            payment_status: 'pending' 
        });
        const expiredForCarnival = await SpecialCourse.countDocuments({ 
            carnivalName, 
            status: 'expired' 
        });
        
        console.log(`✅ Carnival statistics calculated for: ${carnivalName}`);
        
        res.json({
            success: true,
            data: {
                carnivalName: carnivalName,
                summary: {
                    totalRegistrations: totalForCarnival,
                    paidRegistrations: paidForCarnival,
                    pendingRegistrations: pendingForCarnival,
                    expiredRegistrations: expiredForCarnival,
                    revenue: paidForCarnival * WORKSHOP_FEE
                },
                dateStatistics: dateStats,
                uniqueDates: dateStats.length,
                timestamp: now.toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Carnival statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch carnival statistics'
        });
    }
};

// 10. RUN CLEANUP
exports.runCleanup = async (req, res) => {
    try {
        console.log(`🧹 Manual cleanup triggered via API`);
        const result = await cleanupExpiredRegistrations();
        
        console.log(`✅ Cleanup completed: ${result.deletedCount} registrations deleted`);
        
        res.json({
            success: true,
            message: 'Cleanup executed',
            data: result
        });
    } catch (error) {
        console.error('❌ Manual cleanup error:', error);
        res.status(500).json({
            success: false,
            message: 'Cleanup failed',
            error: error.message
        });
    }
};

// 11. MANUALLY EXPIRE REGISTRATION
exports.expireRegistration = async (req, res) => {
    try {
        const { registrationId } = req.body;
        console.log(`🕒 Manual expiration requested for: ${registrationId}`);

        const registration = await SpecialCourse.findOne({ registrationId });
        
        if (!registration) {
            console.log(`❌ Registration not found: ${registrationId}`);
            return res.status(404).json({
                success: false,
                message: 'Registration not found'
            });
        }

        console.log(`✅ Found registration: ${registrationId}`);
        console.log(`📊 Current status: ${registration.status}`);

        if (registration.status === 'pending_payment') {
            const oldStatus = registration.status;
            const oldDate = registration.selectedDate;
            
            // DELETE instead of marking as expired
            await SpecialCourse.deleteOne({ registrationId: registrationId });
            
            // Also delete payment records
            try {
                await SpecialCoursePayment.deleteMany({ registrationId: registrationId });
            } catch (err) {
                console.warn('⚠️ Could not delete payment records:', err.message);
            }

            console.log(`✅ Manually DELETED: ${registrationId}`);
            console.log(`🔄 Status changed from '${oldStatus}' to DELETED`);

            res.json({
                success: true,
                message: 'Registration deleted successfully',
                data: {
                    registrationId: registration.registrationId,
                    carnivalName: registration.carnivalName,
                    oldStatus: oldStatus,
                    newStatus: 'deleted',
                    date: oldDate ? oldDate.toISOString().split('T')[0] : null,
                    batch: registration.selectedBatch,
                    deletedAt: new Date()
                }
            });
        } else {
            console.log(`⚠️ Cannot delete registration with status: ${registration.status}`);
            res.json({
                success: false,
                message: `Registration is already ${registration.status}, cannot delete`
            });
        }

    } catch (error) {
        console.error('❌ Expire registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to expire registration'
        });
    }
};

// 12. HEALTH CHECK
exports.healthCheck = async (req, res) => {
    try {
        console.log(`🏥 Health check requested`);
        const mongoose = require('mongoose');
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        console.log(`🔍 Database status: ${dbStatus}`);
        
        // Run a quick cleanup check
        console.log(`🧹 Running quick cleanup check...`);
        const cleanupResult = await cleanupExpiredRegistrations();
        
        // Check database connection
        console.log(`🔍 Pinging database...`);
        const dbPing = await mongoose.connection.db.admin().ping();
        
        console.log(`✅ Health check completed`);
        
        // Get active carnivals count
        const activeCarnivals = await SpecialCourse.distinct('carnivalName');
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: {
                status: dbStatus,
                ping: dbPing.ok === 1 ? 'ok' : 'failed',
                host: mongoose.connection.host,
                name: mongoose.connection.name
            },
            cleanup: cleanupResult,
            system: {
                maxPendingMinutes: MAX_PENDING_MINUTES,
                deletePendingAfterMinutes: DELETE_PENDING_AFTER_MINUTES,
                cleanupIntervalMinutes: CLEANUP_INTERVAL_MINUTES,
                batchCapacity: BATCH_CAPACITY,
                workshopFee: WORKSHOP_FEE,
                activeCarnivals: activeCarnivals.length,
                nodeVersion: process.version,
                environment: process.env.NODE_ENV || 'development'
            }
        });
    } catch (error) {
        console.error('❌ Health check error:', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// 13. TEST CLEANUP FUNCTIONALITY
exports.testCleanup = async (req, res) => {
    try {
        console.log(`🧪 Testing cleanup (DELETE) functionality`);
        const now = new Date();
        const deleteThreshold = new Date(now.getTime() - (DELETE_PENDING_AFTER_MINUTES * 60 * 1000));
        
        // Find all pending registrations
        const pendingRegs = await SpecialCourse.find({
            status: 'pending_payment',
            payment_status: 'pending'
        }).select('registrationId carnivalName childName selectedBatch createdAt updatedAt payment_expires_at')
          .sort({ createdAt: 1 })
          .limit(20);
        
        console.log(`📊 Found ${pendingRegs.length} pending registrations`);
        
        // Analyze which would be deleted
        const regsAnalysis = pendingRegs.map(reg => {
            const ageMs = now - reg.createdAt;
            const ageMinutes = Math.floor(ageMs / (1000 * 60));
            const ageSeconds = Math.floor((ageMs % (1000 * 60)) / 1000);
            const willDelete = reg.createdAt < deleteThreshold;
            
            return {
                registrationId: reg.registrationId,
                carnival: reg.carnivalName,
                child: reg.childName,
                batch: reg.selectedBatch,
                createdAt: reg.createdAt.toLocaleTimeString(),
                age: `${ageMinutes}m ${ageSeconds}s`,
                willDelete: willDelete,
                deleteReason: willDelete ? `Older than ${DELETE_PENDING_AFTER_MINUTES} minute(s)` : 'Still within limit'
            };
        });
        
        // Count how many would be deleted
        const wouldDeleteCount = regsAnalysis.filter(r => r.willDelete).length;
        
        console.log(`📝 Pending registrations analysis:`);
        regsAnalysis.forEach(reg => {
            console.log(`  - ${reg.registrationId} | ${reg.child} | Age: ${reg.age} | Delete: ${reg.willDelete ? 'YES 🗑️' : 'NO'}`);
        });
        console.log(`📊 Would delete ${wouldDeleteCount} of ${pendingRegs.length} pending registrations`);
        
        // Run cleanup to see actual results
        const cleanupResult = await cleanupExpiredRegistrations();
        
        res.json({
            success: true,
            analysis: {
                totalPending: pendingRegs.length,
                wouldDeleteCount: wouldDeleteCount,
                deleteThresholdMinutes: DELETE_PENDING_AFTER_MINUTES,
                deleteThresholdTime: deleteThreshold.toLocaleTimeString(),
                currentTime: now.toLocaleTimeString(),
                registrations: regsAnalysis
            },
            cleanup: cleanupResult,
            testTime: now.toISOString()
        });
        
    } catch (error) {
        console.error('❌ Test cleanup error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

// 14. GET ALL REGISTRATIONS (for admin panel)
exports.getAllRegistrations = async (req, res) => {
  try {
    console.log(`📋 Fetching all registrations for admin panel`);
    
    const {
      page = 1,
      limit = 50,
      carnival,
      status,
      payment_status,
      startDate,
      endDate,
      search
    } = req.query;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build query
    let query = {};
    
    if (carnival && carnival !== 'all') {
      query.carnivalName = carnival;
    }
    
    if (status && status !== 'all') {
      query.status = status;
    }
    
    if (payment_status && payment_status !== 'all') {
      query.payment_status = payment_status;
    }
    
    if (startDate && endDate) {
      query.selectedDate = {
        $gte: parseDateForQuery(startDate),
        $lte: parseDateForQuery(endDate)
      };
    }
    
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      query.$or = [
        { registrationId: searchRegex },
        { parentName: searchRegex },
        { childName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex }
      ];
    }
    
    console.log(`🔍 Query:`, JSON.stringify(query, null, 2));
    
    // Get total count
    const total = await SpecialCourse.countDocuments(query);
    
    // Get paginated data
    const registrations = await SpecialCourse.find(query)
      .select('-__v -ip_address -user_agent -source -webhook_data')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();
    
    // Format dates
    const formattedRegistrations = registrations.map(reg => ({
      ...reg,
      selectedDate: reg.selectedDate ? reg.selectedDate.toISOString().split('T')[0] : null,
      formattedDate: reg.selectedDate ? reg.selectedDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : null,
      shortDate: reg.selectedDate ? reg.selectedDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) : null,
      batchTime: extractBatchTime(reg.selectedBatch),
      createdAt: reg.createdAt,
      updatedAt: reg.updatedAt
    }));
    
    const totalPages = Math.ceil(total / parseInt(limit));
    
    console.log(`✅ Found ${total} registrations, returning ${formattedRegistrations.length}`);
    
    res.json({
      success: true,
      data: formattedRegistrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: total,
        itemsPerPage: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Get all registrations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 15. GET REGISTRATION BY ID (expanded)
exports.getRegistrationById = async (req, res) => {
  try {
    const { registrationId } = req.params;
    console.log(`🔍 Getting detailed registration: ${registrationId}`);
    
    const registration = await SpecialCourse.findOne({ registrationId })
      .select('-__v -ip_address -user_agent -source')
      .lean();
    
    if (!registration) {
      console.log(`❌ Registration not found: ${registrationId}`);
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }
    
    // Get payment details if exists
    const payment = await SpecialCoursePayment.findOne({ registrationId });
    
    const formattedRegistration = {
      ...registration,
      selectedDate: registration.selectedDate ? registration.selectedDate.toISOString().split('T')[0] : null,
      formattedDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : null,
      shortDate: registration.selectedDate ? registration.selectedDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }) : null,
      batchTime: extractBatchTime(registration.selectedBatch),
      payment: payment ? {
        razorpay_payment_id: payment.razorpay_payment_id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        method: payment.method,
        bank: payment.bank,
        wallet: payment.wallet,
        vpa: payment.vpa,
        created_at: payment.created_at
      } : null
    };
    
    console.log(`✅ Returning detailed registration: ${registrationId}`);
    
    res.json({
      success: true,
      data: formattedRegistration
    });
    
  } catch (error) {
    console.error('❌ Get registration by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration details'
    });
  }
};

// Export helper functions for testing
exports.cleanupExpiredRegistrations = cleanupExpiredRegistrations;
exports.checkSlotAvailability = checkSlotAvailability;