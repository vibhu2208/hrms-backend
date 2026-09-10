/**
 * Canonical public URL helpers — never hardcode production hosts.
 */
function getFrontendBaseUrl() {
  const url = (process.env.FRONTEND_URL || '').trim().replace(/\/$/, '');
  if (url) return url;
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.warn('⚠️  FRONTEND_URL is not set — email/login links may be wrong');
  }
  return 'http://localhost:5173';
}

function getBackendBaseUrl() {
  const url = (process.env.BACKEND_URL || process.env.API_BASE_URL || '').trim().replace(/\/$/, '');
  if (url) return url;
  if ((process.env.NODE_ENV || '').toLowerCase() === 'production') {
    console.warn('⚠️  BACKEND_URL is not set');
  }
  return `http://localhost:${process.env.PORT || 5000}`;
}

function buildUploadDocumentsUrl(token, tenantId) {
  const base = getFrontendBaseUrl();
  const q = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
  return `${base}/public/upload-documents/${token}${q}`;
}

module.exports = {
  getFrontendBaseUrl,
  getBackendBaseUrl,
  buildUploadDocumentsUrl
};
