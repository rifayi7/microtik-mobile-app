// BACKEND IMPLEMENTATION GUIDE FOR RECHARGE SYSTEM

/**
 * FILE: pages/api/mikrotik/vouchers.ts
 * 
 * This endpoint fetches available vouchers and profiles
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { router } = req.body;
  
  try {
    // 1. Fetch available vouchers from your database
    // Group by validity period
    const vouchers = await db.vouchers.find({
      status: 'available',
      routerId: router.id
    });

    // 2. Fetch hotspot profiles from Mikrotik
    const profiles = await getMikrotikProfiles(router);

    // 3. Return response
    return res.status(200).json({
      vouchers: vouchers.map(v => ({
        id: v._id.toString(),
        code: v.code,
        validity: v.validity, // 7, 15, 30, or 60
        profile: v.profile,
        status: v.status,
        createdAt: v.createdAt,
        usedAt: v.usedAt
      })),
      profiles: profiles.map(p => ({
        name: p.name,
        validity: extractDays(p.name), // extract from profile name
        price: p.price,
        bandwidth: p.bandwidth
      })),
      currency: router.currency || 'AED'
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * FILE: pages/api/mikrotik/vouchers/redeem.ts
 * 
 * This endpoint redeems a voucher and creates a hotspot user
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { router, voucherId, mobileNumber } = req.body;
  
  try {
    // 1. Find voucher in database
    const voucher = await db.vouchers.findById(voucherId);
    
    if (!voucher) {
      return res.status(404).json({ error: 'Voucher not found' });
    }
    
    if (voucher.status !== 'available') {
      return res.status(400).json({ error: 'Voucher is not available' });
    }

    // 2. Create Mikrotik hotspot user
    // Username: use last 10 digits of mobile number
    const username = mobileNumber.slice(-10);
    const password = voucher.code; // or generate random password
    
    const mikrotikUser = await createMikrotikUser({
      router,
      username,
      password,
      profile: voucher.profile,
      comment: `Mobile: ${mobileNumber}` // Store mobile in comment
    });

    // 3. Mark voucher as used
    await db.vouchers.updateOne(
      { _id: voucherId },
      { 
        status: 'used',
        usedAt: new Date(),
        usedByMobile: mobileNumber,
        usedByMikrotikUser: username
      }
    );

    // 4. Store transaction record
    const transaction = await db.transactions.create({
      voucherId: voucherId,
      mobileNumber: mobileNumber,
      mikrotikUsername: username,
      routerId: router.id,
      validity: voucher.validity,
      code: voucher.code,
      timestamp: new Date()
    });

    return res.status(200).json({
      success: true,
      message: 'Recharge successful',
      transactionId: transaction._id.toString()
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * DATABASE SCHEMA
 */

// Vouchers Collection
db.createCollection('vouchers', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['code', 'validity', 'profile', 'status', 'createdAt'],
      properties: {
        _id: { bsonType: 'objectId' },
        code: { bsonType: 'string', description: 'Voucher code' },
        validity: { 
          bsonType: 'int',
          enum: [7, 15, 30, 60],
          description: 'Validity in days'
        },
        profile: { 
          bsonType: 'string', 
          description: 'Mikrotik profile name' 
        },
        routerId: { 
          bsonType: 'string',
          description: 'Router ID this voucher belongs to'
        },
        status: {
          bsonType: 'string',
          enum: ['available', 'used', 'expired'],
          description: 'Voucher status'
        },
        createdAt: { bsonType: 'date' },
        usedAt: { bsonType: 'date', description: 'When voucher was redeemed' },
        usedByMobile: { bsonType: 'string', description: 'Mobile that used this' },
        usedByMikrotikUser: { bsonType: 'string', description: 'Mikrotik user created' }
      }
    }
  }
});

// Transactions Collection
db.createCollection('transactions', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['voucherId', 'mobileNumber', 'timestamp'],
      properties: {
        _id: { bsonType: 'objectId' },
        voucherId: { bsonType: 'objectId' },
        mobileNumber: { bsonType: 'string' },
        mikrotikUsername: { bsonType: 'string' },
        routerId: { bsonType: 'string' },
        validity: { bsonType: 'int' },
        code: { bsonType: 'string' },
        timestamp: { bsonType: 'date' }
      }
    }
  }
});

/**
 * HELPER FUNCTIONS
 */

async function getMikrotikProfiles(router) {
  // Connect to Mikrotik and fetch hotspot profiles
  // Returns: [{ name: '7days', price: 20 }, ...]
  // Implementation depends on your Mikrotik connection library
}

async function createMikrotikUser(options) {
  const { router, username, password, profile, comment } = options;
  
  // Connect to Mikrotik and create hotspot user
  // Set profile to the validity period
  // Store mobile number in comment field
  // Implementation depends on your Mikrotik connection library
}

function extractDays(profileName) {
  // Extract days from profile name
  // E.g., "7days" -> 7, "30days" -> 30
  const match = profileName.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

/**
 * VOUCHER GENERATION SCRIPT
 */

// scripts/generate-vouchers.js
// Run this to generate vouchers in batches

async function generateVouchers() {
  const PLANS = [
    { days: 7, count: 100 },
    { days: 15, count: 50 },
    { days: 30, count: 50 },
    { days: 60, count: 25 }
  ];

  for (const plan of PLANS) {
    for (let i = 0; i < plan.count; i++) {
      const code = generateRandomCode(); // ABC123XYZ format
      
      await db.vouchers.create({
        code,
        validity: plan.days,
        profile: `${plan.days}days`, // Must match Mikrotik profile
        status: 'available',
        createdAt: new Date()
      });
    }
  }
  
  console.log('Vouchers generated successfully');
}

function generateRandomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Run: node scripts/generate-vouchers.js
