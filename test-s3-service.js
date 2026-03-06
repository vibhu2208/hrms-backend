#!/usr/bin/env node

require('dotenv').config();
const awsS3Service = require('./src/services/awsS3Service');
const fs = require('fs');
const path = require('path');

async function testS3Service() {
  console.log('🧪 Testing AWS S3 Service...\n');

  try {
    // Test 1: Check S3 configuration
    console.log('1️⃣ Testing S3 Configuration:');
    console.log('   Region:', process.env.AWS_REGION);
    console.log('   Bucket:', process.env.AWS_S3_BUCKET);
    console.log('   Access Key:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set');
    console.log('   Secret Key:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set');

    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      console.log('❌ AWS credentials not configured. Skipping S3 tests.');
      return;
    }

    // Test 2: Create a test file
    console.log('\n2️⃣ Creating test file...');
    const testContent = 'This is a test resume file for S3 upload testing.\nCreated at: ' + new Date().toISOString();
    const testFilePath = path.join(__dirname, 'test-resume-s3.txt');

    fs.writeFileSync(testFilePath, testContent);
    console.log('✅ Test file created:', testFilePath);

    // Test 3: Upload to S3
    console.log('\n3️⃣ Uploading to S3...');
    const uploadResult = await awsS3Service.uploadResume(
      testFilePath,
      'test-resume-s3.txt',
      'text/plain'
    );

    console.log('✅ Upload successful!');
    console.log('   URL:', uploadResult.url);
    console.log('   Key:', uploadResult.key);
    console.log('   Bucket:', uploadResult.bucket);
    console.log('   Size:', uploadResult.size, 'bytes');

    // Test 4: Generate signed URL
    console.log('\n4️⃣ Testing signed URL generation...');
    const signedUrl = awsS3Service.generateSignedUrl(uploadResult.key);
    console.log('✅ Signed URL generated (expires in 1 hour)');

    // Test 5: Get file metadata
    console.log('\n5️⃣ Testing file metadata retrieval...');
    const metadata = await awsS3Service.getFileMetadata(uploadResult.key);
    console.log('✅ Metadata retrieved:');
    console.log('   Size:', metadata.size, 'bytes');
    console.log('   Last Modified:', metadata.lastModified);
    console.log('   Content Type:', metadata.contentType);

    // Test 6: List files in resumes folder
    console.log('\n6️⃣ Testing file listing...');
    const files = await awsS3Service.listFiles('resumes/');
    console.log(`✅ Found ${files.length} files in resumes folder`);

    // Clean up: Delete test file from S3
    console.log('\n7️⃣ Cleaning up test file from S3...');
    await awsS3Service.deleteFile(uploadResult.key);
    console.log('✅ Test file deleted from S3');

    // Clean up local test file
    fs.unlinkSync(testFilePath);
    console.log('✅ Local test file cleaned up');

    console.log('\n🎉 All S3 tests passed successfully!');

  } catch (error) {
    console.error('\n❌ S3 Test failed:', error.message);
    console.error('Stack:', error.stack);

    // Clean up on error
    try {
      if (fs.existsSync(path.join(__dirname, 'test-resume-s3.txt'))) {
        fs.unlinkSync(path.join(__dirname, 'test-resume-s3.txt'));
      }
    } catch (cleanupError) {
      console.warn('Failed to clean up test file:', cleanupError.message);
    }
  }
}

testS3Service();