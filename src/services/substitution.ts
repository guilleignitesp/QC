import db from '@/lib/db'

// Standardized Type for ALL Priorities
export type SubstitutionCandidate = {
    teacher: any
    currentClasses: { schoolName: string, subjectName: string }[]
}

export type SubstitutionCandidates = {
    priority1_leftover: SubstitutionCandidate[]
    priority2_free: SubstitutionCandidate[]
    priority3_creative: SubstitutionCandidate[]
    priority4_absent: SubstitutionCandidate[]
}

// Helper to convert DateTime to minutes from midnight for comparison
function getMinutesInDay(date: Date) {
    const d = new Date(date)
    return d.getUTCHours() * 60 + d.getUTCMinutes()
}

function doTimesOverlap(startA: Date, endA: Date, startB: Date, endB: Date) {
    const sA = getMinutesInDay(startA)
    const eA = getMinutesInDay(endA)
    const sB = getMinutesInDay(startB)
    const eB = getMinutesInDay(endB)

    return Math.max(sA, sB) < Math.min(eA, eB)
}

export async function getSubstitutionCandidates(
    claseSemanaId: string,
    absentTeacherId: string
): Promise<SubstitutionCandidates> {

    // 1. Get Target Class Details
    const target = await db.claseSemana.findUnique({
        where: { id: claseSemanaId },
        include: {
            clase: {
                include: {
                    asignatura: true
                }
            },
            semana: true
        }
    })

    if (!target) throw new Error('Class not found')

    // 2. Get All Active Teachers
    const allTeachers = await db.profesor.findMany({
        where: { activo: true },
        orderBy: { nombre: 'asc' }
    })

    // 3. Find Concurrent Classes (Same Week, Same Day)
    // We fetch broadly and filter time overlap in memory (Prisma limitations with SQLite Dates)
    const weeksClasses = await db.claseSemana.findMany({
        where: {
            semanaId: target.semanaId,
            clase: {
                diaSemana: target.clase.diaSemana
            }
        },
        include: {
            clase: {
                include: {
                    profesoresBase: true, // KEY: Need template teachers to calculate surplus
                    escuela: true,
                    asignatura: true
                }
            },
            asignacionesProfesor: {
                include: {
                    profesor: true // Need names if we return details
                }
            }
        }
    })

    // 4. Filter for Actual Time Overlap
    const targetStart = getMinutesInDay(target.clase.horaInicio)
    const targetEnd = getMinutesInDay(target.clase.horaFin)

    const concurrentClasses = weeksClasses.filter(cs => {
        // Skip self
        if (cs.id === target.id) return false

        const currentStart = getMinutesInDay(cs.clase.horaInicio)
        const currentEnd = getMinutesInDay(cs.clase.horaFin)

        // 60-Minute Travel Buffer Check
        // Teachers are considered "Busy" if they have a class overlapping the target slot
        // OR if they have a class within 60 minutes before/after the target slot.
        // Formula: Target overlaps (CurrentStart - 60) to (CurrentEnd + 60)
        return Math.max(targetStart, currentStart - 60) < Math.min(targetEnd, currentEnd + 60)
    })

    // 5. Build Maps
    const teacherClassesMap = new Map<string, any[]>()
    const classIsSurplusMap = new Map<string, boolean>()

    // Trackers for State-Aware Logic
    const busyTeacherIds = new Set<string>() // Teachers working ACTIVE in any concurrent class
    const inactiveTeacherIds = new Set<string>() // Teachers marked INACTIVE in any concurrent class

    for (const cs of concurrentClasses) {
        // Effective Staff Logic:
        // Start with Base Teachers
        const baseTeachers = cs.clase.profesoresBase

        // Check exceptions for Base Teachers (Active=false)
        const activeBaseTeachers = baseTeachers.filter(base => {
            const exception = cs.asignacionesProfesor.find(ap => ap.profesorId === base.id && ap.origen === 'BASE')
            // If exception exists and activo is false, they are inactive
            if (exception && !exception.activo) {
                inactiveTeacherIds.add(base.id)
                return false
            }
            return true // Default true if no exception
        })

        // Add Substitutes (Temporal & Active)
        const substitutes = cs.asignacionesProfesor.filter(ap => ap.tipo === 'TEMPORAL' && ap.activo)

        // Also capture explicitly inactive substitutes (rare, but possible if a sub was cancelled/removed safely)
        cs.asignacionesProfesor.filter(ap => ap.tipo === 'TEMPORAL' && !ap.activo).forEach(ap => {
            inactiveTeacherIds.add(ap.profesorId)
        })

        // Calculate Effective Count (Base + Temp)
        const effectiveCount = activeBaseTeachers.length + substitutes.length
        const minRequired = cs.clase.profesoresMinimos

        // Determine surplus status for the CLASS
        const isSurplusClass = effectiveCount > minRequired
        classIsSurplusMap.set(cs.id, isSurplusClass)

        // Mark teachers active in this class
        const currentTeachers = [...activeBaseTeachers, ...substitutes.map(s => s.profesor!)]

        currentTeachers.forEach(teacher => {
            if (!teacher) return // Safety check
            busyTeacherIds.add(teacher.id) // They are BUSY here

            if (!teacherClassesMap.has(teacher.id)) {
                teacherClassesMap.set(teacher.id, [])
            }
            teacherClassesMap.get(teacher.id)!.push(cs)
        })
    }

    // 6. Categorize Candidates
    const results: SubstitutionCandidates = {
        priority1_leftover: [], // Group 1: Surplus (Can be moved)
        priority2_free: [],     // Group 2: Free (Off Schedule)
        priority3_creative: [], // Group 3: Busy (Critical - Should not move)
        priority4_absent: []    // Group 4: Absent/Moved (Inactive in slot, not active elsewhere)
    }

    allTeachers.forEach(teacher => {
        // Exclude the absent teacher themselves from the list
        if (teacher.id === absentTeacherId) return

        const myClasses = teacherClassesMap.get(teacher.id) || []

        // FORMAT classes for return (Avoids circular references and ensures UI gets simple strings)
        const formattedClasses = myClasses.map(cs => ({
            schoolName: cs.clase.escuela?.nombre || 'Unknown School',
            subjectName: cs.clase.asignatura?.nombre || 'Unknown Subject'
        }))

        // LOGIC RE-CLASSIFICATION
        if (busyTeacherIds.has(teacher.id)) {
            // Teacher is ACTIVE in at least one class
            // Check Prioritization (Surplus vs Creative)

            // If ANY class is Critical (not surplus), the teacher is CRITICAL (P3).
            // Only if ALL their classes are surplus, are they surplus (P1).
            const isAnyCritical = myClasses.some(cs => !classIsSurplusMap.get(cs.id))

            if (isAnyCritical) {
                results.priority3_creative.push({
                    teacher,
                    currentClasses: formattedClasses
                })
            } else {
                results.priority1_leftover.push({
                    teacher,
                    currentClasses: formattedClasses
                })
            }
        } else if (inactiveTeacherIds.has(teacher.id)) {
            // Teacher is NOT active, but has an INACTIVE record (Absent/Moved) -> P4
            results.priority4_absent.push({
                teacher,
                currentClasses: [] // No active classes to show
            })
        } else {
            // Teacher is NOT active and NOT inactive -> Completely Free -> P2
            results.priority2_free.push({
                teacher,
                currentClasses: []
            })
        }
    })

    // Sort logic
    const sortByName = (a: SubstitutionCandidate, b: SubstitutionCandidate) =>
        a.teacher.nombre.localeCompare(b.teacher.nombre)

    const sortBySchoolThenName = (a: SubstitutionCandidate, b: SubstitutionCandidate) => {
        // Safe access to school name
        const schoolA = a.currentClasses[0]?.schoolName || ''
        const schoolB = b.currentClasses[0]?.schoolName || ''

        const schoolCompare = schoolA.localeCompare(schoolB)

        // Primary Sort: School Name
        if (schoolCompare !== 0) return schoolCompare

        // Secondary Sort: Teacher Name
        return a.teacher.nombre.localeCompare(b.teacher.nombre)
    }

    results.priority1_leftover.sort(sortBySchoolThenName)
    results.priority2_free.sort(sortByName)
    results.priority3_creative.sort(sortBySchoolThenName)
    results.priority4_absent.sort(sortByName) // Sort absents by name

    return results
}

