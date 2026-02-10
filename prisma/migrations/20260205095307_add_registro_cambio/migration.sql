-- CreateTable
CREATE TABLE "RegistroCambio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claseSemanaId" TEXT NOT NULL,
    "profesorSalienteId" TEXT,
    "profesorEntranteId" TEXT,
    "fechaCambio" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT DEFAULT 'Sustitución',
    CONSTRAINT "RegistroCambio_claseSemanaId_fkey" FOREIGN KEY ("claseSemanaId") REFERENCES "ClaseSemana" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RegistroCambio_profesorSalienteId_fkey" FOREIGN KEY ("profesorSalienteId") REFERENCES "Profesor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegistroCambio_profesorEntranteId_fkey" FOREIGN KEY ("profesorEntranteId") REFERENCES "Profesor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
