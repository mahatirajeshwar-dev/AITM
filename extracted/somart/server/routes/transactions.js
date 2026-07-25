import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireVerified } from '../middleware/auth.js';
import { genOtp, hashCode, checkCode, notify, safeSeller, OTP_EXPIRY_MIN, OTP_MAX_ATTEMPTS } from '../lib/util.js';

const r = Router();

const includeAll = {
  listing: { include: { images: { orderBy: { sortOrder: 'asc' } } } },
  buyer: true, seller: true, rentalDetail: true,
  otps: { where: { active: true } },
  reviews: true,
};

function shape(t, uid) {
  const isBuyer = t.buyerId === uid;
  const otp = (phase) => t.otps?.find(o => o.phase === phase && o.active);
  const shapeOtp = (o) => o && {
    phase: o.phase, expiresAt: o.expiresAt, generatedAt: o.generatedAt,
    buyerOtpVerified: o.buyerOtpVerified, sellerOtpVerified: o.sellerOtpVerified,
    buyerVerifiedAt: o.buyerVerifiedAt, sellerVerifiedAt: o.sellerVerifiedAt,
    myAttemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - (isBuyer ? o.buyerAttempts : o.sellerAttempts)),
  };
  return {
    id: t.id, listingId: t.listingId, transactionType: t.transactionType,
    listedAmount: t.listedAmount, agreedAmount: t.agreedAmount,
    buyerAmountConfirmed: t.buyerAmountConfirmed, sellerAmountConfirmed: t.sellerAmountConfirmed,
    status: t.status, createdAt: t.createdAt, completedAt: t.completedAt,
    listing: t.listing && { id: t.listing.id, title: t.listing.title, images: t.listing.images, listingType: t.listing.listingType, category: t.listing.category, location: t.listing.location },
    buyer: safeSeller(t.buyer), seller: safeSeller(t.seller),
    myRole: isBuyer ? 'buyer' : 'seller',
    rentalDetail: t.rentalDetail,
    handoverOtp: shapeOtp(otp('handover')),
    returnOtp: shapeOtp(otp('return')),
    myReviewDone: t.reviews?.some(rv => rv.reviewerId === uid),
  };
}

async function loadTx(req, res) {
  const t = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: includeAll });
  if (!t) { res.status(404).json({ error: 'Transaction not found.' }); return null; }
  if (t.buyerId !== req.user.id && t.sellerId !== req.user.id) { res.status(403).json({ error: 'You are not part of this transaction.' }); return null; }
  return t;
}

async function createOtpPair(txId, phase, tx = prisma) {
  const buyerOtp = genOtp(), sellerOtp = genOtp();
  await tx.otpVerification.updateMany({ where: { transactionId: txId, phase }, data: { active: false } });
  await tx.otpVerification.create({ data: {
    transactionId: txId, phase,
    buyerOtpHash: await hashCode(buyerOtp), sellerOtpHash: await hashCode(sellerOtp),
    expiresAt: new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000),
  }});
  return { buyerOtp, sellerOtp };
}

// List my transactions
r.get('/', requireVerified, async (req, res) => {
  const ts = await prisma.transaction.findMany({
    where: { OR: [{ buyerId: req.user.id }, { sellerId: req.user.id }] },
    include: includeAll, orderBy: { createdAt: 'desc' },
  });
  res.json({ transactions: ts.map(t => shape(t, req.user.id)) });
});

r.get('/:id', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  res.json({ transaction: shape(t, req.user.id) });
});

