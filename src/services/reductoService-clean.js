const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Reducto Resume Parsing Service
 * Integrates with Reducto API to extract structured candidate data from resumes
 */
class ReductoService {
  constructor() {
    this.apiKey = process.env.REDUCTO_API_KEY;
    this.baseUrl = process.env.REDUCTO_API_URL || 'https://platform.reducto.ai/extract';
    this.maxRetries = parseInt(process.env.REDUCTO_MAX_RETRIES) || 3;
    this.timeout = parseInt(process.env.REDUCTO_TIMEOUT) || 120000; // 2 minutes
    this.retryDelay = parseInt(process.env.REDUCTO_RETRY_DELAY) || 2000; // 2 seconds
    this.maxFileSize = parseInt(process.env.REDUCTO_MAX_FILE_SIZE) || 10 * 1024 * 1024; // 10MB
    this.supportedFormats = ['.pdf', '.docx', '.doc'];

    // Performance optimization settings
    this.enableCache = process.env.REDUCTO_ENABLE_CACHE !== 'false'; // Default true
    this.cacheTtl = parseInt(process.env.REDUCTO_CACHE_TTL) || 3600000; // 1 hour
    this.maxConcurrentRequests = parseInt(process.env.REDUCTO_MAX_CONCURRENT) || 5; // Max concurrent requests
    this.enableBatchProcessing = process.env.REDUCTO_ENABLE_BATCH !== 'false'; // Default true
    this.batchSize = parseInt(process.env.REDUCTO_BATCH_SIZE) || 10; // Max files per batch

    // Initialize caches and metrics
    this.cache = new Map(); // Simple in-memory cache
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      averageProcessingTime: 0,
      lastReset: Date.now()
    };

    // Request queue for rate limiting
    this.requestQueue = [];
    this.activeRequests = 0;

    // Initialize axios instance with optimized config
    this.axiosInstance = axios.create({
      timeout: this.timeout,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      headers: {
        'User-Agent': 'HRMS-Reduction-Parser/2.0',
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      // Connection pooling settings
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: this.timeout,
      keepAlive: true,
      keepAliveMsecs: 1000
    });

    // Start cache cleanup interval
    if (this.enableCache) {
      setInterval(() => this.cleanupCache(), 300000); // Clean every 5 minutes
    }

    // Start metrics reset interval (daily)
    setInterval(() => this.resetMetrics(), 86400000); // Reset daily
  }

  // ... rest of the ReductoService implementation will be added here

  /**
   * Extract candidate data from resume file with caching
   * @param {string} filePath - Path to resume file
   * @returns {Promise<Object>} - Complete extraction result
   */
  async extractCandidateData(filePath) {
    // Use cached version for better performance
    const result = await this.parseResumeCached(filePath);

    if (result.success && result.data) {
      // Data is already normalized in parseResume, but ensure it's still valid
      if (!result.data || Object.keys(result.data).length === 0) {
        console.warn('⚠️ Reducto returned empty data object');
        console.log('Raw result:', JSON.stringify(result, null, 2));
      }
      return result;
    }

    // If Reducto API fails, return error (no local fallback)
    console.log('❌ Reducto API failed - no fallback available');

    return {
      success: false,
      error: result.error || 'Reducto API extraction failed',
      data: {
        firstName: null,
        lastName: null,
        email: null,
        phone: null,
        appliedFor: null,
        currentLocation: null,
        preferredLocation: [],
        source: 'other',
        experienceYears: null,
        experienceMonths: null,
        currentCompany: null,
        currentDesignation: null,
        currentCTC: null,
        expectedCTC: null,
        noticePeriod: null,
        skills: [],
        stage: null,
        notes: `Resume uploaded but Reducto API parsing failed: ${result.error}. Please fill in the candidate details manually.`
      },
      rawText: 'Resume file received but could not be parsed by Reducto API.',
      confidence: {},
      metadata: {
        parsedAt: new Date(),
        version: '2.0',
        source: 'reducto',
        error: result.error,
        message: 'Reducto API failed - manual entry required',
        cached: false
      }
    };
  }
}

module.exports = new ReductoService();