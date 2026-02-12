-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RegistroCambio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claseSemanaId" TEXT NOT NULL,
    "profesorSalienteId" TEXT,
    "profesorEntranteId" TEXT,
    "fechaCambio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT DEFAULT 'Sustitución',
    "confirmado" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "RegistroCambio_claseSemanaId_fkey" FOREIGN KEY ("claseSemanaId") REFERENCES "ClaseSemana" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RegistroCambio_profesorSalienteId_fkey" FOREIGN KEY ("profesorSalienteId") REFERENCES "Profesor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistroCambio_profesorEntranteId_fkey" FOREIGN KEY ("profesorEntranteId") REFERENCES "Profesor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RegistroCambio" ("claseSemanaId", "fechaCambio", "id", "motivo", "profesorEntranteId", "profesorSalienteId") SELECT "claseSemanaId", "fechaCambio", "id", "motivo", "profesorEntranteId", "profesorSalienteId" FROM "RegistroCambio";
DROP TABLE "RegistroCambio";
ALTER TABLE "new_RegistroCambio" RENAME TO "RegistroCambio";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
