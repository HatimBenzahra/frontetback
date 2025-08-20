-- Migration pour passer d'une relation one-to-many à many-to-many Zone-Commercial
-- Étape 1: Créer la table de liaison ZoneCommercial

-- Créer la table de liaison
CREATE TABLE "zone_commerciaux" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "commercialId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedBy" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "zone_commerciaux_pkey" PRIMARY KEY ("id")
);

-- Créer les index
CREATE UNIQUE INDEX "zone_commerciaux_zoneId_commercialId_key" ON "zone_commerciaux"("zoneId", "commercialId");
CREATE INDEX "zone_commerciaux_zoneId_idx" ON "zone_commerciaux"("zoneId");
CREATE INDEX "zone_commerciaux_commercialId_idx" ON "zone_commerciaux"("commercialId");

-- Ajouter les contraintes de clé étrangère
ALTER TABLE "zone_commerciaux" ADD CONSTRAINT "zone_commerciaux_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "zone_commerciaux" ADD CONSTRAINT "zone_commerciaux_commercialId_fkey" FOREIGN KEY ("commercialId") REFERENCES "commerciaux"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Étape 2: Migrer les données existantes
-- Copier les assignations actuelles de zones vers la nouvelle table
INSERT INTO "zone_commerciaux" ("id", "zoneId", "commercialId", "assignedAt", "isActive")
SELECT 
    gen_random_uuid(),
    "id",
    "commercialId",
    "createdAt",
    true
FROM "zones" 
WHERE "commercialId" IS NOT NULL;

-- Étape 3: Supprimer l'ancienne colonne commercialId de la table zones
ALTER TABLE "zones" DROP COLUMN "commercialId";

-- Note: Cette migration doit être exécutée manuellement avec Prisma
-- npx prisma db push --accept-data-loss