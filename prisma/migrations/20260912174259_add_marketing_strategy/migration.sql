-- CreateEnum
CREATE TYPE "MarketingStrategyStatus" AS ENUM ('draft', 'approved', 'archived');

-- CreateTable
CREATE TABLE "marketing_strategies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "MarketingStrategyStatus" NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "generated_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketing_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "marketing_strategies_campaign_id_idx" ON "marketing_strategies"("campaign_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketing_strategies_campaign_id_version_key" ON "marketing_strategies"("campaign_id", "version");

-- AddForeignKey
ALTER TABLE "marketing_strategies" ADD CONSTRAINT "marketing_strategies_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
