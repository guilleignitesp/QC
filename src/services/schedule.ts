import db from '@/lib/db'

export async function getWeeklySchedule(semanaId: string) {
    const rawSchedule = await db.claseSemana.findMany({
        where: { semanaId: semanaId },
        include: {
            clase: {
                include: {
                    escuela: true,
                    asignatura: true,
                    profesoresBase: true,
                },
            },
            asignacionesProfesor: {
                include: { profesor: true },
            },
        },
        orderBy: [
            { clase: { diaSemana: 'asc' } },
            { clase: { horaInicio: 'asc' } },
        ],
    })

    const schedule = rawSchedule.map(cs => {
        const allAssignments = cs.asignacionesProfesor

        // 1. Get Permanent Assignments from this specific Week Instance (Frozen Data)
        const permanentInInstance = allAssignments.filter(
            a => a.tipo === 'PERMANENTE' && a.origen === 'BASE'
        )

        let baseTeachersFormatted: any[] = []

        if (permanentInInstance.length > 0) {
            // Use the "Frozen" teachers for this week
            baseTeachersFormatted = permanentInInstance.map(a => ({
                id: a.id,
                profesorId: a.profesorId,
                profesor: a.profesor,
                tipo: 'PERMANENTE',
                origen: 'BASE',
                activo: a.activo
            }))
        } else {
            // Fallback for old weeks without frozen data: Use the Master Template
            baseTeachersFormatted = cs.clase.profesoresBase.map(p => ({
                id: `base-${p.id}`,
                profesorId: p.id,
                profesor: p,
                tipo: 'PERMANENTE',
                origen: 'BASE',
                activo: true
            }))
        }

        // 2. Get Temporal Assignments (Substitutions)
        const substitutes = allAssignments.filter(a => a.tipo === 'TEMPORAL')

        // 3. Merge both to get the final staff for this class this week
        const finalAssignments = [...baseTeachersFormatted, ...substitutes]

        return {
            ...cs,
            asignacionesProfesor: finalAssignments
        }
    })

    return schedule
}

export async function getActiveWeek() {
    const week = await db.semana.findFirst({
        where: {
            activa: true,
        },
    })
    return week
}

export async function getSchools() {
    const schools = await db.escuela.findMany({
        orderBy: {
            nombre: 'asc',
        },
    })
    return schools
}

export async function getAllWeeks() {
    return await db.semana.findMany({
        orderBy: { fechaInicio: 'asc' }
    })
}

export async function getWeekById(id: string) {
    return await db.semana.findUnique({
        where: { id }
    })
}

export async function getAllTeachers() {
    return await db.profesor.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' }
    })
    return await db.profesor.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' }
    })
}

export async function createTeacher(nombre: string) {
    return await db.profesor.create({
        data: {
            nombre,
            activo: true
        }
    })
}

