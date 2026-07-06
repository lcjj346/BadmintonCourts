-- CreateEnum
CREATE TYPE "Region" AS ENUM ('NORTH', 'SOUTH', 'EAST', 'WEST', 'CENTRAL');

-- CreateEnum
CREATE TYPE "VenueType" AS ENUM ('SPORTS_HALL', 'COMMUNITY_CENTRE', 'SCHOOL', 'OTHER');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('AVAILABLE', 'SOLD', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('OPEN', 'FILLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "RateAction" AS ENUM ('REVEAL', 'CREATE');

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "region" "Region" NOT NULL,
    "venueType" "VenueType" NOT NULL,
    "availabilityNote" TEXT,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "priceCents" INTEGER,
    "notes" TEXT,
    "phone" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "editToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "playersNeeded" INTEGER NOT NULL,
    "skillLevel" "SkillLevel" NOT NULL,
    "pricePerPlayerCents" INTEGER,
    "notes" TEXT,
    "phone" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'OPEN',
    "editToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitEvent" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "action" "RateAction" NOT NULL,
    "targetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportFlag" (
    "id" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReportFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueSuggestion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Listing_editToken_key" ON "Listing"("editToken");

-- CreateIndex
CREATE INDEX "Listing_date_status_idx" ON "Listing"("date", "status");

-- CreateIndex
CREATE INDEX "Listing_venueId_idx" ON "Listing"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_editToken_key" ON "GameSession"("editToken");

-- CreateIndex
CREATE INDEX "GameSession_date_status_idx" ON "GameSession"("date", "status");

-- CreateIndex
CREATE INDEX "GameSession_venueId_idx" ON "GameSession"("venueId");

-- CreateIndex
CREATE INDEX "RateLimitEvent_ipHash_action_createdAt_idx" ON "RateLimitEvent"("ipHash", "action", "createdAt");

-- CreateIndex
CREATE INDEX "ReportFlag_targetType_targetId_idx" ON "ReportFlag"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "Listing" ADD CONSTRAINT "Listing_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
