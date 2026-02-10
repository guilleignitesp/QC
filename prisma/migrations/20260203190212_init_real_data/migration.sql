-- CreateTable
CREATE TABLE "Escuela" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Asignatura" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Profesor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "Clase" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "escuelaId" TEXT NOT NULL,
    "asignaturaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" DATETIME NOT NULL,
    "horaFin" DATETIME NOT NULL,
    "profesoresMinimos" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Clase_escuelaId_fkey" FOREIGN KEY ("escuelaId") REFERENCES "Escuela" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Clase_asignaturaId_fkey" FOREIGN KEY ("asignaturaId") REFERENCES "Asignatura" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Semana" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fechaInicio" DATETIME NOT NULL,
    "fechaFin" DATETIME NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true
);

-- CreateTable
CREATE TABLE "ClaseSemana" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claseId" TEXT NOT NULL,
    "semanaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'NORMAL',
    "notas" TEXT,
    CONSTRAINT "ClaseSemana_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ClaseSemana_semanaId_fkey" FOREIGN KEY ("semanaId") REFERENCES "Semana" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AsignacionProfesor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profesorId" TEXT NOT NULL,
    "claseSemanaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "AsignacionProfesor_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AsignacionProfesor_claseSemanaId_fkey" FOREIGN KEY ("claseSemanaId") REFERENCES "ClaseSemana" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ClaseSemana_claseId_semanaId_key" ON "ClaseSemana"("claseId", "semanaId");
