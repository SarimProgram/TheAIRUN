-- CreateEnum
CREATE TYPE "RunTogetherStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "RunTogether" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "scheduledTime" TIMESTAMP(3) NOT NULL,
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "status" "RunTogetherStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RunTogether_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RunTogether_fromUserId_status_idx" ON "RunTogether"("fromUserId", "status");

-- CreateIndex
CREATE INDEX "RunTogether_toUserId_status_idx" ON "RunTogether"("toUserId", "status");

-- AddForeignKey
ALTER TABLE "RunTogether" ADD CONSTRAINT "RunTogether_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunTogether" ADD CONSTRAINT "RunTogether_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
