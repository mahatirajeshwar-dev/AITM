// SoMart seed data: 12 students, 26 listings, sample transactions & rentals.
// Admin account is created from ADMIN_USERNAME / ADMIN_PASSWORD env variables.
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { prisma } from '../server/lib/prisma.js';
const pw = (p) => bcrypt.hashSync(p, 10);
const DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN || 'bitsom.edu.in';
const PASS = 'Student@123'; // demo password for all seeded students
const ph = (seed, w = 640, h = 480) => `https://picsum.photos/seed/${seed}/${w}/${h}`;
const daysAgo = (n) => new Date(Date.now() - n * 86400000);

async function main() {
  console.log('Seeding SoMart…');
  for (const m of ['adminAuditLog','notification','report','review','message','conversation','otpVerification','rentalDetail','transaction','listingImage','listing','emailToken','user'])
    await prisma[m].deleteMany();

  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'Admin@1234';
  await prisma.user.create({ data: {
    fullName: 'SoMart Admin', email: `${adminUser.toLowerCase()}@somart.admin`,
    passwordHash: pw(adminPass), emailVerified: true, role: 'admin',
  }});

  const names = [
    ['Aarav Sharma','2026'],['Diya Patel','2026'],['Rohan Mehta','2027'],['Ananya Iyer','2027'],
    ['Kabir Singh','2026'],['Sneha Reddy','2027'],['Arjun Nair','2026'],['Ishita Gupta','2027'],
    ['Vikram Rao','2026'],['Priya Desai','2027'],['Aditya Kulkarni','2026'],['Meera Joshi','2027'],
  ];
  const users = [];
  for (const [name, batch] of names) {
    const email = name.toLowerCase().replace(' ', '.') + '@' + DOMAIN;
    users.push(await prisma.user.create({ data: {
      fullName: name, email, passwordHash: pw(PASS), emailVerified: true, batch,
      phone: '98' + String(10000000 + Math.floor(Math.random() * 89999999)),
    }}));
  }
  const u = (i) => users[i % users.length];

  const L = [
    [0,'Corporate Finance (Berk & DeMarzo) 5th Ed','Books','sale',900,null,'good',1,'Hostel Block A','Standard core-finance textbook, minimal highlighting, all chapters intact. Perfect for Term 2.',2],
    [1,'Casio FX-991ES Plus Scientific Calculator','Academic Supplies','sale',650,null,'like_new',0,'Library Entrance','Barely used, comes with cover. All functions working perfectly.',3],
    [2,'BTWIN Riverside 100 Cycle','Cycles','sale',6500,null,'good',1,'Cycle Stand, Gate 2','Well maintained hybrid cycle. New brake pads last month. Ideal for campus commute.',1],
    [3,'IKEA Table Lamp (Warm White)','Room Essentials','sale',450,null,'like_new',0,'Hostel Block C','Cozy warm-white lamp, great for late-night study sessions.',5],
    [4,'Single Mattress + Topper','Room Essentials','sale',1800,null,'good',1,'Hostel Block B','Sleepwell single mattress with topper. Clean, sanitized, no stains.',4],
    [5,'Dell 24" FHD Monitor','Electronics','sale',7200,null,'like_new',1,'Hostel Block D','Dell S2421H, bought 8 months ago. Crisp panel, HDMI cable included.',2],
    [6,'Keychron K2 Mechanical Keyboard','Electronics','sale',4500,null,'good',1,'Hostel Block A','Brown switches, hot-swappable. Includes USB-C cable.',6],
    [7,'Yonex Muscle Power 29 Racket','Sports Equipment','sale',1400,null,'good',0,'Sports Complex','Freshly strung at 24lbs. Grip replaced. Great intermediate racket.',3],
    [8,'Formal Blazer (40R, Charcoal)','Fashion','sale',2200,null,'like_new',1,'Hostel Block B','Raymond charcoal blazer, worn twice for placements. Dry-cleaned.',7],
    [9,'Marketing Management (Kotler) 16th Ed','Books','sale',800,null,'fair',1,'Library','Some notes in margins (useful ones!). Binding solid.',8],
    [10,'Ergonomic Study Table','Furniture','sale',3500,null,'good',1,'Hostel Block C','Sturdy engineered-wood desk 4x2ft with cable grommet.',9],
    [11,'Herman Miller-style Office Chair','Furniture','sale',5500,null,'good',1,'Hostel Block D','Mesh back, adjustable lumbar. Very comfortable for long study hours.',5],
    [0,'Kettle + French Press Combo','Kitchen Items','sale',900,null,'good',0,'Hostel Block A','1.5L electric kettle plus 350ml French press. Coffee lover starter pack.',10],
    [1,'TI-BA II Plus Financial Calculator','Academic Supplies','sale',1600,null,'like_new',1,'Library Entrance','The CFA-exam-approved one. Includes case and manual.',4],
    [2,'Fresher Party Ticket (Transferable)','Event Tickets','sale',500,null,'new',0,'Student Center','Can transfer at the venue. Selling as I have a clash.',1],
    [3,'Room Decor Fairy Lights Set','Room Essentials','sale',300,null,'new',0,'Hostel Block C','Unopened 10m warm fairy lights + photo clips.',2],
    [4,'Bicycle — Hero Sprint (Rental)','Cycles','rent',null,[40,'day',500,1,30],'good',0,'Cycle Stand, Gate 2','Rent by the day. Lock and lights included. Deposit refundable on return.',3],
    [5,'DSLR Canon 200D + Kit Lens','Electronics','rent',null,[350,'day',5000,1,7],'like_new',1,'Hostel Block D','Great for club shoots and fests. Includes 64GB card and bag.',2],
    [6,'Projector (1080p) + HDMI Kit','Electronics','rent',null,[250,'day',2000,1,5],'good',0,'Hostel Block A','Movie nights! Includes HDMI + speaker aux.',6],
    [7,'Camping Tent (4-person)','Sports Equipment','rent',null,[150,'day',1000,1,10],'good',0,'Sports Complex','Waterproof dome tent, easy 10-min setup.',8],
    [8,'Ethnic Sherwani Set (M)','Fashion','rent',null,[400,'day',1500,1,4],'like_new',0,'Hostel Block B','Perfect for ethnic day and weddings. Dry-cleaned after every rental.',5],
    [9,'Mini Fridge 90L','Room Essentials','rent',null,[600,'month',2000,1,12],'good',1,'Hostel Block C','Chills fast, quiet. Monthly rental, min 1 month.',11],
    [10,'Study Table (Foldable) — Rental','Furniture','rent',null,[200,'month',500,1,10],'good',0,'Hostel Block C','Foldable table on monthly rental — handy for exam season.',7],
    [11,'Badminton Racket Pair + Shuttles','Sports Equipment','rent',null,[60,'day',300,1,15],'good',0,'Sports Complex','Two rackets + 3 shuttles per day.',2],
    [0,'Bluetooth Speaker JBL Flip 5','Electronics','rent',null,[120,'day',1000,1,5],'like_new',0,'Hostel Block A','Loud, punchy, full-day battery.',1],
    [1,'Advanced Corp Fin Case Pack','Books','sale',350,null,'good',0,'Library','Printed HBS case pack for elective, unmarked.',3],
  ];

  const listings = [];
  for (let i = 0; i < L.length; i++) {
    const [si, title, category, type, price, rentArr, condition, neg, location, description, old] = L[i];
    const isRent = type === 'rent';
    const [rate, unit, dep, minP, maxP] = rentArr || [];
    listings.push(await prisma.listing.create({ data: {
      sellerId: u(si).id, title, description, category, listingType: type,
      price: isRent ? null : price, rentalRate: isRent ? rate : null, rentalUnit: isRent ? unit : null,
      securityDeposit: isRent ? dep : null, minRentalPeriod: isRent ? minP : null, maxRentalPeriod: isRent ? maxP : null,
      condition, negotiable: !!neg, location, createdAt: daysAgo(old),
      images: { create: [ { url: ph(`somart${i}a`), sortOrder: 0 }, { url: ph(`somart${i}b`), sortOrder: 1 } ] },
    }}));
  }

  async function completedSale(li, buyerIdx, agreed, monthsAgoN) {
    const l = listings[li];
    const when = new Date(); when.setMonth(when.getMonth() - monthsAgoN); when.setDate(10);
    const t = await prisma.transaction.create({ data: {
      listingId: l.id, buyerId: u(buyerIdx).id, sellerId: l.sellerId, transactionType: 'sale',
      listedAmount: l.price, agreedAmount: agreed, buyerAmountConfirmed: true, sellerAmountConfirmed: true,
      status: 'completed', createdAt: new Date(when.getTime() - 2 * 86400000), completedAt: when,
    }});
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'sold' } });
    await prisma.otpVerification.create({ data: {
      transactionId: t.id, phase: 'handover', buyerOtpHash: pw('000000'), sellerOtpHash: pw('000000'),
      buyerOtpVerified: true, sellerOtpVerified: true, buyerVerifiedAt: when, sellerVerifiedAt: when,
      expiresAt: when, active: false,
    }});
    await prisma.review.create({ data: { transactionId: t.id, reviewerId: u(buyerIdx).id, revieweeId: l.sellerId, rating: 4 + (li % 2), comment: 'Smooth deal, item exactly as described!' } });
    await prisma.review.create({ data: { transactionId: t.id, reviewerId: l.sellerId, revieweeId: u(buyerIdx).id, rating: 5, comment: 'Punctual and friendly buyer. Recommended.' } });
  }
  await completedSale(9, 3, 700, 4);
  await completedSale(12, 5, 850, 3);
  await completedSale(15, 6, 280, 2);
  await completedSale(25, 8, 300, 1);

  { // completed rental
    const l = listings[23];
    const start = daysAgo(20), end = daysAgo(18);
    const t = await prisma.transaction.create({ data: {
      listingId: l.id, buyerId: u(2).id, sellerId: l.sellerId, transactionType: 'rental',
      listedAmount: l.rentalRate, agreedAmount: 120, buyerAmountConfirmed: true, sellerAmountConfirmed: true,
      status: 'completed', createdAt: daysAgo(21), completedAt: end,
      rentalDetail: { create: { rentalStartDate: start, rentalEndDate: end, rentalRate: l.rentalRate, rentalUnit: l.rentalUnit, totalRentalAmount: 120, securityDeposit: l.securityDeposit, handedOverAt: start, returnedAt: end } },
    }});
    for (const phase of ['handover','return']) await prisma.otpVerification.create({ data: {
      transactionId: t.id, phase, buyerOtpHash: pw('000000'), sellerOtpHash: pw('000000'),
      buyerOtpVerified: true, sellerOtpVerified: true, buyerVerifiedAt: end, sellerVerifiedAt: end, expiresAt: end, active: false,
    }});
    await prisma.review.create({ data: { transactionId: t.id, reviewerId: u(2).id, revieweeId: l.sellerId, rating: 5, comment: 'Rackets in great shape. Easy pickup and return.' } });
  }
  { // active rental (currently rented)
    const l = listings[17];
    const start = daysAgo(2), end = new Date(Date.now() + 3 * 86400000);
    const t = await prisma.transaction.create({ data: {
      listingId: l.id, buyerId: u(0).id, sellerId: l.sellerId, transactionType: 'rental',
      listedAmount: l.rentalRate, agreedAmount: 1600, buyerAmountConfirmed: true, sellerAmountConfirmed: true,
      status: 'rented', createdAt: daysAgo(3),
      rentalDetail: { create: { rentalStartDate: start, rentalEndDate: end, rentalRate: l.rentalRate, rentalUnit: l.rentalUnit, totalRentalAmount: 1600, securityDeposit: l.securityDeposit, handedOverAt: start } },
    }});
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'rented' } });
    await prisma.otpVerification.create({ data: {
      transactionId: t.id, phase: 'handover', buyerOtpHash: pw('000000'), sellerOtpHash: pw('000000'),
      buyerOtpVerified: true, sellerOtpVerified: true, buyerVerifiedAt: start, sellerVerifiedAt: start, expiresAt: start, active: false,
    }});
  }
  { // active sale deal in progress
    const l = listings[5];
    await prisma.transaction.create({ data: {
      listingId: l.id, buyerId: u(1).id, sellerId: l.sellerId, transactionType: 'sale',
      listedAmount: l.price, status: 'deal_in_progress', createdAt: daysAgo(1),
    }});
    await prisma.listing.update({ where: { id: l.id }, data: { status: 'deal_in_progress' } });
  }
  { // pending request
    const l = listings[2];
    await prisma.transaction.create({ data: {
      listingId: l.id, buyerId: u(7).id, sellerId: l.sellerId, transactionType: 'sale',
      listedAmount: l.price, status: 'request_sent', createdAt: daysAgo(0),
    }});
  }
  await prisma.report.create({ data: { reporterId: u(3).id, listingId: listings[14].id, reason: 'misleading', details: 'Ticket says transferable but organizer told me entry is ID-matched.' } });

  console.log(`Seeded: ${users.length} students, ${listings.length} listings, transactions, rentals, reviews, 1 report.`);
  console.log(`Student login: e.g. ${users[0].email} / ${PASS}`);
  console.log(`Admin login (/admin/login): ${adminUser} / ${adminPass}`);
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