export async function applySubstitution(
    claseSemanaId: string,
    absentTeacherId: string,
    substituteTeacherId: string
) {
    return await db.$transaction(async (tx) => {
        // 1. Mark absent teacher as inactive in the target class
        // Check if an assignment record exists
        const existingAssignment = await tx.asignacionProfesor.findFirst({
            where: {
                claseSemanaId,
                profesorId: absentTeacherId
            }
        })

        if (existingAssignment) {
            // Update existing record
            await tx.asignacionProfesor.update({
                where: { id: existingAssignment.id },
                data: { activo: false }
            })
        } else {
            // Create "Exception" record (Base teacher marked absent)
            await tx.asignacionProfesor.create({
                data: {
                    claseSemanaId,
                    profesorId: absentTeacherId,
                    tipo: 'PERMANENTE', // They are still the perm teacher, just absent
                    origen: 'BASE',
                    activo: false
                }
            })
        }

        // 2. Check if Substitute has an overlapping active class
        const targetClass = await tx.claseSemana.findUnique({
            where: { id: claseSemanaId },
            include: {
                clase: {
                    include: {
                        asignatura: true
                    }
                }
            }
        })

        if (!targetClass) throw new Error("Target class not found")

        // Helper for time math
        const getMins = (d: Date) => {
            const date = new Date(d)
            return date.getUTCHours() * 60 + date.getUTCMinutes()
        }
        const startTarget = getMins(targetClass.clase.horaInicio)
        const endTarget = getMins(targetClass.clase.horaFin)

        // Find ALL classes this teacher might be in (Base OR Assigned)
        // We look for ClassSemanas in the same week/day where they are Base OR have an assignment
        const potentialConflicts = await tx.claseSemana.findMany({
            where: {
                semanaId: targetClass.semanaId,
                clase: {
                    diaSemana: targetClass.clase.diaSemana
                },
                OR: [
                    { clase: { profesoresBase: { some: { id: substituteTeacherId } } } },
                    { asignacionesProfesor: { some: { profesorId: substituteTeacherId, activo: true } } }
                ]
            },
            include: {
                clase: { include: { asignatura: true } },
                asignacionesProfesor: true
            }
        })

        for (const cs of potentialConflicts) {
            // Check Time Overlap
            const startAssign = getMins(cs.clase.horaInicio)
            const endAssign = getMins(cs.clase.horaFin)

            if (Math.max(startTarget, startAssign) < Math.min(endTarget, endAssign)) {
                // It's a collision. Ensure they are actually active in this class.
                // If they are Base, check if they have an "Inactive" exception.
                // If they are Substitute, check if they are Active.

                const exception = cs.asignacionesProfesor.find(ap => ap.profesorId === substituteTeacherId && ap.origen === 'BASE')
                const activeAssignment = cs.asignacionesProfesor.find(ap => ap.profesorId === substituteTeacherId && ap.activo === true)
                const isBase = cs.asignacionesProfesor.length === 0 || !!exception // Rough check, improved below

                // Precise Check:
                // They are effectively active IF:
                // 1. (They are Base AND NO "inactive" exception exists)
                // 2. OR (They have an Active assignment)

                // We know they are EITHER Base OR have Assignment from the query.
                // Let's refine:
                // Is there an explicit "Absent" record?
                const isMarkedAbsent = cs.asignacionesProfesor.some(ap =>
                    ap.profesorId === substituteTeacherId && ap.origen === 'BASE' && !ap.activo
                )

                if (!isMarkedAbsent) {
                    // They are active here! We must pull them out.

                    // Upsert "Moved" Exception
                    const existing = cs.asignacionesProfesor.find(ap => ap.profesorId === substituteTeacherId)

                    if (existing) {
                        await tx.asignacionProfesor.update({
                            where: { id: existing.id },
                            data: { activo: false }
                        })
                    } else {
                        // They were Base with no record => Create Exception
                        await tx.asignacionProfesor.create({
                            data: {
                                claseSemanaId: cs.id,
                                profesorId: substituteTeacherId,
                                tipo: 'PERMANENTE',
                                origen: 'BASE',
                                activo: false
                            }
                        })
                    }

                    // Log the movement
                    await tx.registroCambio.create({
                        data: {
                            claseSemanaId: cs.id,
                            profesorSalienteId: substituteTeacherId,
                            profesorEntranteId: null,
                            motivo: `Movido a ${targetClass.clase.asignatura.nombre}`,
                            fechaCambio: new Date()
                        }
                    })
                }
            }
        }

        // 3. Create new assignment
        const newAssignment = await tx.asignacionProfesor.create({
            data: {
                claseSemanaId,
                profesorId: substituteTeacherId,
                tipo: 'TEMPORAL',
                origen: 'SUSTITUCION',
                activo: true
            },
            include: {
                profesor: true
            }
        })

        // 4. Log Change in Target Class
        await tx.registroCambio.create({
            data: {
                claseSemanaId,
                profesorSalienteId: absentTeacherId,
                profesorEntranteId: substituteTeacherId,
                motivo: 'Sustitución Manual',
                fechaCambio: new Date()
            }
        })

    })
}

