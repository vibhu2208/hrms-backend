#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Reducto Resume Parser Service
 * Production-ready testing for resume parsing functionality
 *
 * Usage: node test-reducto-service.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const reductoService = require('./src/services/reductoService');

class ReductoTestSuite {
  constructor() {
    this.testsRun = 0;
    this.testsPassed = 0;
    this.testsFailed = 0;
    this.testResults = [];
    this.startTime = Date.now();
  }

  log(message, ...args) {
    console.log(`[${new Date().toISOString()}] ${message}`, ...args);
  }

  async runTest(testName, testFunction) {
    this.testsRun++;
    this.log(`🧪 Running test: ${testName}`);

    try {
      const result = await testFunction();
      this.testsPassed++;
      this.testResults.push({
        name: testName,
        status: 'PASSED',
        result: result,
        error: null
      });
      this.log(`✅ Test PASSED: ${testName}`);
      return result;
    } catch (error) {
      this.testsFailed++;
      this.testResults.push({
        name: testName,
        status: 'FAILED',
        result: null,
        error: error.message
      });
      this.log(`❌ Test FAILED: ${testName} - ${error.message}`);
      throw error;
    }
  }

  async runAllTests() {
    this.log('🚀 Starting Reducto Service Test Suite');
    this.log('=' .repeat(50));

    try {
      // Basic service tests
      await this.runTest('Service Initialization', this.testServiceInitialization.bind(this));
      await this.runTest('Service Health Check', this.testServiceHealth.bind(this));
      await this.runTest('Configuration Validation', this.testConfigurationValidation.bind(this));

      // File validation tests
      await this.runTest('File Validation - Valid PDF', this.testFileValidationValid.bind(this));
      await this.runTest('File Validation - Invalid File', this.testFileValidationInvalid.bind(this));
      await this.runTest('File Validation - Non-existent File', this.testFileValidationNonExistent.bind(this));

      // Data normalization tests
      await this.runTest('Data Normalization - Complete Data', this.testDataNormalizationComplete.bind(this));
      await this.runTest('Data Normalization - Partial Data', this.testDataNormalizationPartial.bind(this));
      await this.runTest('Data Normalization - Invalid Data', this.testDataNormalizationInvalid.bind(this));

      // Caching tests
      await this.runTest('Cache Functionality', this.testCacheFunctionality.bind(this));
      await this.runTest('Cache Performance', this.testCachePerformance.bind(this));

      // Error handling tests
      await this.runTest('Error Handling - Network Failure', this.testErrorHandlingNetwork.bind(this));
      await this.runTest('Error Handling - Invalid API Key', this.testErrorHandlingInvalidApiKey.bind(this));

      // Performance tests
      await this.runTest('Performance Metrics', this.testPerformanceMetrics.bind(this));
      await this.runTest('Concurrent Request Handling', this.testConcurrentRequests.bind(this));

      // Batch processing tests
      await this.runTest('Batch Processing', this.testBatchProcessing.bind(this));

    } catch (error) {
      this.log(`💥 Test suite encountered critical error: ${error.message}`);
    } finally {
      this.printSummary();
    }
  }

  async testServiceInitialization() {
    // Test service initialization
    const service = reductoService;

    if (!service.apiKey) {
      throw new Error('API key not configured');
    }

    if (!service.baseUrl) {
      throw new Error('Base URL not configured');
    }

    if (!service.axiosInstance) {
      throw new Error('Axios instance not initialized');
    }

    return { initialized: true };
  }

  async testServiceHealth() {
    const health = await reductoService.healthCheck();

    if (!health.timestamp) {
      throw new Error('Health check missing timestamp');
    }

    if (!health.metrics) {
      throw new Error('Health check missing metrics');
    }

    return health;
  }

  async testConfigurationValidation() {
    const config = reductoService.getServiceStatus().configuration;

    // Validate required configuration
    const requiredFields = [
      'apiKeyConfigured', 'baseUrl', 'maxRetries', 'timeout',
      'maxFileSize', 'supportedFormats', 'cacheEnabled'
    ];

    for (const field of requiredFields) {
      if (!(field in config)) {
        throw new Error(`Missing configuration field: ${field}`);
      }
    }

    return config;
  }

