// CONFIGURATION & INTEGRATION EXAMPLES

/**
 * HOW TO INTEGRATE THE BACKEND ENDPOINTS
 */

// Example 1: Using Node.js with Next.js API Routes

// pages/api/mikrotik/vouchers.ts
import { connectDB } from '@/lib/db';
import { getMikrotikProfiles } from '@/lib/mikrotik';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { router } = req.body;
  
  try {
    await connectDB();
    
    const vouchers = await db.collection('vouchers').find({
      status: 'available',
      routerId: router.id
    }).toArray();

    const profiles = await getMikrotikProfiles(router);

    res.json({
      vouchers: vouchers.map(v => ({
        id: v._id.toString(),
        code: v.code,
        validity: v.validity,
        profile: v.profile,
        status: v.status,
        createdAt: v.createdAt,
      })),
      profiles,
      currency: router.currency || 'AED'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// pages/api/mikrotik/vouchers/redeem.ts
import { connectDB } from '@/lib/db';
import { createMikrotikUser } from '@/lib/mikrotik';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { router, voucherId, mobileNumber } = req.body;
  
  try {
    await connectDB();
    
    // Find voucher
    const voucher = await db.collection('vouchers').findOne({
      _id: new ObjectId(voucherId)
    });

    if (!voucher || voucher.status !== 'available') {
      return res.status(400).json({ error: 'Voucher not available' });
    }

    // Create Mikrotik user
    const username = mobileNumber.slice(-10);
    await createMikrotikUser({
      router,
      username,
      password: voucher.code,
      profile: voucher.profile,
      comment: `Mobile: ${mobileNumber}`
    });

    // Mark as used
    await db.collection('vouchers').updateOne(
      { _id: new ObjectId(voucherId) },
      {
        $set: {
          status: 'used',
          usedAt: new Date(),
          usedByMobile: mobileNumber,
          usedByMikrotikUser: username
        }
      }
    );

    // Log transaction
    await db.collection('transactions').insertOne({
      voucherId: new ObjectId(voucherId),
      mobileNumber,
      mikrotikUsername: username,
      routerId: router.id,
      validity: voucher.validity,
      code: voucher.code,
      timestamp: new Date()
    });

    res.json({ success: true, message: 'Recharge successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * EXAMPLE 2: Using Express.js with MongoDB
 */

import express from 'express';
import { Voucher, Transaction } from '@/models';
import { createMikrotikUser } from '@/lib/mikrotik';

const router = express.Router();

// GET /api/vouchers
router.post('/api/mikrotik/vouchers', async (req, res) => {
  try {
    const { router: routerConfig } = req.body;
    
    const vouchers = await Voucher.find({
      status: 'available',
      routerId: routerConfig.id
    }).lean();

    res.json({
      vouchers,
      currency: routerConfig.currency || 'AED'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/vouchers/redeem
router.post('/api/mikrotik/vouchers/redeem', async (req, res) => {
  try {
    const { router: routerConfig, voucherId, mobileNumber } = req.body;

    const voucher = await Voucher.findById(voucherId);
    if (!voucher || voucher.status !== 'available') {
      return res.status(400).json({ error: 'Voucher unavailable' });
    }

    const username = mobileNumber.slice(-10);
    
    // Create Mikrotik user
    await createMikrotikUser({
      router: routerConfig,
      username,
      password: voucher.code,
      profile: voucher.profile,
      comment: `Mobile: ${mobileNumber}`
    });

    // Update voucher
    voucher.status = 'used';
    voucher.usedAt = new Date();
    voucher.usedByMobile = mobileNumber;
    await voucher.save();

    // Create transaction
    await Transaction.create({
      voucherId,
      mobileNumber,
      mikrotikUsername: username,
      validity: voucher.validity,
      code: voucher.code
    });

    res.json({ success: true, message: 'Recharge successful' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

/**
 * MONGOOSE MODELS
 */

import mongoose from 'mongoose';

const VoucherSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  validity: { type: Number, enum: [7, 15, 30, 60], required: true },
  profile: { type: String, required: true },
  routerId: String,
  status: { 
    type: String, 
    enum: ['available', 'used', 'expired'],
    default: 'available'
  },
  createdAt: { type: Date, default: Date.now },
  usedAt: Date,
  usedByMobile: String,
  usedByMikrotikUser: String
});

const TransactionSchema = new mongoose.Schema({
  voucherId: mongoose.Schema.Types.ObjectId,
  mobileNumber: { type: String, required: true },
  mikrotikUsername: String,
  routerId: String,
  validity: Number,
  code: String,
  timestamp: { type: Date, default: Date.now }
});

export const Voucher = mongoose.model('Voucher', VoucherSchema);
export const Transaction = mongoose.model('Transaction', TransactionSchema);

/**
 * ENVIRONMENT VARIABLES NEEDED
 */

// .env.local
NEXT_PUBLIC_GATEWAY_URL=http://localhost:3000
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/database
MIKROTIK_API_KEY=your_api_key_here

/**
 * TESTING THE ENDPOINTS WITH CURL
 */

// Test 1: Fetch vouchers
curl -X POST http://localhost:3000/api/mikrotik/vouchers \
  -H "Content-Type: application/json" \
  -d '{
    "router": {
      "id": "router-123",
      "host": "192.168.88.1",
      "port": 8728,
      "username": "admin",
      "password": "password",
      "useTls": false
    }
  }'

// Test 2: Redeem voucher
curl -X POST http://localhost:3000/api/mikrotik/vouchers/redeem \
  -H "Content-Type: application/json" \
  -d '{
    "router": {
      "id": "router-123",
      "host": "192.168.88.1",
      "port": 8728,
      "username": "admin",
      "password": "password",
      "useTls": false
    },
    "voucherId": "507f1f77bcf86cd799439011",
    "mobileNumber": "05012345678"
  }'

/**
 * VOUCHER GENERATION - BULK SCRIPT
 */

// scripts/generate-vouchers.js
import mongoose from 'mongoose';
import { Voucher } from '@/models';

const VALIDITY_PERIODS = [
  { days: 7, count: 100 },
  { days: 15, count: 100 },
  { days: 30, count: 100 },
  { days: 60, count: 50 }
];

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 9; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function generateVouchers() {
  await mongoose.connect(process.env.MONGODB_URI);

  for (const plan of VALIDITY_PERIODS) {
    const vouchers = [];
    
    for (let i = 0; i < plan.count; i++) {
      vouchers.push({
        code: generateCode(),
        validity: plan.days,
        profile: `${plan.days}days`,
        status: 'available',
        createdAt: new Date()
      });
    }

    await Voucher.insertMany(vouchers);
    console.log(`Generated ${plan.count} vouchers for ${plan.days} days`);
  }

  console.log('✅ Voucher generation complete!');
  process.exit(0);
}

generateVouchers().catch(err => {
  console.error(err);
  process.exit(1);
});

// Run: node scripts/generate-vouchers.js