// Create request: "I'm Interested" (sale) / "Request to Rent" (rental)
r.post('/', requireVerified, async (req, res) => {
  const { listingId } = req.body || {};
  const l = await prisma.listing.findUnique({ where: { id: listingId || '' } });
  if (!l || l.status !== 'active') return res.status(400).json({ error: 'This listing is not available.' });
  if (l.sellerId === req.user.id) return res.status(400).json({ error: 'You cannot buy or rent your own listing.' });
  const existing = await prisma.transaction.findFirst({ where: {
    listingId: l.id, buyerId: req.user.id, status: { notIn: ['completed','cancelled','rejected'] },
  }});
  if (existing) return res.status(400).json({ error: 'You already have an active request for this item.' });
  const type = l.listingType === 'rent' ? 'rental' : 'sale';
  const t = await prisma.transaction.create({ data: {
    listingId: l.id, buyerId: req.user.id, sellerId: l.sellerId,
    transactionType: type, listedAmount: type === 'sale' ? l.price : l.rentalRate,
    ...(type === 'rental' ? { rentalDetail: { create: { rentalRate: l.rentalRate, rentalUnit: l.rentalUnit, securityDeposit: l.securityDeposit } } } : {}),
  }, include: includeAll });
  await notify(l.sellerId, type === 'sale' ? 'buy_request' : 'rent_request',
    type === 'sale' ? 'New buying request' : 'New rental request',
    `${req.user.fullName.split(' ')[0]} is interested in "${l.title}"`, `/transactions/${t.id}`);
  res.json({ transaction: shape(t, req.user.id) });
});

// Seller accepts / rejects
r.post('/:id/respond', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  if (t.sellerId !== req.user.id) return res.status(403).json({ error: 'Only the seller can respond to this request.' });
  if (t.status !== 'request_sent') return res.status(400).json({ error: 'This request has already been handled.' });
  const { action } = req.body || {};
  if (action === 'accept') {
    const clash = await prisma.transaction.findFirst({ where: {
      listingId: t.listingId, id: { not: t.id }, status: { in: ['accepted','deal_in_progress','awaiting_handover','rented','awaiting_return'] },
    }});
    if (clash) return res.status(400).json({ error: 'Another deal is already in progress for this item. Cancel it first.' });
    await prisma.$transaction([
      prisma.transaction.update({ where: { id: t.id }, data: { status: 'deal_in_progress' } }),
      prisma.listing.update({ where: { id: t.listingId }, data: { status: 'deal_in_progress' } }),
    ]);
    await notify(t.buyerId, 'request_accepted', 'Request accepted', `Your request for "${t.listing.title}" was accepted. Agree on the final amount to proceed.`, `/transactions/${t.id}`);
  } else if (action === 'reject') {
    await prisma.transaction.update({ where: { id: t.id }, data: { status: 'rejected' } });
    await notify(t.buyerId, 'request_rejected', 'Request rejected', `Your request for "${t.listing.title}" was declined.`, `/transactions/${t.id}`);
  } else return res.status(400).json({ error: 'Invalid action.' });
  const fresh = await prisma.transaction.findUnique({ where: { id: t.id }, include: includeAll });
  res.json({ transaction: shape(fresh, req.user.id) });
});

