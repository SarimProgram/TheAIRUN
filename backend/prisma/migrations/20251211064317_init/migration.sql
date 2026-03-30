-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "partnerId" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "heightCm" INTEGER,
    "weightKg" DOUBLE PRECISION,
    "timezone" TEXT DEFAULT 'UTC',
    "units" TEXT DEFAULT 'metric',
    "goalType" TEXT,
    "goalTarget" DOUBLE PRECISION,
    "goalStart" DOUBLE PRECISION,
    "goalUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_partnerId_key" ON "User"("partnerId");
