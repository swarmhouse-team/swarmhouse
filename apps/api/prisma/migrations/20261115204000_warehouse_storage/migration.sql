-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_maps" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "content" JSONB NOT NULL,

    CONSTRAINT "warehouse_maps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_maps_warehouse_id_key" ON "warehouse_maps"("warehouse_id");

-- AddForeignKey
ALTER TABLE "warehouse_maps" ADD CONSTRAINT "warehouse_maps_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Check constraints are not represented in schema.prisma.
ALTER TABLE "warehouse_maps" ADD CONSTRAINT "warehouse_maps_version_nonnegative" CHECK ("version" >= 0);

ALTER TABLE "warehouse_maps" ADD CONSTRAINT "warehouse_maps_content_object" CHECK (jsonb_typeof("content") = 'object');
