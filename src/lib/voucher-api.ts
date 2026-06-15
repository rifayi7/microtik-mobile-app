/**
 * API Endpoints Documentation for Recharge System
 * 
 * These endpoints need to be implemented in your Next.js backend to support
 * the recharge functionality in the mobile app.
 */

/**
 * GET /api/mikrotik/vouchers
 * Fetches available voucher codes and hotspot profiles for the connected router
 * 
 * Response:
 * {
 *   vouchers: [
 *     {
 *       id: string,              // Unique ID for the voucher
 *       code: string,            // The actual voucher code (e.g., "ABC123XYZ")
 *       validity: number,        // Validity in days (7, 15, 30, 60)
 *       profile: string,         // Associated Hotspot profile name
 *       status: "available" | "used" | "expired",
 *       createdAt: string,       // ISO timestamp
 *       usedAt?: string          // ISO timestamp when voucher was used (optional)
 *     }
 *   ],
 *   profiles: [
 *     {
 *       name: string,            // Profile name on Mikrotik (e.g., "7days", "30days")
 *       validity: number,        // Validity in days
 *       price?: number,          // Price (optional)
 *       bandwidth?: string       // Bandwidth limit (optional)
 *     }
 *   ],
 *   currency: string             // Currency code from router config (e.g., "AED")
 * }
 */

/**
 * POST /api/mikrotik/vouchers/redeem
 * Redeems a voucher code for a user
 * 
 * Request Body:
 * {
 *   voucherId: string,           // Voucher ID to redeem
 *   mobileNumber: string         // Mobile number of the user
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   message?: string,
 *   transactionId?: string       // Reference ID for the transaction
 * }
 */

/**
 * Implementation Notes:
 * 
 * 1. Voucher codes should be stored in a database with:
 *    - Unique code string
 *    - Associated validity period (days)
 *    - Profile reference
 *    - Status (available/used/expired)
 *    - Creation and usage timestamps
 * 
 * 2. When redeeming a voucher:
 *    - Verify the voucher is available and not expired
 *    - Create a Mikrotik hotspot user with:
 *      * Username: based on mobile number (e.g., last 10 digits)
 *      * Password: auto-generated or from voucher
 *      * Profile: the associated profile (validity period)
 *      * Comment: store mobile number for reference
 *    - Mark voucher as used
 *    - Store transaction details
 * 
 * 3. Code generation strategy:
 *    - Generate codes in batches with specific validity periods
 *    - Store in database linked to profiles
 *    - Fetch available codes grouped by validity
 */

export const API_ENDPOINTS = {
  FETCH_VOUCHERS: "/api/mikrotik/vouchers",
  REDEEM_VOUCHER: "/api/mikrotik/vouchers/redeem",
} as const;