export async function getWeeklyIncidents(semanaId: string) {
    const rawIncidents = await db.registroCambio.findMany({
        where: {
            claseSemana: {
                semanaId: semanaId
            }
        },
        include: {
            claseSemana: {
                include: {
                    clase: {
                        include: {
                            escuela: true,
                            asignatura: true
                        }
                    }
                }
            },
            profesorSaliente: true,
            profesorEntrante: true
        },
        orderBy: {
            fechaCambio: 'desc'
        }
    })

    // Grouping Logic
    const handledIds = new Set<string>()
    const consolidatedIncidents = []

    for (const inc of rawIncidents) {
        if (handledIds.has(inc.id)) continue

        // Is it a Substitution? (Has Entrante)
        if (inc.profesorEntranteId) {
            // Check for associated Movement
            // Conditions:
            // 1. Same Teacher (Saliente of movement == Entrante of sub)
            // 2. "Movido" in motif
            // 3. Same Week (guaranteed by query)
            // 4. Ideally same time block (approx)

            const subTeacherId = inc.profesorEntranteId
            const subTime = getMinutesInDay(inc.claseSemana.clase.horaInicio)

            // Find valid movement in the raw list
            const movementRecord = rawIncidents.find(r =>
                !handledIds.has(r.id) &&
                r.profesorSalienteId === subTeacherId &&
                r.motivo.includes('Movido') &&
                Math.abs(getMinutesInDay(r.claseSemana.clase.horaInicio) - subTime) < 180 // Within 3 hours
            )

            if (movementRecord) {
                handledIds.add(movementRecord.id)
            }

            // Create Consolidated Record
            consolidatedIncidents.push({
                id: inc.id, // Main ID for Revert
                type: 'SUBSTITUTION',
                timestamp: inc.claseSemana.clase.horaInicio,
                targetClass: {
                    schoolName: inc.claseSemana.clase.escuela.nombre,
                    subjectName: inc.claseSemana.clase.asignatura.nombre,
                    time: inc.claseSemana.clase.horaInicio
                },
                profesorSaliente: inc.profesorSaliente,
                profesorEntrante: inc.profesorEntrante,
                originClass: movementRecord ? {
                    schoolName: movementRecord.claseSemana.clase.escuela.nombre,
                    subjectName: movementRecord.claseSemana.clase.asignatura.nombre
                } : null,
                fechaCambio: inc.fechaCambio
            })

            handledIds.add(inc.id)
        }
        // Is it a standalone Absence? (No Entrante, Not "Movido")
        else if (!inc.motivo.includes('Movido')) {
            consolidatedIncidents.push({
                id: inc.id,
                type: 'ABSENCE',
                timestamp: inc.claseSemana.clase.horaInicio,
                targetClass: {
                    schoolName: inc.claseSemana.clase.escuela.nombre,
                    subjectName: inc.claseSemana.clase.asignatura.nombre,
                    time: inc.claseSemana.clase.horaInicio
                },
                profesorSaliente: inc.profesorSaliente,
                profesorEntrante: null,
                originClass: null,
                fechaCambio: inc.fechaCambio
            })
            handledIds.add(inc.id)
        }
        // Structural Changes (Config updates)
        else if (!inc.profesorSalienteId && !inc.profesorEntranteId) {
            consolidatedIncidents.push({
                id: inc.id,
                type: 'STRUCTURAL',
                timestamp: inc.fechaCambio, // Use log time
                targetClass: {
                    schoolName: inc.claseSemana.clase.escuela.nombre,
                    subjectName: inc.claseSemana.clase.asignatura.nombre,
                    time: inc.claseSemana.clase.horaInicio
                },
                motivo: inc.motivo,
                fechaCambio: inc.fechaCambio,
                profesorSaliente: null,
                profesorEntrante: null,
                originClass: null
            })
            handledIds.add(inc.id)
        }
    }

    return consolidatedIncidents
}

