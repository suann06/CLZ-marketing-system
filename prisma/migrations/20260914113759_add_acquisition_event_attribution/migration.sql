-- AlterTable
ALTER TABLE "acquisition_events" ADD COLUMN     "dataset_id" UUID,
ADD COLUMN     "launch_id" UUID;

-- CreateIndex
CREATE INDEX "acquisition_events_dataset_id_idx" ON "acquisition_events"("dataset_id");

-- CreateIndex
CREATE INDEX "acquisition_events_launch_id_idx" ON "acquisition_events"("launch_id");

-- AddForeignKey
ALTER TABLE "acquisition_events" ADD CONSTRAINT "acquisition_events_dataset_id_fkey" FOREIGN KEY ("dataset_id") REFERENCES "datasets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "acquisition_events" ADD CONSTRAINT "acquisition_events_launch_id_fkey" FOREIGN KEY ("launch_id") REFERENCES "launches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
