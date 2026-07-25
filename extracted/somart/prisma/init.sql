-- SoMart schema DDL (SQLite). Generated to mirror prisma/schema.prisma.
-- On Replit/Postgres you can instead run: npx prisma db push
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY, "fullName" TEXT NOT NULL, "email" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL, "emailVerified" BOOLEAN NOT NULL DEFAULT 0,
  "batch" TEXT, "phone" TEXT, "profileImage" TEXT, "contactPref" TEXT NOT NULL DEFAULT 'chat',
  "role" TEXT NOT NULL DEFAULT 'student', "accountStatus" TEXT NOT NULL DEFAULT 'active',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "EmailToken" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "codeHash" TEXT NOT NULL, "purpose" TEXT NOT NULL, "expiresAt" DATETIME NOT NULL,
  "usedAt" DATETIME, "attempts" INTEGER NOT NULL DEFAULT 0, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Listing" (
  "id" TEXT PRIMARY KEY, "sellerId" TEXT NOT NULL REFERENCES "User"("id"),
  "title" TEXT NOT NULL, "description" TEXT NOT NULL, "category" TEXT NOT NULL, "listingType" TEXT NOT NULL,
  "price" REAL, "rentalRate" REAL, "rentalUnit" TEXT, "securityDeposit" REAL,
  "minRentalPeriod" INTEGER, "maxRentalPeriod" INTEGER, "availableFrom" DATETIME, "availableUntil" DATETIME,
  "condition" TEXT NOT NULL, "negotiable" BOOLEAN NOT NULL DEFAULT 0, "location" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'active',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ListingImage" (
  "id" TEXT PRIMARY KEY, "listingId" TEXT NOT NULL REFERENCES "Listing"("id") ON DELETE CASCADE,
  "url" TEXT NOT NULL, "sortOrder" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "Transaction" (
  "id" TEXT PRIMARY KEY, "listingId" TEXT NOT NULL REFERENCES "Listing"("id"),
  "buyerId" TEXT NOT NULL REFERENCES "User"("id"), "sellerId" TEXT NOT NULL REFERENCES "User"("id"),
  "transactionType" TEXT NOT NULL, "listedAmount" REAL NOT NULL, "agreedAmount" REAL,
  "buyerAmountConfirmed" BOOLEAN NOT NULL DEFAULT 0, "sellerAmountConfirmed" BOOLEAN NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'request_sent',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "completedAt" DATETIME
);
CREATE TABLE IF NOT EXISTS "RentalDetail" (
  "transactionId" TEXT PRIMARY KEY REFERENCES "Transaction"("id") ON DELETE CASCADE,
  "rentalStartDate" DATETIME, "rentalEndDate" DATETIME, "rentalRate" REAL, "rentalUnit" TEXT,
  "totalRentalAmount" REAL, "securityDeposit" REAL, "handedOverAt" DATETIME, "returnedAt" DATETIME
);
CREATE TABLE IF NOT EXISTS "OtpVerification" (
  "id" TEXT PRIMARY KEY, "transactionId" TEXT NOT NULL REFERENCES "Transaction"("id") ON DELETE CASCADE,
  "phase" TEXT NOT NULL, "buyerOtpHash" TEXT NOT NULL, "sellerOtpHash" TEXT NOT NULL,
  "buyerOtpVerified" BOOLEAN NOT NULL DEFAULT 0, "sellerOtpVerified" BOOLEAN NOT NULL DEFAULT 0,
  "buyerAttempts" INTEGER NOT NULL DEFAULT 0, "sellerAttempts" INTEGER NOT NULL DEFAULT 0,
  "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" DATETIME NOT NULL,
  "buyerVerifiedAt" DATETIME, "sellerVerifiedAt" DATETIME, "active" BOOLEAN NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS "OtpVerification_transactionId_phase_idx" ON "OtpVerification"("transactionId", "phase");
CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT PRIMARY KEY, "userAId" TEXT NOT NULL REFERENCES "User"("id"), "userBId" TEXT NOT NULL REFERENCES "User"("id"),
  "listingId" TEXT, "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_userAId_userBId_listingId_key" ON "Conversation"("userAId","userBId","listingId");
CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT PRIMARY KEY, "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "senderId" TEXT NOT NULL REFERENCES "User"("id"), "body" TEXT NOT NULL, "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Review" (
  "id" TEXT PRIMARY KEY, "transactionId" TEXT NOT NULL REFERENCES "Transaction"("id"),
  "reviewerId" TEXT NOT NULL REFERENCES "User"("id"), "revieweeId" TEXT NOT NULL REFERENCES "User"("id"),
  "rating" INTEGER NOT NULL, "comment" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Review_transactionId_reviewerId_key" ON "Review"("transactionId","reviewerId");
CREATE TABLE IF NOT EXISTS "Report" (
  "id" TEXT PRIMARY KEY, "reporterId" TEXT NOT NULL REFERENCES "User"("id"),
  "reportedUserId" TEXT REFERENCES "User"("id"), "listingId" TEXT REFERENCES "Listing"("id"),
  "reason" TEXT NOT NULL, "details" TEXT, "status" TEXT NOT NULL DEFAULT 'open',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Notification" (
  "id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL, "title" TEXT NOT NULL, "body" TEXT, "link" TEXT, "readAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "AdminAuditLog" (
  "id" TEXT PRIMARY KEY, "adminId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "targetType" TEXT, "targetId" TEXT, "reason" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
