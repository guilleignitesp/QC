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
        const teacherName = result?.profesor?.nombre || 'Profesor'
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

import { getWeeklyIncidents, revertChange } from '@/services/substitution'

export async function getIncidentsAction(semanaId: string) {
    try {
        const incidents = await getWeeklyIncidents(semanaId)
        return { success: true, data: incidents }
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