export async function revertChange(registroId: string) {
    return await db.$transaction(async (tx) => {
        const registro = await tx.registroCambio.findUnique({
            where: { id: registroId },
            include: {
                claseSemana: {
                    include: {
                        clase: true
                    }
                }
            }
        })

        if (!registro) throw new Error("Incident not found")

        // 1. If it involves an Incoming Teacher (Substitution)
        if (registro.profesorEntranteId) {
            const substituteId = registro.profesorEntranteId

            // A. Remove the Substitute's assignment in THIS class
            const subAssignment = await tx.asignacionProfesor.findFirst({
                where: {
                    claseSemanaId: registro.claseSemanaId,
                    profesorId: substituteId,
                    tipo: 'TEMPORAL',
                    activo: true
                }
            })

            if (subAssignment) {
                await tx.asignacionProfesor.delete({
                    where: { id: subAssignment.id }
                })
            }

            // B. Restore the Saliente (Absent) Teacher in THIS class
            if (registro.profesorSalienteId) {
                const absentAssignment = await tx.asignacionProfesor.findFirst({
                    where: {
                        claseSemanaId: registro.claseSemanaId,
                        profesorId: registro.profesorSalienteId,
                        // Could be BASE or PERMANENTE
                        activo: false
                    }
                })

                if (absentAssignment) {
                    await tx.asignacionProfesor.update({
                        where: { id: absentAssignment.id },
                        data: { activo: true }
                    })
                }
            }

            // C. Smart Revert: Restore Substitute to Origin
            // Look for "Movido" records for this teacher in the same week
            const currentDay = registro.claseSemana.clase.diaSemana

            const movedRecords = await tx.registroCambio.findMany({
                where: {
                    profesorSalienteId: substituteId,
                    motivo: { contains: 'Movido' },
                    claseSemana: {
                        semanaId: registro.claseSemana.semanaId,
                        clase: {
                            diaSemana: currentDay
                        }
                    }
                },
                include: { claseSemana: { include: { clase: true } } }
            })

            // Restore ALL found movements for this slot (Collision handling implies one, but be safe)
            for (const move of movedRecords) {
                // Restore them in their origin class
                const originAssignment = await tx.asignacionProfesor.findFirst({
                    where: {
                        claseSemanaId: move.claseSemanaId,
                        profesorId: substituteId,
                        activo: false
                    }
                })

                if (originAssignment) {
                    await tx.asignacionProfesor.update({
                        where: { id: originAssignment.id },
                        data: { activo: true }
                    })
                }

                // Delete the movement log
                await tx.registroCambio.delete({
                    where: { id: move.id }
                })
            }
        }
        // 2. If it's just a simple Absence record
        else if (registro.profesorSalienteId) {
            const assignment = await tx.asignacionProfesor.findFirst({
                where: {
                    claseSemanaId: registro.claseSemanaId,
                    profesorId: registro.profesorSalienteId,
                    activo: false
                }
            })

            if (assignment) {
                await tx.asignacionProfesor.update({
                    where: { id: assignment.id },
                    data: { activo: true }
                })
            }
        }

        // 3. Delete the Incident Record itself
        await tx.registroCambio.delete({
            where: { id: registroId }
        })

        return { success: true }
    })
}
