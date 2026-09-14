-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('pending', 'sent', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lead_id" UUID NOT NULL,
    "day" INTEGER NOT NULL,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpStatus" NOT NULL DEFAULT 'pending',
    "claimed_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_ups_lead_id_idx" ON "follow_ups"("lead_id");

-- CreateIndex
CREATE INDEX "follow_ups_scheduled_at_idx" ON "follow_ups"("scheduled_at");

-- CreateIndex
CREATE INDEX "follow_ups_lead_id_day_idx" ON "follow_ups"("lead_id", "day");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
