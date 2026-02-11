import db from '@/lib/db'

export async function getWeeklySchedule(semanaId: string) {
    const rawSchedule = await db.claseSemana.findMany({
        where: {
            semanaId: semanaId,
        },
        include: {
            clase: {
                include: {
                    escuela: true,
                    asignatura: true,
                    profesoresBase: true, // Fetch Template
                },
            },
            asignacionesProfesor: {
                include: {
                    profesor: true,
                },
            },
        },
        orderBy: [
            { clase: { diaSemana: 'asc' } },
            { clase: { horaInicio: 'asc' } },
        ],
    })

    // Transform Logic: Merge Template + Exceptions
    const schedule = rawSchedule.map(cs => {
        const baseTeachers = cs.clase.profesoresBase
        const exceptions = cs.asignacionesProfesor // TEMPORAL or Inactive records

        // 1. Start with Base Teachers
        // Check if any Base Teacher has a matching Exception (moved/absent)
        const mergedAssignments = baseTeachers.map(base => {
            // Can be marked inactive by a specific record in asignacionesProfesor
            const exception = exceptions.find(e => e.profesorId === base.id && e.origen === 'BASE')

            // If explicit exception says "activo: false", respect it.
            // If no exception found, they are ACTIVE by default (Template behavior)
            const isActive = exception ? exception.activo : true

            return {
                id: exception?.id || `base-${base.id}`, // Virtual ID if no exception record exists
                profesorId: base.id,
                profesor: base,
                tipo: 'PERMANENTE',
                origen: 'BASE',
                activo: isActive
            }
        })

        // 2. Add Substitutes (Temporal assignments)
        const substitutes = exceptions.filter(e => e.tipo === 'TEMPORAL')

        // Combine arrays
        const finalAssignments = [...mergedAssignments, ...substitutes]

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

    // 3. Log Change if claseSemanaId is provided (Structural Log)
    if (claseSemanaId) {
        // Build descriptive reason
        const changes = []
        if (currentClase.profesoresMinimos !== minProfesores) {
            changes.push(`Mínimos: ${currentClase.profesoresMinimos} → ${minProfesores}`)
        }

        const oldIds = currentClase.profesoresBase.map(p => p.id).sort().join(',')
        const newIds = profesoresBaseIds.sort().join(',')

        if (oldIds !== newIds) {
            const newNames = updatedClase.profesoresBase.map(p => p.nombre).join(', ')
            changes.push(`Plantilla: ${newNames}`)
        }

        if (changes.length > 0) {
            await db.registroCambio.create({
                data: {
                    claseSemanaId: claseSemanaId,
                    profesorSalienteId: null, // Structural
                    profesorEntranteId: null, // Structural
                    motivo: `CONFIG: ${changes.join(' | ')}`,
                    fechaCambio: new Date()
                }
            })
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

        // Buffered Overlap Check (60 mins)
        // Overlap if: TargetStart < OtherEnd + 60 AND TargetEnd > OtherStart - 60
        if (targetStart < otherEnd + 60 && targetEnd > otherStart - 60) {

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
