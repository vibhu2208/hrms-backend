const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { protect } = require('../middlewares/auth');

const uploadsRoot = path.resolve(__dirname, '../../uploads');

/**
 * Authenticated file download — replaces public express.static('/uploads').
 * Supports Authorization: Bearer or ?access_token= for browser <a>/<iframe>.
 */
router.get(/.*/, protect, (req, res) => {
  try {
    const relative = (req.path || '').replace(/^\/+/, '');
    if (!relative || relative.includes('\0')) {
      return res.status(400).json({ success: false, message: 'Invalid path' });
    }

    const resolved = path.resolve(uploadsRoot, relative);
    if (!resolved.startsWith(uploadsRoot + path.sep) && resolved !== uploadsRoot) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return res.status(404).json({ success: false, message: 'File not found' });
    }

    const normalized = relative.replace(/\\/g, '/').toLowerCase();
    if (normalized.startsWith('candidate-documents/')) {
      const role = req.user?.role;
      const allowed = ['admin', 'hr', 'company_admin', 'superadmin'].includes(role);
      if (!allowed) {
        return res.status(403).json({ success: false, message: 'Not authorized to access this document' });
      }
    }

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(resolved);
  } catch (error) {
    console.error('File serve error:', error.message);
    return res.status(500).json({ success: false, message: 'Failed to serve file' });
  }
});

module.exports = router;
