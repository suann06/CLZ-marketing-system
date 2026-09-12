-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'confirmed', 'content_ready', 'live', 'active', 'closed');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('human', 'ai', 'system');

-- CreateTable
CREATE TABLE "datasets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "source_filename" TEXT NOT NULL,
    "imported_by_id" UUID,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "row_count" INTEGER NOT NULL,

    CONSTRAINT "datasets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dataset_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "unit_count" INTEGER,
    "raw_attributes" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "product_promotion" TEXT NOT NULL,
    "official_pricing" JSONB NOT NULL,
    "differentiators" JSONB NOT NULL DEFAULT '[]',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "CampaignStatus" NOT NULL DEFAULT 'draft',
    "created_by_id" UUID,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_datasets" (
    "campaign_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,

    CONSTRAINT "campaign_datasets_pkey" PRIMARY KEY ("campaign_id","dataset_id")
);

-- CreateTable
CREATE TABLE "campaign_buildings" (
    "campaign_id" UUID NOT NULL,
    "dataset_id" UUID NOT NULL,
    "building_id" UUID NOT NULL,

    CONSTRAINT "campaign_buildings_pkey" PRIMARY KEY ("campaign_id","building_id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "buildings_dataset_id_idx" ON "buildings"("dataset_id");

-- CreateIndex
CREATE INDEX "campaign_buildings_campaign_id_dataset_id_idx" ON "campaign_buildings"("campaign_id", "dataset_id");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_datasets" ADD CONSTRAINT "campaign_datasets_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_datasets" ADD CONSTRAINT "campaign_datasets_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_buildings" ADD CONSTRAINT "campaign_buildings_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_buildings" ADD CONSTRAINT "campaign_buildings_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_buildings" ADD CONSTRAINT "campaign_buildings_building_id_fkey" FOREIGN KEY ("building_id") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