// 1. Fetch current state to compare
export async function updateClaseTemplate(
    claseId: string,
    minProfesores: number,
    profesoresBaseIds: string[],
    claseSemanaId?: string // Optional context for Week View
) {
    const currentClase = await db.clase.findUnique({
        where: { id: claseId },
        include: { profesoresBase: true }
    })

    if (!currentClase) throw new Error("Class not found")

    // 2. Perform Update
    const updatedClase = await db.clase.update({
        where: { id: claseId },
        data: {
            profesoresMinimos: minProfesores,
            profesoresBase: {
                set: profesoresBaseIds.map(id => ({ id }))
            }
        },
        include: {
            profesoresBase: true // Get new names
        }
    })

    // 4. Forward Propagation & Logging (Temporal Versioning)
    if (claseSemanaId) {
        // Find context week
        const contextSemana = await db.claseSemana.findUnique({
            where: { id: claseSemanaId },
            include: {
                semana: true,
                asignacionesProfesor: {
                    where: { tipo: 'PERMANENTE', origen: 'BASE' },
                    include: { profesor: true }
                }
            }
        })

        if (contextSemana) {
            // --- LOGGING ---
            const changes = []

            // Compare NEW Selection vs CURRENT WEEK State

            // Old Identifiers (from this specific week)
            const oldIds = contextSemana.asignacionesProfesor.map(a => a.profesorId)

            // New Identifiers (from input)
            const newIds = profesoresBaseIds

            // REMOVED: In Old but not in New
            const removed = contextSemana.asignacionesProfesor.filter(a => !newIds.includes(a.profesorId))
            removed.forEach(r => changes.push(`[-] ${r.profesor.nombre}`))

            // ADDED: In New but not in Old
            // We need names for new IDs. We can find them in the updatedClase result or perform a quick lookup?
            // `updatedClase` contains the NEW names.
            const addedTeachers = updatedClase.profesoresBase.filter(p => !oldIds.includes(p.id))
            addedTeachers.forEach(p => changes.push(`[+] ${p.nombre}`))

            // MIN Changes
            if (currentClase.profesoresMinimos !== minProfesores) {
                changes.push(`[MIN] ${currentClase.profesoresMinimos} → ${minProfesores}`)
            }

            if (changes.length > 0) {
                await db.registroCambio.create({
                    data: {
                        claseSemanaId: claseSemanaId,
                        profesorSalienteId: null,
                        profesorEntranteId: null,
                        motivo: `CONFIG: ${changes.join(' || ')}`,
                        fechaCambio: new Date()
                    }
                })
            }

            // --- PROPAGATION ---
            const startDate = contextSemana.semana.fechaInicio

            // Find all FUTURE weeks for this class (including current)
            const futureWeeks = await db.claseSemana.findMany({
                where: {
                    claseId: claseId,
                    semana: {
                        fechaInicio: {
                            gte: startDate
                        }
                    }
                }
            })

            // Propagate changes
            for (const fw of futureWeeks) {
                // 1. Clear old BASE assignments
                await db.asignacionProfesor.deleteMany({
                    where: {
                        claseSemanaId: fw.id,
                        tipo: 'PERMANENTE',
                        origen: 'BASE'
                    }
                })

                // 2. Create new BASE assignments
                // Using updatedClase.profesoresBase
                const newAssignments = updatedClase.profesoresBase.map(p => ({
                    claseSemanaId: fw.id,
                    profesorId: p.id,
                    tipo: 'PERMANENTE',
                    origen: 'BASE',
                    activo: true
                }))

                if (newAssignments.length > 0) {
                    await db.asignacionProfesor.createMany({
                        data: newAssignments
                    })
                }
            }
        }
    }

    return updatedClase
}

export async function getAvailableTeachersForTemplate(claseId: string) {
    // 1. Get Target Class
    const target = await db.clase.findUnique({
        where: { id: claseId },
        include: { asignatura: true, escuela: true }
    })
    if (!target) throw new Error("Class not found")

    // 2. Get All Active Teachers
    const allTeachers = await db.profesor.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' }
    })

    // 3. Find Concurrent Classes (Same Day) - Broad Fetch
    const concurrentClasses = await db.clase.findMany({
        where: {
            diaSemana: target.diaSemana,
            id: { not: target.id } // Exclude self
        },
        include: {
            profesoresBase: true,
            escuela: true,
            asignatura: true
        }
    })

    // Helper for time math
    const getMins = (d: Date) => {
        const date = new Date(d)
        return date.getUTCHours() * 60 + date.getUTCMinutes()
    }

    const targetStart = getMins(target.horaInicio)
    const targetEnd = getMins(target.horaFin)

    // 4. Identify Busy Teachers
    const busyTeacherMap = new Map<string, { school: string, subject: string, time: string }>()

    for (const other of concurrentClasses) {
        const otherStart = getMins(other.horaInicio)
        const otherEnd = getMins(other.horaFin)

        // Buffered Overlap Check (Dynamic)
        const isSameSchool = target.escuelaId === other.escuelaId
        const currentBuffer = isSameSchool ? 0 : 60

        // Overlap if: TargetStart < OtherEnd + Buffer AND TargetEnd > OtherStart - Buffer
        // This covers:
        // 1. Direct overlap
        // 2. Proximity within buffer (travel time)
        // 3. Consecutive classes in same school (buffer 0) allow end==start
        if (targetStart < otherEnd + currentBuffer && targetEnd > otherStart - currentBuffer) {

            // Teachers in this class are busy
            for (const teacher of other.profesoresBase) {
                if (!busyTeacherMap.has(teacher.id)) {
                    busyTeacherMap.set(teacher.id, {
                        school: other.escuela.nombre,
                        subject: other.asignatura.nombre,
                        time: new Date(other.horaInicio).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    })
                }
            }
        }
    }

    // 5. Build Result
    return allTeachers.map(t => ({
        ...t,
        isBusy: busyTeacherMap.has(t.id),
        conflictDetails: busyTeacherMap.get(t.id) || null
    }))
}