// Propose / confirm agreed amount (and rental terms)
r.post('/:id/agree', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  if (t.status !== 'deal_in_progress') return res.status(400).json({ error: 'Amount can only be agreed while the deal is in progress.' });
  const { amount, rentalStartDate, rentalEndDate, totalRentalAmount, securityDeposit } = req.body || {};
  const isBuyer = t.buyerId === req.user.id;
  const data = {};
  const amt = t.transactionType === 'rental' ? parseFloat(totalRentalAmount ?? amount) : parseFloat(amount);
  if (!(amt > 0)) return res.status(400).json({ error: 'A valid amount is required.' });
  if (t.agreedAmount !== amt) {
    // New proposal resets the other party's confirmation
    data.agreedAmount = amt;
    data.buyerAmountConfirmed = isBuyer; data.sellerAmountConfirmed = !isBuyer;
  } else {
    data[isBuyer ? 'buyerAmountConfirmed' : 'sellerAmountConfirmed'] = true;
  }
  if (t.transactionType === 'rental') {
    if (rentalStartDate === undefined && !t.rentalDetail?.rentalStartDate) return res.status(400).json({ error: 'Rental start date is required.' });
    await prisma.rentalDetail.update({ where: { transactionId: t.id }, data: {
      ...(rentalStartDate !== undefined ? { rentalStartDate: new Date(rentalStartDate) } : {}),
      ...(rentalEndDate !== undefined ? { rentalEndDate: new Date(rentalEndDate) } : {}),
      totalRentalAmount: amt,
      ...(securityDeposit !== undefined ? { securityDeposit: securityDeposit === null || securityDeposit === '' ? null : parseFloat(securityDeposit) } : {}),
    }});
  }
  let updated = await prisma.transaction.update({ where: { id: t.id }, data, include: includeAll });
  const other = isBuyer ? t.sellerId : t.buyerId;
  if (updated.buyerAmountConfirmed && updated.sellerAmountConfirmed) {
    // Both agreed -> generate handover OTPs, move to awaiting_handover
    const result = await prisma.$transaction(async (tx) => {
      const pair = await createOtpPair(t.id, 'handover', tx);
      await tx.transaction.update({ where: { id: t.id }, data: { status: 'awaiting_handover' } });
      return pair;
    });
    updated = await prisma.transaction.findUnique({ where: { id: t.id }, include: includeAll });
    await notify(t.buyerId, 'otp_generated', 'Handover OTP generated', `Amount agreed for "${t.listing.title}". Your handover OTP is ready.`, `/transactions/${t.id}`);
    await notify(t.sellerId, 'otp_generated', 'Handover OTP generated', `Amount agreed for "${t.listing.title}". Your handover OTP is ready.`, `/transactions/${t.id}`);
    // Return each party ONLY their own OTP (one-time display)
    return res.json({ transaction: shape(updated, req.user.id), myOtp: isBuyer ? result.buyerOtp : result.sellerOtp,
      otpNote: 'Share this OTP with the other party ONLY during physical handover.' });
  }
  await notify(other, 'amount_confirm', 'Amount confirmation required', `₹${amt} proposed for "${t.listing.title}". Confirm to proceed.`, `/transactions/${t.id}`);
  res.json({ transaction: shape(updated, req.user.id) });
});

// Regenerate MY OTP only (per-party). Does not affect the other party's OTP,
// so the two parties can't invalidate each other's codes. Resets the other
// party's attempts against my code and extends expiry.
r.post('/:id/otp/regenerate', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  const phase = req.body?.phase === 'return' ? 'return' : 'handover';
  if (phase === 'handover' && t.status !== 'awaiting_handover') return res.status(400).json({ error: 'Handover OTPs are not active for this transaction.' });
  if (phase === 'return' && t.status !== 'awaiting_return') return res.status(400).json({ error: 'Return OTPs are not active for this transaction.' });
  const isBuyer = t.buyerId === req.user.id;
  let otp = await prisma.otpVerification.findFirst({ where: { transactionId: t.id, phase, active: true } });
  const code = genOtp();
  const myHashField = isBuyer ? 'buyerOtpHash' : 'sellerOtpHash';
  const myVerifiedField = isBuyer ? 'buyerOtpVerified' : 'sellerOtpVerified'; // whether the other party verified MY code
  const otherAttemptsField = isBuyer ? 'sellerAttempts' : 'buyerAttempts';
  if (otp && otp[myVerifiedField]) return res.status(400).json({ error: 'Your OTP has already been verified — no need to regenerate.' });
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MIN * 60 * 1000);
  if (!otp) {
    otp = await prisma.otpVerification.create({ data: {
      transactionId: t.id, phase,
      buyerOtpHash: await hashCode(isBuyer ? code : genOtp()),
      sellerOtpHash: await hashCode(isBuyer ? genOtp() : code),
      expiresAt,
    }});
  } else {
    await prisma.otpVerification.update({ where: { id: otp.id }, data: {
      [myHashField]: await hashCode(code), [otherAttemptsField]: 0, expiresAt,
    }});
  }
  const other = isBuyer ? t.sellerId : t.buyerId;
  await notify(other, 'otp_generated', 'OTP regenerated', `${req.user.fullName.split(' ')[0]} generated a new ${phase} OTP for "${t.listing.title}". Their previous code is no longer valid.`, `/transactions/${t.id}`);
  res.json({ myOtp: code, otpNote: 'Share this OTP with the other party ONLY during the physical exchange.' });
});

