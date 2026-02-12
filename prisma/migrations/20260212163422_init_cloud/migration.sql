-- CreateTable
CREATE TABLE "Escuela" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Escuela_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asignatura" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "Asignatura_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profesor" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Profesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clase" (
    "id" TEXT NOT NULL,
    "escuelaId" TEXT NOT NULL,
    "asignaturaId" TEXT NOT NULL,
    "diaSemana" INTEGER NOT NULL,
    "horaInicio" TIMESTAMP(3) NOT NULL,
    "horaFin" TIMESTAMP(3) NOT NULL,
    "profesoresMinimos" INTEGER NOT NULL DEFAULT 1,
    "edad" TEXT,

    CONSTRAINT "Clase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Semana" (
    "id" TEXT NOT NULL,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaFin" TIMESTAMP(3) NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Semana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClaseSemana" (
    "id" TEXT NOT NULL,
    "claseId" TEXT NOT NULL,
    "semanaId" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'NORMAL',
    "notas" TEXT,

    CONSTRAINT "ClaseSemana_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AsignacionProfesor" (
    "id" TEXT NOT NULL,
    "profesorId" TEXT NOT NULL,
    "claseSemanaId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "origen" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "AsignacionProfesor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroCambio" (
    "id" TEXT NOT NULL,
    "claseSemanaId" TEXT NOT NULL,
    "profesorSalienteId" TEXT,
    "profesorEntranteId" TEXT,
    "fechaCambio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "motivo" TEXT DEFAULT 'Sustitución',
    "confirmado" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RegistroCambio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ProfesoresBase" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ProfesoresBase_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClaseSemana_claseId_semanaId_key" ON "ClaseSemana"("claseId", "semanaId");

-- CreateIndex
CREATE INDEX "_ProfesoresBase_B_index" ON "_ProfesoresBase"("B");

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_escuelaId_fkey" FOREIGN KEY ("escuelaId") REFERENCES "Escuela"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clase" ADD CONSTRAINT "Clase_asignaturaId_fkey" FOREIGN KEY ("asignaturaId") REFERENCES "Asignatura"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaseSemana" ADD CONSTRAINT "ClaseSemana_claseId_fkey" FOREIGN KEY ("claseId") REFERENCES "Clase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClaseSemana" ADD CONSTRAINT "ClaseSemana_semanaId_fkey" FOREIGN KEY ("semanaId") REFERENCES "Semana"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionProfesor" ADD CONSTRAINT "AsignacionProfesor_profesorId_fkey" FOREIGN KEY ("profesorId") REFERENCES "Profesor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AsignacionProfesor" ADD CONSTRAINT "AsignacionProfesor_claseSemanaId_fkey" FOREIGN KEY ("claseSemanaId") REFERENCES "ClaseSemana"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCambio" ADD CONSTRAINT "RegistroCambio_claseSemanaId_fkey" FOREIGN KEY ("claseSemanaId") REFERENCES "ClaseSemana"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCambio" ADD CONSTRAINT "RegistroCambio_profesorSalienteId_fkey" FOREIGN KEY ("profesorSalienteId") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroCambio" ADD CONSTRAINT "RegistroCambio_profesorEntranteId_fkey" FOREIGN KEY ("profesorEntranteId") REFERENCES "Profesor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfesoresBase" ADD CONSTRAINT "_ProfesoresBase_A_fkey" FOREIGN KEY ("A") REFERENCES "Clase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ProfesoresBase" ADD CONSTRAINT "_ProfesoresBase_B_fkey" FOREIGN KEY ("B") REFERENCES "Profesor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
