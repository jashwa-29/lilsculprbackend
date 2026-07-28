const Workshop = require('../models/Workshop.model');

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

exports.create = async (req, res) => {
  try {
    const workshop = await Workshop.create(req.body);
    res.status(201).json({ success: true, data: workshop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.update = async (req, res) => {
  try {
    const workshop = await Workshop.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });
    res.json({ success: true, data: workshop });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    const workshop = await Workshop.findByIdAndDelete(req.params.id);
    if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });
    res.json({ success: true, message: 'Workshop deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};