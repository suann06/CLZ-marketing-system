-- CreateEnum
CREATE TYPE "LaunchPlatform" AS ENUM ('facebook', 'instagram', 'tiktok');

-- CreateEnum
CREATE TYPE "LaunchStatus" AS ENUM ('pending', 'launching', 'live', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "launches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "content_set_id" UUID NOT NULL,
    "content_set_version" INTEGER NOT NULL,
    "platform" "LaunchPlatform" NOT NULL,
    "variant_index" INTEGER NOT NULL,
    "selected_variant" JSONB NOT NULL,
    "status" "LaunchStatus" NOT NULL DEFAULT 'pending',
    "provider" TEXT,
    "external_campaign_id" TEXT,
    "external_ad_id" TEXT,
    "external_creative_id" TEXT,
    "failure_reason" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_by_id" UUID,
    "launched_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "launches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "launches_campaign_id_idx" ON "launches"("campaign_id");

-- CreateIndex
CREATE INDEX "launches_content_set_id_idx" ON "launches"("content_set_id");

-- CreateIndex
CREATE INDEX "launches_idempotency_key_idx" ON "launches"("idempotency_key");

-- AddForeignKey
ALTER TABLE "launches" ADD CONSTRAINT "launches_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "launches" ADD CONSTRAINT "launches_content_set_id_fkey" FOREIGN KEY ("content_set_id") REFERENCES "content_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
