const bcrypt = require('bcryptjs');

const debugBcrypt = async () => {
  try {
    const password = 'admin123';
    console.log('🔍 Testing bcrypt directly...');
    console.log('📝 Password:', password);

    // Test 1: Create hash and compare immediately
    console.log('\n📋 Test 1: Fresh hash and compare');
    const salt1 = await bcrypt.genSalt(10);
    const hash1 = await bcrypt.hash(password, salt1);
    const match1 = await bcrypt.compare(password, hash1);
    console.log('🔑 Hash:', hash1);
    console.log('🔐 Match:', match1);

    // Test 2: Different salt rounds
    console.log('\n📋 Test 2: Different salt rounds');
    const salt2 = await bcrypt.genSalt(12);
    const hash2 = await bcrypt.hash(password, salt2);
    const match2 = await bcrypt.compare(password, hash2);
    console.log('🔑 Hash (12 rounds):', hash2);
    console.log('🔐 Match (12 rounds):', match2);

    // Test 3: Synchronous version
    console.log('\n📋 Test 3: Synchronous bcrypt');
    const saltSync = bcrypt.genSaltSync(10);
    const hashSync = bcrypt.hashSync(password, saltSync);
    const matchSync = bcrypt.compareSync(password, hashSync);
    console.log('🔑 Hash (sync):', hashSync);
    console.log('🔐 Match (sync):', matchSync);

    // Test 4: Test with known good hash
    console.log('\n📋 Test 4: Known good hash test');
    const knownHash = '$2a$10$N9qo8uLOickgx2ZMRZoMye.IjPeVXe/8YTwmzWqwJkxdlSUDOTXSu'; // hash for 'secret'
    const knownMatch = await bcrypt.compare('secret', knownHash);
    console.log('🔐 Known hash match:', knownMatch);

    // Test 5: Test our specific case
    console.log('\n📋 Test 5: Our specific password');
    const ourMatch = await bcrypt.compare('admin123', '$2a$10$BD2Y0TExUcRshxctr1/W4O4YmJR6wyCV/8I3.tqgyGYx6jVIDbRQC');
    console.log('🔐 Our hash match:', ourMatch);

  } catch (error) {
    console.error('❌ Error:', error);
  }
};

debugBcrypt();
