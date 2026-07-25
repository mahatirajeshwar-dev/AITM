/**
 * SoMart — Demo Seed
 * ------------------
 * Adds 3 demonstration users (Mukund, Nichiketa, Shivani) and one listing
 * each, so the marketplace has realistic content for demos.
 *
 * SAFE TO RUN MULTIPLE TIMES — uses upsert / skip-if-exists logic.
 * Does NOT delete or modify any existing users or listings.
 *
 * Run:  node prisma/demo-seed.js
 *
 * To remove demo data later:
 *   node prisma/demo-seed.js --remove
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../server/lib/prisma.js';

const DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'bitsom.edu.in';
const DEMO_PASSWORD = 'Student@123';
const DEMO_TAG = '[demo]'; // marker stored in phone field to identify demo records

// Local product images stored in client/public/demo/
// Vite serves client/public at the root in dev; Express serves client/dist in production.
const IMAGES = {
  kettle:     ['/demo/kettle.png'],
  calculator: ['/demo/calculator.png'],
  chair:      ['/demo/office-chair.png'],
};

const DEMO_USERS = [
  { fullName: 'Mukund',    email: `mukund.2027@${DOMAIN}`,    batch: '2027' },
  { fullName: 'Nichiketa', email: `nichiketa.2027@${DOMAIN}`, batch: '2027' },
  { fullName: 'Shivani',   email: `shivani.2027@${DOMAIN}`,   batch: '2027' },
];

const DEMO_LISTINGS = [
  {
    sellerEmail: `mukund.2027@${DOMAIN}`,
    title:       'Electric Kettle',
    category:    'Kitchen Items',     // valid category in CATEGORIES list
    listingType: 'rent',
    rentalRate:  80,
    rentalUnit:  'week',
    securityDeposit: 200,
    minRentalPeriod: 1,
    maxRentalPeriod: 12,
    price:       null,
    condition:   'like_new',          // "Excellent" → like_new
    negotiable:  false,
    location:    'BITSoM Hostel',
    description: 'Barely used Philips electric kettle, 1.5L capacity. Ideal for hostel rooms — boils quickly and auto-shuts off. Available for weekly rental.',
    images:      IMAGES.kettle,
  },
  {
    sellerEmail: `nichiketa.2027@${DOMAIN}`,
    title:       'Scientific Calculator (Casio fx-991ES Plus)',
    category:    'Academic Supplies',
    listingType: 'sale',
    price:       650,
    rentalRate:  null,
    rentalUnit:  null,
    condition:   'good',
    negotiable:  true,
    location:    'BITSoM Campus',
    description: 'Fully functional Casio fx-991ES Plus. All modes working, lightly used over one term. Comes with the original slide-on protective cover.',
    images:      IMAGES.calculator,
  },
  {
    sellerEmail: `shivani.2027@${DOMAIN}`,
    title:       'Office Chair',
    category:    'Furniture',
    listingType: 'sale',
    price:       1800,
    rentalRate:  null,
    rentalUnit:  null,
    condition:   'like_new',          // "Very Good" → like_new
    negotiable:  false,
    location:    'BITSoM Residence',
    description: 'Ergonomic study chair in excellent condition. Adjustable height, padded seat, lumbar support. Ideal for long study sessions. Selling as I am moving out.',
    images:      IMAGES.chair,
  },
];

// ─── helpers ────────────────────────────────────────────────────────────────

async function upsertDemoUser({ fullName, email, batch }) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  ↪ User already exists: ${email}`);
    return existing;
  }
  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      passwordHash: bcrypt.hashSync(DEMO_PASSWORD, 10),
      emailVerified: true,
      batch,
      phone: DEMO_TAG, // use phone field as a marker so we can find demo users later
    },
  });
  console.log(`  ✔ Created user: ${email}`);
  return user;
}

async function upsertDemoListing(listingDef, users) {
  const seller = users.find(u => u.email === listingDef.sellerEmail);
  if (!seller) throw new Error(`Seller not found: ${listingDef.sellerEmail}`);

  // Check by title + sellerId to avoid duplicates on re-run
  const existing = await prisma.listing.findFirst({
    where: { sellerId: seller.id, title: listingDef.title },
  });
  if (existing) {
    console.log(`  ↪ Listing already exists: "${listingDef.title}"`);
    return existing;
  }

  const listing = await prisma.listing.create({
    data: {
      sellerId:        seller.id,
      title:           listingDef.title,
      description:     listingDef.description,
      category:        listingDef.category,
      listingType:     listingDef.listingType,
      price:           listingDef.price ?? null,
      rentalRate:      listingDef.rentalRate ?? null,
      rentalUnit:      listingDef.rentalUnit ?? null,
      securityDeposit: listingDef.securityDeposit ?? null,
      minRentalPeriod: listingDef.minRentalPeriod ?? null,
      maxRentalPeriod: listingDef.maxRentalPeriod ?? null,
      condition:       listingDef.condition,
      negotiable:      listingDef.negotiable,
      location:        listingDef.location,
      status:          'active',
      images: {
        create: listingDef.images.map((url, i) => ({
          url,              // already an absolute path like /demo/kettle.png
          sortOrder: i,
        })),
      },
    },
  });
  console.log(`  ✔ Created listing: "${listingDef.title}" (${listingDef.listingType})`);
  return listing;
}

// ─── remove mode ────────────────────────────────────────────────────────────

async function removeDemoData() {
  console.log('\nRemoving demo data…');

  // Find demo users by the phone marker
  const demoUsers = await prisma.user.findMany({ where: { phone: DEMO_TAG } });
  if (demoUsers.length === 0) {
    console.log('  No demo users found (nothing to remove).');
    return;
  }

  for (const user of demoUsers) {
    // Cascade: listings → images are deleted automatically (schema has Cascade)
    const listings = await prisma.listing.findMany({ where: { sellerId: user.id } });
    for (const l of listings) {
      await prisma.listingImage.deleteMany({ where: { listingId: l.id } });
      await prisma.listing.delete({ where: { id: l.id } });
      console.log(`  ✔ Removed listing: "${l.title}"`);
    }
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`  ✔ Removed user: ${user.email}`);
  }
  console.log('Demo data removed.');
}

// ─── main ───────────────────────────────────────────────────────────────────

async function main() {
  const isRemove = process.argv.includes('--remove');

  if (isRemove) {
    await removeDemoData();
    return;
  }

  console.log('\nSeeding demo data for SoMart…');
  console.log(`Domain: @${DOMAIN}  |  Demo password: ${DEMO_PASSWORD}\n`);

  // 1. Upsert users
  console.log('Users:');
  const users = [];
  for (const def of DEMO_USERS) {
    users.push(await upsertDemoUser(def));
  }

  // 2. Upsert listings
  console.log('\nListings:');
  for (const def of DEMO_LISTINGS) {
    await upsertDemoListing(def, users);
  }

  console.log('\n✅ Demo seed complete.');
  console.log('   These listings now appear on the marketplace and homepage.');
  console.log(`   Demo users can log in with password: ${DEMO_PASSWORD}`);
  console.log('   To remove demo data, run: node prisma/demo-seed.js --remove');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
