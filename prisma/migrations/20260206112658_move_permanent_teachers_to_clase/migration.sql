-- CreateTable
CREATE TABLE "_ProfesoresBase" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_ProfesoresBase_A_fkey" FOREIGN KEY ("A") REFERENCES "Clase" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_ProfesoresBase_B_fkey" FOREIGN KEY ("B") REFERENCES "Profesor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "_ProfesoresBase_AB_unique" ON "_ProfesoresBase"("A", "B");

-- CreateIndex
CREATE INDEX "_ProfesoresBase_B_index" ON "_ProfesoresBase"("B");
