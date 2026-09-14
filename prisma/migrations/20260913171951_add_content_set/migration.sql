-- CreateEnum
CREATE TYPE "ContentSetStatus" AS ENUM ('draft', 'approved', 'archived');

-- CreateTable
CREATE TABLE "content_sets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "marketing_strategy_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ContentSetStatus" NOT NULL DEFAULT 'draft',
    "content" JSONB NOT NULL,
    "input_snapshot" JSONB NOT NULL,
    "generated_by_id" UUID,
    "approved_by_id" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_sets_campaign_id_idx" ON "content_sets"("campaign_id");

-- CreateIndex
CREATE INDEX "content_sets_marketing_strategy_id_idx" ON "content_sets"("marketing_strategy_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_sets_campaign_id_version_key" ON "content_sets"("campaign_id", "version");

-- AddForeignKey
ALTER TABLE "content_sets" ADD CONSTRAINT "content_sets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_sets" ADD CONSTRAINT "content_sets_marketing_strategy_id_fkey" FOREIGN KEY ("marketing_strategy_id") REFERENCES "marketing_strategies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