// Verify the OTP received from the other party.
// Seller enters the Buyer OTP; buyer enters the Seller OTP.
r.post('/:id/otp/verify', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  const { code } = req.body || {};
  const phase = req.body?.phase === 'return' ? 'return' : 'handover';
  if (phase === 'handover' && t.status !== 'awaiting_handover') return res.status(400).json({ error: 'This transaction is not awaiting handover.' });
  if (phase === 'return' && t.status !== 'awaiting_return') return res.status(400).json({ error: 'This rental is not awaiting return.' });
  const otp = await prisma.otpVerification.findFirst({ where: { transactionId: t.id, phase, active: true } });
  if (!otp) return res.status(400).json({ error: 'No active OTP. Regenerate OTPs.' });
  if (otp.expiresAt < new Date()) return res.status(400).json({ error: 'OTP expired. Regenerate OTPs.' });
  const isBuyer = t.buyerId === req.user.id;
  // The buyer verifies the SELLER's OTP; the seller verifies the BUYER's OTP.
  const targetHash = isBuyer ? otp.sellerOtpHash : otp.buyerOtpHash;
  const attemptsField = isBuyer ? 'buyerAttempts' : 'sellerAttempts';
  const verifiedField = isBuyer ? 'sellerOtpVerified' : 'buyerOtpVerified';
  const verifiedAtField = isBuyer ? 'sellerVerifiedAt' : 'buyerVerifiedAt';
  if (otp[verifiedField]) return res.status(400).json({ error: 'You have already verified this OTP.' });
  if (otp[attemptsField] >= OTP_MAX_ATTEMPTS) return res.status(429).json({ error: 'Too many incorrect attempts. Regenerate OTPs.' });
  await prisma.otpVerification.update({ where: { id: otp.id }, data: { [attemptsField]: { increment: 1 } } });
  if (!code || !(await checkCode(String(code).trim(), targetHash))) {
    const left = OTP_MAX_ATTEMPTS - otp[attemptsField] - 1;
    return res.status(400).json({ error: `Incorrect OTP. ${Math.max(0, left)} attempt(s) left.` });
  }
  const updatedOtp = await prisma.otpVerification.update({ where: { id: otp.id }, data: { [verifiedField]: true, [verifiedAtField]: new Date() } });

  const bothVerified = updatedOtp.buyerOtpVerified && updatedOtp.sellerOtpVerified;
  if (bothVerified) {
    if (phase === 'handover') {
      if (t.transactionType === 'sale') {
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: t.id }, data: { status: 'completed', completedAt: new Date() } }),
          prisma.listing.update({ where: { id: t.listingId }, data: { status: 'sold' } }),
        ]);
        await notify(t.buyerId, 'tx_completed', 'Transaction completed', `"${t.listing.title}" purchase is complete. You can now rate the seller.`, `/transactions/${t.id}`);
        await notify(t.sellerId, 'tx_completed', 'Transaction completed', `"${t.listing.title}" sale is complete. You can now rate the buyer.`, `/transactions/${t.id}`);
      } else {
        await prisma.$transaction([
          prisma.transaction.update({ where: { id: t.id }, data: { status: 'rented' } }),
          prisma.listing.update({ where: { id: t.listingId }, data: { status: 'rented' } }),
          prisma.rentalDetail.update({ where: { transactionId: t.id }, data: { handedOverAt: new Date() } }),
        ]);
        await notify(t.buyerId, 'rental_started', 'Rental started', `Rental of "${t.listing.title}" has started.`, `/transactions/${t.id}`);
        await notify(t.sellerId, 'rental_started', 'Rental started', `"${t.listing.title}" is now rented out.`, `/transactions/${t.id}`);
      }
    } else {
      // return phase complete -> rental completed, item available again
      await prisma.$transaction([
        prisma.transaction.update({ where: { id: t.id }, data: { status: 'completed', completedAt: new Date() } }),
        prisma.listing.update({ where: { id: t.listingId }, data: { status: 'active' } }),
        prisma.rentalDetail.update({ where: { transactionId: t.id }, data: { returnedAt: new Date() } }),
      ]);
      await notify(t.buyerId, 'return_completed', 'Return completed', `Return of "${t.listing.title}" is confirmed. Rental completed.`, `/transactions/${t.id}`);
      await notify(t.sellerId, 'return_completed', 'Return completed', `"${t.listing.title}" was returned and is available again.`, `/transactions/${t.id}`);
    }
  } else {
    const other = isBuyer ? t.sellerId : t.buyerId;
    await notify(other, 'otp_verified', 'OTP verified', `One ${phase} OTP verified for "${t.listing.title}". Waiting for the second verification.`, `/transactions/${t.id}`);
  }
  const fresh = await prisma.transaction.findUnique({ where: { id: t.id }, include: includeAll });
  res.json({ transaction: shape(fresh, req.user.id), bothVerified });
});

