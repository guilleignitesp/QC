'use server'

import { getSubstitutionCandidates, applySubstitution } from '@/services/substitution'
import { revalidatePath } from 'next/cache'

export async function getCandidatesAction(claseSemanaId: string, absentTeacherId: string) {
    try {
        const candidates = await getSubstitutionCandidates(claseSemanaId, absentTeacherId)
        // Server Actions can return complex objects, Next.js handles serialization
        return { success: true, data: candidates }
    } catch (error: any) {
        console.error('Error fetching candidates:', error)
        return { success: false, error: error.message }
    }
}

export async function applySubstitutionAction(
    claseSemanaId: string,
    absentTeacherId: string,
    substituteTeacherId: string
) {
    try {
        const result = await applySubstitution(claseSemanaId, absentTeacherId, substituteTeacherId)
        revalidatePath('/dashboard') // Refresh dashboard data immediately

        // Ensure we return a clean object as requested
        const anyResult = result as any;
        const teacherName = anyResult?.profesor?.nombre || 'Profesor';
        return {
            success: true,
            teacherName,
            message: 'Substitution applied successfully'
        }
    } catch (error: any) {
        console.error('Error applying substitution:', error)
        return { success: false, error: error.message }
    }
}

import { applyReinforcement } from '@/services/substitution'

export async function applyReinforcementAction(
    claseSemanaId: string,
    teacherId: string
) {
    try {
        await applyReinforcement(claseSemanaId, teacherId)
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        console.error('Error applying reinforcement:', error)
        return { success: false, error: error.message }
    }
}

export async function getAvailableTeachersForRefuerzoAction(claseSemanaId: string) {
    try {
        // Call without absentTeacherId to get all available candidates
        const candidates = await getSubstitutionCandidates(claseSemanaId)
        return { success: true, data: candidates }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

import { markTeacherAsAbsent } from '@/services/substitution'

export async function markStandaloneAbsenceAction(
    claseSemanaId: string,
    profesorId: string
) {
    try {
        await markTeacherAsAbsent(claseSemanaId, profesorId)
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        console.error('Error marking absence:', error)
        return { success: false, error: error.message }
    }
}

import { getWeeklyIncidents, revertChange } from '@/services/substitution'

export async function getIncidentsAction(semanaId: string) {
    try {
        const incidents = await getWeeklyIncidents(semanaId)
        return { success: true, data: incidents }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

import { updateClaseTemplate, getAllTeachers, getAvailableTeachersForTemplate, createTeacher } from '@/services/schedule'

export async function createTeacherAction(nombre: string) {
    try {
        await createTeacher(nombre)
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        console.error('Error creating teacher:', error)
        return { success: false, error: error.message }
    }
}

export async function getAllTeachersAction() {
    try {
        const teachers = await getAllTeachers()
        return { success: true, data: teachers }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function getTemplateCandidatesAction(claseId: string) {
    try {
        const candidates = await getAvailableTeachersForTemplate(claseId)
        return { success: true, data: candidates }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function updateTemplateAction(
    claseId: string,
    minProfesores: number,
    profesoresBaseIds: string[],
    claseSemanaId?: string
) {
    try {
        await updateClaseTemplate(claseId, minProfesores, profesoresBaseIds, claseSemanaId)
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

export async function revertIncidentAction(registroId: string) {
    try {
        await revertChange(registroId)
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}

import { toggleIncidentConfirmation } from '@/services/substitution'

export async function toggleIncidentAction(id: string, status: boolean) {
    try {
        await toggleIncidentConfirmation(id, status)
        revalidatePath('/dashboard')
        return { success: true }
    } catch (error: any) {
        return { success: false, error: error.message }
    }
}
