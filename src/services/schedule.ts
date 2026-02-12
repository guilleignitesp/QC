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
    return await db.$transaction(async (tx) => {
        // 1. Get Current Master State & Context
        const currentClase = await tx.clase.findUnique({
            where: { id: claseId },
            include: { profesoresBase: true }
        })

        if (!currentClase) throw new Error("Class not found")

        // 2. SEAL THE PAST (Temporal Versioning)
        // If we differ from the master, we must ensure PAST weeks have their own "Frozen" assignments
        // before we change the Master they might be relying on.
        if (claseSemanaId) {
            const contextSemana = await tx.claseSemana.findUnique({
                where: { id: claseSemanaId },
                include: { semana: true }
            })

            if (contextSemana) {
                const currentStartDate = contextSemana.semana.fechaInicio

                // Find PAST weeks that rely on the Master (have NO permanent assignments)
                const unsealedPastWeeks = await tx.claseSemana.findMany({
                    where: {
                        claseId: claseId,
                        semana: {
                            fechaInicio: { lt: currentStartDate }
                        },
                        asignacionesProfesor: {
                            none: { tipo: 'PERMANENTE', origen: 'BASE' }
                        }
                    }
                })

                // Seal them! Create assignments based on the OLD Master
                for (const pastWeek of unsealedPastWeeks) {
                    const sealedAssignments = currentClase.profesoresBase.map(p => ({
                        claseSemanaId: pastWeek.id,
                        profesorId: p.id,
                        tipo: 'PERMANENTE',
                        origen: 'BASE',
                        activo: true
                    }))

                    if (sealedAssignments.length > 0) {
                        await tx.asignacionProfesor.createMany({
                            data: sealedAssignments
                        })
                    }
                }
            }
        }

        // 3. Perform Master Update
        const updatedClase = await tx.clase.update({
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

        // 4. Forward Propagation & Logging
        if (claseSemanaId) {
            // Find context week (Re-fetch inside tx for safety though we have it)
            const contextSemana = await tx.claseSemana.findUnique({
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
                const changes: string[] = []

                // Old Identifiers
                let oldIds: string[] = []

                // CRITICAL FIX: Ensure we only accept 'Active' weeks as having data? 
                // No, sticking to "If it has assignments, use them. If not, fallback".
                if (contextSemana.asignacionesProfesor.length > 0) {
                    oldIds = contextSemana.asignacionesProfesor.map(a => a.profesorId)
                } else {
                    // Fallback to OLD Master (currentClase) because the week was empty/uninitialized
                    oldIds = currentClase.profesoresBase.map(p => p.id)
                }

                // New Identifiers
                const newIds = profesoresBaseIds

                // Logic:
                // Removed = In Old but not in New
                // Added = In New but not in Old

                // To get names for Removed, we need lookups
                const removedIds = oldIds.filter(id => !newIds.includes(id))
                for (const rId of removedIds) {
                    const p = contextSemana.asignacionesProfesor.find(a => a.profesorId === rId)?.profesor
                        || currentClase.profesoresBase.find(pb => pb.id === rId)
                    if (p) changes.push(`[-] ${p.nombre}`)
                }

                // To get names for Added, use updatedClase
                const addedIds = newIds.filter(id => !oldIds.includes(id))
                for (const aId of addedIds) {
                    const p = updatedClase.profesoresBase.find(pb => pb.id === aId)
                    if (p) changes.push(`[+] ${p.nombre}`)
                }

                // MIN Changes
                if (currentClase.profesoresMinimos !== minProfesores) {
                    changes.push(`[MIN] ${currentClase.profesoresMinimos} → ${minProfesores}`)
                }

                if (changes.length > 0) {
                    await tx.registroCambio.create({
                        data: {
                            claseSemanaId: claseSemanaId,
                            profesorSalienteId: null,
                            profesorEntranteId: null,
                            motivo: `CONFIG: ${changes.join(' || ')}`,
                            fechaCambio: new Date()
                        }
                    })
                }

                // --- PROPAGATION (Review) ---
                // We want the Current Week and Future Weeks to reflect the NEW Master.
                // Approach: Wipe 'BASE' assignments -> They will fall back to using the Master (which is now Updated).
                // WAIT! If we wipe them, they use Master. That's the "Implicit" way.
                // BUT, to be explicit and robust (and support exceptions later), we usually "Copy" the master.
                // The user logic requested: "Perform one single deleteMany... and one single createMany".

                const startDate = contextSemana.semana.fechaInicio

                const futureWeeks = await tx.claseSemana.findMany({
                    where: {
                        claseId: claseId,
                        semana: {
                            fechaInicio: { gte: startDate }
                        }
                    }
                })
                const futureWeekIds = futureWeeks.map(fw => fw.id)

                if (futureWeekIds.length > 0) {
                    // 1. Wipe Old Base Assignments
                    await tx.asignacionProfesor.deleteMany({
                        where: {
                            claseSemanaId: { in: futureWeekIds },
                            tipo: 'PERMANENTE',
                            origen: 'BASE'
                        }
                    })

                    // 2. Create New Base Assignments (Explicit Propagation)
                    // We must generate entries for EACH week x EACH teacher
                    const newAssignments = []
                    for (const wId of futureWeekIds) {
                        for (const p of updatedClase.profesoresBase) {
                            newAssignments.push({
                                claseSemanaId: wId,
                                profesorId: p.id,
                                tipo: 'PERMANENTE',
                                origen: 'BASE',
                                activo: true
                            })
                        }
                    }

                    if (newAssignments.length > 0) {
                        await tx.asignacionProfesor.createMany({
                            data: newAssignments
                        })
                    }
                }
            }
        }

        return updatedClase
    })
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
