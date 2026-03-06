#!/usr/bin/env node

require('dotenv').config();
const AWS = require('aws-sdk');

// Test AWS Credentials
async function testAWSCredentials() {
  console.log('🔍 Testing AWS Credentials...\n');

  // Check environment variables
  console.log('📋 Environment Variables:');
  console.log('   AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set');
  console.log('   AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set');
  console.log('   AWS_REGION:', process.env.AWS_REGION || 'us-east-1');
  console.log('   AWS_S3_BUCKET:', process.env.AWS_S3_BUCKET || 'not-set');

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('\n❌ AWS credentials not configured in environment variables.');
    console.log('   Make sure to set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file.');
    return;
  }

  // Configure AWS
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'ap-south-1'
  });

  const s3 = new AWS.S3();

  try {
    console.log('\n🔄 Testing S3 connection...');

    // Test 1: List buckets (requires ListAllMyBuckets permission)
    console.log('   Testing bucket listing...');
    const buckets = await s3.listBuckets().promise();
    console.log('✅ Successfully connected to AWS S3');
    console.log('   Found', buckets.Buckets?.length || 0, 'buckets');

    // List available buckets
    if (buckets.Buckets && buckets.Buckets.length > 0) {
      console.log('   Available buckets:');
      buckets.Buckets.forEach(bucket => {
        console.log('     -', bucket.Name);
      });
    }

    // Test 2: Check if our bucket exists
    const bucketName = process.env.AWS_S3_BUCKET || 'spc-resumes';
    console.log('\n   Testing bucket access:', bucketName);

    try {
      await s3.headBucket({ Bucket: bucketName }).promise();
      console.log('✅ Bucket exists and is accessible:', bucketName);

      // Test 3: Try to list objects in the bucket
      console.log('   Testing object listing in bucket...');
      const objects = await s3.listObjectsV2({ Bucket: bucketName, MaxKeys: 5 }).promise();
      console.log('✅ Can list objects in bucket');
      console.log('   Found', objects.Contents?.length || 0, 'objects');

    } catch (bucketError) {
      console.log('❌ Bucket access failed:', bucketError.message);
      console.log('   This could mean:');
      console.log('   - Bucket does not exist');
      console.log('   - No permission to access the bucket');
      console.log('   - Bucket is in a different region');
    }

  } catch (error) {
    console.log('\n❌ AWS connection failed:', error.message);
    console.log('\n🔧 Troubleshooting:');

    if (error.code === 'InvalidAccessKeyId') {
      console.log('   ❌ Invalid Access Key ID');
      console.log('   - Check if the AWS_ACCESS_KEY_ID is correct');
      console.log('   - Verify the key exists in your AWS account');
      console.log('   - Make sure you copied the key correctly (no extra spaces)');
    } else if (error.code === 'SignatureDoesNotMatch') {
      console.log('   ❌ Invalid Secret Access Key');
      console.log('   - Check if the AWS_SECRET_ACCESS_KEY is correct');
      console.log('   - Make sure you copied the secret key correctly');
    } else if (error.code === 'AccessDenied') {
      console.log('   ❌ Access Denied');
      console.log('   - Your IAM user/role may not have S3 permissions');
      console.log('   - Check IAM policies for s3:* permissions');
    } else {
      console.log('   ❓ Unknown error - check AWS documentation for error code:', error.code);
    }

    console.log('\n📝 AWS IAM Policy needed for S3 access:');
    console.log(`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::${bucketName}",
        "arn:aws:s3:::${bucketName}/*"
      ]
    }
  ]
}`);
  }
}

testAWSCredentials();