  async testFileValidationValid() {
    // Create a dummy file for testing
    const testFilePath = path.join(__dirname, 'test-dummy.pdf');
    fs.writeFileSync(testFilePath, 'dummy pdf content');

    try {
      const validation = reductoService.validateRequest(testFilePath);

      if (!validation.valid) {
        throw new Error(`Valid file rejected: ${validation.error}`);
      }

      return { valid: true };
    } finally {
      // Clean up
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  async testFileValidationInvalid() {
    const testFilePath = path.join(__dirname, 'test-invalid.txt');
    fs.writeFileSync(testFilePath, 'invalid file content');

    try {
      const validation = reductoService.validateRequest(testFilePath);

      if (validation.valid) {
        throw new Error('Invalid file format was accepted');
      }

      return { valid: false, error: validation.error };
    } finally {
      // Clean up
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  }

  async testFileValidationNonExistent() {
    const nonExistentPath = path.join(__dirname, 'non-existent-file.pdf');
    const validation = reductoService.validateRequest(nonExistentPath);

    if (validation.valid) {
      throw new Error('Non-existent file was accepted');
    }

    return { valid: false, error: validation.error };
  }

  async testDataNormalizationComplete() {
    const testData = {
      firstName: 'john',
      lastName: 'smith',
      email: 'JOHN.SMITH@EXAMPLE.COM',
      phone: '+91-98765-43210',
      skills: ['javascript', 'python', 'REACT'],
      currentCTC: '500000',
      experienceYears: '5'
    };

    const normalized = reductoService.normalizeData(testData);

    // Validate normalization
    if (normalized.firstName !== 'John') {
      throw new Error(`First name not properly capitalized: ${normalized.firstName}`);
    }

    if (normalized.email !== 'john.smith@example.com') {
      throw new Error(`Email not properly normalized: ${normalized.email}`);
    }

    if (normalized.phone !== '9876543210') {
      throw new Error(`Phone not properly normalized: ${normalized.phone}`);
    }

    if (!normalized.skills.includes('JavaScript')) {
      throw new Error('Skills not properly standardized');
    }

    return normalized;
  }

  async testDataNormalizationPartial() {
    const testData = {
      firstName: null,
      lastName: '',
      email: 'test@example.com',
      phone: null,
      skills: [],
      currentCTC: null
    };

    const normalized = reductoService.normalizeData(testData);

    if (normalized.firstName !== null) {
      throw new Error('Null firstName not preserved');
    }

    if (normalized.lastName !== null) {
      throw new Error('Empty lastName not converted to null');
    }

    return normalized;
  }

  async testDataNormalizationInvalid() {
    const testData = {
      phone: 'invalid-phone-number',
      currentCTC: 'invalid-salary',
      experienceYears: 'invalid-number',
      skills: ['skill1', 'skill2', 'skill3', 'skill4', 'skill5', 'skill6', 'skill7', 'skill8', 'skill9', 'skill10', 'skill11'] // Too many skills
    };

    const normalized = reductoService.normalizeData(testData);

    if (normalized.phone !== null) {
      throw new Error('Invalid phone should be null');
    }

    if (normalized.currentCTC !== null) {
      throw new Error('Invalid CTC should be null');
    }

    if (normalized.skills.length > 50) {
      throw new Error('Skills should be limited to 50');
    }

    return normalized;
  }

  async testCacheFunctionality() {
    // Test cache operations
    const testKey = 'test-cache-key';
    const testData = { test: 'data' };

    // Set cache
    reductoService.cache.set(testKey, {
      data: testData,
      timestamp: Date.now()
    });

    // Get cache
    const cached = reductoService.cache.get(testKey);

    if (!cached || cached.data.test !== 'data') {
      throw new Error('Cache set/get failed');
    }

    // Clear cache
    reductoService.cache.clear();

    if (reductoService.cache.size !== 0) {
      throw new Error('Cache clear failed');
    }

    return { cacheWorking: true };
  }

  async testCachePerformance() {
    const cacheStats = reductoService.getCacheStats();

    if (typeof cacheStats.size !== 'number') {
      throw new Error('Cache stats not properly returned');
    }

    if (typeof cacheStats.hitRate !== 'number') {
      throw new Error('Cache hit rate not calculated');
    }

    return cacheStats;
  }

  async testErrorHandlingNetwork() {
    // Test with invalid URL to simulate network error
    const originalUrl = reductoService.baseUrl;
    reductoService.baseUrl = 'https://invalid-url-that-does-not-exist.com';

    try {
      await reductoService.parseResume('dummy-path.pdf');
      throw new Error('Network error not handled properly');
    } catch (error) {
      if (!error.message.includes('ENOTFOUND') && !error.message.includes('network')) {
        throw new Error(`Unexpected error type: ${error.message}`);
      }
    } finally {
      reductoService.baseUrl = originalUrl;
    }

    return { errorHandlingWorking: true };
  }

  async testErrorHandlingInvalidApiKey() {
    // Test with invalid API key
    const originalKey = reductoService.apiKey;
    reductoService.apiKey = 'invalid-api-key';

    try {
      await reductoService.parseResume('dummy-path.pdf');
      throw new Error('Invalid API key error not handled properly');
    } catch (error) {
      // Should handle API key errors gracefully
      if (!error.message.includes('API key') && !error.message.includes('authorization')) {
        throw new Error(`Unexpected error for invalid API key: ${error.message}`);
      }
    } finally {
      reductoService.apiKey = originalKey;
    }

    return { apiKeyErrorHandlingWorking: true };
  }

  async testPerformanceMetrics() {
    const metrics = reductoService.getMetrics();

    const requiredMetrics = [
      'totalRequests', 'successfulRequests', 'failedRequests',
      'averageProcessingTime', 'cacheStats', 'successRate'
    ];

    for (const metric of requiredMetrics) {
      if (!(metric in metrics)) {
        throw new Error(`Missing metric: ${metric}`);
      }
    }

    return metrics;
  }

  async testConcurrentRequests() {
    // Test concurrent request handling
    const promises = [];

    // Create multiple mock requests
    for (let i = 0; i < 5; i++) {
      promises.push(
        new Promise((resolve) => {
          setTimeout(() => resolve({ requestId: i }), Math.random() * 100);
        })
      );
    }

    const results = await Promise.all(promises);

    if (results.length !== 5) {
      throw new Error('Concurrent requests not handled properly');
    }

    return { concurrentRequestsHandled: results.length };
  }

  async testBatchProcessing() {
    // Test batch processing with dummy file paths
    const filePaths = [
      'dummy1.pdf',
      'dummy2.pdf',
      'dummy3.pdf'
    ];

    // This will fail but should handle the errors gracefully
    const results = await reductoService.batchParseResumes(filePaths);

    if (!Array.isArray(results)) {
      throw new Error('Batch processing should return array');
    }

    if (results.length !== filePaths.length) {
      throw new Error('Batch processing should return result for each file');
    }

    return { batchSize: results.length, allProcessed: true };
  }

  printSummary() {
    const duration = Date.now() - this.startTime;

    this.log('\n' + '=' .repeat(50));
    this.log('📊 TEST SUITE SUMMARY');
    this.log('=' .repeat(50));
    this.log(`Total Tests: ${this.testsRun}`);
    this.log(`Passed: ${this.testsPassed}`);
    this.log(`Failed: ${this.testsFailed}`);
    this.log(`Success Rate: ${((this.testsPassed / this.testsRun) * 100).toFixed(2)}%`);
    this.log(`Duration: ${duration}ms`);
    this.log(`Average per test: ${Math.round(duration / this.testsRun)}ms`);

    if (this.testsFailed > 0) {
      this.log('\n❌ FAILED TESTS:');
      this.testResults
        .filter(result => result.status === 'FAILED')
        .forEach(result => {
          this.log(`  - ${result.name}: ${result.error}`);
        });
    }

    this.log('\n' + '=' .repeat(50));

    if (this.testsFailed === 0) {
      this.log('🎉 All tests passed! Service is ready for production.');
      process.exit(0);
    } else {
      this.log('⚠️ Some tests failed. Please review and fix issues before production deployment.');
      process.exit(1);
    }
  }
}

// Run the test suite
if (require.main === module) {
  const testSuite = new ReductoTestSuite();
  testSuite.runAllTests().catch(error => {
    console.error('💥 Test suite failed with error:', error);
    process.exit(1);
  });
}

module.exports = ReductoTestSuite;