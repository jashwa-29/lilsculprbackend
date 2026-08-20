const Workshop = require('../models/Workshop.model');
const fs = require('fs');
const path = require('path');
const {
  generateAndUpload,
  deleteWorkshopFiles,
  registerConfig
} = require('../services/workshopPageGenerator.service');
const workshopRuntimeConfig = require('../services/workshopRuntimeConfig.service');

exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    const workshops = await Workshop.find(filter).sort({ date: 1 });
    res.json({ success: true, data: workshops });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getActive = async (req, res) => {
  try {
    const workshops = await Workshop.find({ status: 'active' }).sort({ date: 1 });
    res.json({ success: true, data: workshops });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getById = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });
    res.json({ success: true, data: workshop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    // Build an absolute URL so the public site can load it directly.
    // In local dev the request host is used (so previews work), while on the
    // live server the public base URL guarantees an https address.
    const host = req.get('host') || '';
    const isLocal = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
    const baseUrl = !isLocal && process.env.PUBLIC_BASE_URL
      ? process.env.PUBLIC_BASE_URL
      : `${req.protocol}://${host}`;
    const imageUrl = `${baseUrl}/uploads/workshops/${req.file.filename}`;

    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const workshop = await Workshop.create(req.body);

    // Register runtime config so special-course payments use the correct fee/capacity
    registerConfig(workshop);

    // Generate the HTML registration page + JS file and upload to the live site via FTP
    const pageResult = await generateAndUpload(workshop);

    // Save the generated page URL back on the workshop record
    if (pageResult.htmlFileName && !workshop.registrationPageUrl) {
      workshop.registrationPageUrl = pageResult.htmlFileName;
      await workshop.save();
    }

    res.status(201).json({ success: true, data: workshop, pageGeneration: pageResult });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const workshop = await Workshop.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });

    // The registration page name is derived from the slug unless one is given
    if (!req.body.registrationPageUrl) {
      workshop.registrationPageUrl = '';
    }

    // Re-register config and regenerate pages on every update
    registerConfig(workshop);
    const pageResult = await generateAndUpload(workshop);

    // Save the generated page URL back on the workshop record
    if (pageResult.htmlFileName && workshop.registrationPageUrl !== pageResult.htmlFileName) {
      workshop.registrationPageUrl = pageResult.htmlFileName;
      await workshop.save();
    }

    res.json({ success: true, data: workshop, pageGeneration: pageResult });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const workshop = await Workshop.findByIdAndDelete(req.params.id);
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });

    // Remove runtime config so payments stop for this workshop
    workshopRuntimeConfig.unregister(workshop.name);

    // Delete the generated HTML + JS files from the live site via FTP
    const deleteResult = await deleteWorkshopFiles(workshop);

    // Delete the uploaded workshop image from the backend's uploads folder
    try {
      if (workshop.image) {
        const m = String(workshop.image).match(/\/uploads\/([^?#]+)/);
        if (m) {
          const localFile = path.join(__dirname, '..', 'uploads', m[1]);
          const resolved = path.resolve(localFile);
          const uploadsRoot = path.resolve(__dirname, '..', 'uploads');
          if (resolved.startsWith(uploadsRoot + path.sep) && fs.existsSync(resolved)) {
            fs.unlinkSync(resolved);
            console.log(`🗑️ Removed workshop image: ${resolved}`);
          }
        }
      }
    } catch (imgErr) {
      console.warn('⚠️ Could not delete workshop image:', imgErr.message);
    }

    res.json({ success: true, message: 'Workshop deleted', ftpDelete: deleteResult });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};