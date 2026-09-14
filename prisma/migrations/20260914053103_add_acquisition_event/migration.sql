-- CreateTable
CREATE TABLE "acquisition_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "campaign_id" UUID NOT NULL,
    "source" TEXT,
    "medium" TEXT,
    "campaign" TEXT,
    "ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acquisition_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "acquisition_events_campaign_id_idx" ON "acquisition_events"("campaign_id");

-- CreateIndex
CREATE INDEX "acquisition_events_created_at_idx" ON "acquisition_events"("created_at");

-- AddForeignKey
ALTER TABLE "acquisition_events" ADD CONSTRAINT "acquisition_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