// Renter/owner initiates return at end of rental period -> generates return OTPs
r.post('/:id/start-return', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  if (t.transactionType !== 'rental' || t.status !== 'rented') return res.status(400).json({ error: 'Return can only start for an active rental.' });
  const pair = await prisma.$transaction(async (tx) => {
    await tx.transaction.update({ where: { id: t.id }, data: { status: 'awaiting_return' } });
    return createOtpPair(t.id, 'return', tx);
  });
  const isBuyer = t.buyerId === req.user.id;
  const other = isBuyer ? t.sellerId : t.buyerId;
  await notify(other, 'return_started', 'Item return started', `Return process started for "${t.listing.title}". Your return OTP is ready.`, `/transactions/${t.id}`);
  res.json({ myOtp: isBuyer ? pair.buyerOtp : pair.sellerOtp, otpNote: 'Exchange return OTPs only during the physical return.' });
});

// Cancel (either party, before completion)
r.post('/:id/cancel', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  if (['completed','cancelled','rejected','rented','awaiting_return'].includes(t.status)) return res.status(400).json({ error: 'This transaction cannot be cancelled now.' });
  await prisma.$transaction([
    prisma.transaction.update({ where: { id: t.id }, data: { status: 'cancelled' } }),
    ...(['deal_in_progress','awaiting_handover'].includes(t.status)
      ? [prisma.listing.update({ where: { id: t.listingId }, data: { status: 'active' } })] : []),
    prisma.otpVerification.updateMany({ where: { transactionId: t.id }, data: { active: false } }),
  ]);
  const other = t.buyerId === req.user.id ? t.sellerId : t.buyerId;
  await notify(other, 'tx_cancelled', 'Deal cancelled', `The deal for "${t.listing.title}" was cancelled.`, `/transactions/${t.id}`);
  const fresh = await prisma.transaction.findUnique({ where: { id: t.id }, include: includeAll });
  res.json({ transaction: shape(fresh, req.user.id) });
});

// Review after completion
r.post('/:id/review', requireVerified, async (req, res) => {
  const t = await loadTx(req, res); if (!t) return;
  if (t.status !== 'completed') return res.status(400).json({ error: 'You can only review completed transactions.' });
  const rating = parseInt(req.body?.rating);
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Rating must be 1-5 stars.' });
  const revieweeId = t.buyerId === req.user.id ? t.sellerId : t.buyerId;
  try {
    const review = await prisma.review.create({ data: {
      transactionId: t.id, reviewerId: req.user.id, revieweeId, rating,
      comment: req.body?.comment?.trim() || null,
    }});
    await notify(revieweeId, 'review', 'New review received', `You received a ${rating}-star review.`, '/profile');
    res.json({ review });
  } catch {
    res.status(400).json({ error: 'You have already reviewed this transaction.' });
  }
});

export default r;
