import { useState, useEffect } from 'react'
import { getCandidatesAction, applySubstitutionAction, updateTemplateAction, getAllTeachersAction, getTemplateCandidatesAction } from '@/app/actions/substitution'
import { X, User, AlertCircle, CheckCircle, Loader2, Settings, Users, Save, Clock } from 'lucide-react'

type Props = {
    isOpen: boolean
    onClose: () => void
    claseSemana: any
    currentTeachers: any[]
}

export default function SubstitutionDrawer({ isOpen, onClose, claseSemana, currentTeachers }: Props) {
    // Tab State
    const [activeTab, setActiveTab] = useState<'substitution' | 'settings'>('substitution')

    // Substitution State
    const [selectedAbsentId, setSelectedAbsentId] = useState<string | null>(null)
    const [candidates, setCandidates] = useState<any | null>(null)
    const [loading, setLoading] = useState(false)
    const [processing, setProcessing] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Template Settings State
    const [allTeachers, setAllTeachers] = useState<any[]>([])
    const [minTeachers, setMinTeachers] = useState(1)
    const [selectedBaseIds, setSelectedBaseIds] = useState<string[]>([])
    const [settingsLoading, setSettingsLoading] = useState(false)

    // Reset and Load Data
    useEffect(() => {
        if (!isOpen) {
            // Reset
            setActiveTab('substitution')
            setSelectedAbsentId(null)
            setCandidates(null)
            setSuccess(false)
            setLoading(false)
        } else {
            // Initialize Settings from Props
            if (claseSemana?.clase) {
                setMinTeachers(claseSemana.clase.profesoresMinimos || 1)
                // Extract IDs from profesoresBase (Template)
                const baseIds = claseSemana.clase.profesoresBase?.map((p: any) => p.id) || []
                setSelectedBaseIds(baseIds)
            }

            // Load All Teachers for Settings
            // Load Template Candidates (with conflict info)
            getTemplateCandidatesAction(claseSemana.clase.id).then(res => {
                if (res.success) setAllTeachers(res.data)
            })
        }
    }, [isOpen, claseSemana?.id])

    if (!isOpen) return null

    // --- SUBSTITUTION HANDLERS ---
    const handleSelectAbsent = async (teacherId: string) => {
        setSelectedAbsentId(teacherId)
        setLoading(true)
        setCandidates(null)

        const res = await getCandidatesAction(claseSemana.id, teacherId)
        if (res.success) {
            setCandidates(res.data)
        } else {
            alert('Error loading candidates')
        }
        setLoading(false)
    }

    const handleApply = async (substituteId: string) => {
        if (!selectedAbsentId) return
        setProcessing(substituteId)

        const res = await applySubstitutionAction(claseSemana.id, selectedAbsentId, substituteId)

        if (res.success) {
            setSuccess(true)
            setTimeout(() => {
                onClose()
                setSuccess(false)
                setSelectedAbsentId(null)
                setCandidates(null)
            }, 1000)
        } else {
            alert('Failed: ' + (res.error || 'Unknown error'))
        }
        setProcessing(null)
    }

    // --- TEMPLATE HANDLERS ---
    const toggleBaseTeacher = (teacherId: string) => {
        setSelectedBaseIds(prev =>
            prev.includes(teacherId)
                ? prev.filter(id => id !== teacherId)
                : [...prev, teacherId]
        )
    }

    const handleSaveTemplate = async () => {
        setSettingsLoading(true)
        const res = await updateTemplateAction(claseSemana.clase.id, minTeachers, selectedBaseIds, claseSemana.id)
        if (res.success) {
            setSuccess(true)
            setTimeout(() => {
                setSuccess(false)
                // Stay on settings or close? Maybe close to see dashboard update
                onClose()
            }, 1000)
        } else {
            alert('Error updating template: ' + res.error)
        }
        setSettingsLoading(false)
    }


    // --- RENDER HELPERS ---
    const CandidateList = ({ title, list, color, disabled }: any) => {
        if (!list || list.length === 0) return null
        return (
            <div className={`mb-6 ${disabled ? 'opacity-50 grayscale pointer-events-none' : ''}`}>
                <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 ${color}`}>{title}</h4>
                <div className="space-y-2">
                    {list.map((item: any) => {
                        const teacher = item.teacher
                        const classes = item.currentClasses || []
                        let details = classes.length > 0
                            ? classes.map((c: any) => `${c.schoolName.toUpperCase()} - ${c.subjectName}`).join(' / ')
                            : (disabled ? 'No disponible' : 'Descansando')

                        if (title.includes('Ausentes')) details = 'Ausente / Movido'

                        return (
                            <div key={teacher.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex-shrink-0 flex items-center justify-center text-xs font-bold text-slate-600">
                                        {teacher.nombre.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="font-bold text-slate-800 text-sm truncate">{teacher.nombre}</div>
                                        <div className="text-xs text-slate-500 truncate" title={details}>{details}</div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (color.includes('amber') && classes.length > 0) {
                                            if (!confirm(`⚠️ ${teacher.nombre} está en ${classes.length} clase(s) crítica(s). ¿Mover de todas formas?`)) return
                                        }
                                        handleApply(teacher.id)
                                    }}
                                    disabled={!!processing || disabled}
                                    className={`flex-shrink-0 px-3 py-1.5 text-white text-xs font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed
                                        ${disabled ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'}
                                    `}
                                >
                                    {processing === teacher.id ? <Loader2 className="w-4 h-4 animate-spin" /> : (disabled ? 'N/A' : 'Select')}
                                </button>
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={onClose}></div>

            {/* Drawer */}
            <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

                {/* Header */}
                <div className="p-6 pb-2 bg-white flex-shrink-0 z-10">
                    <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">
                        {claseSemana.clase.asignatura.nombre}
                    </h2>
                    <p className="text-sm text-slate-500 mb-4">
                        {new Date(claseSemana.clase.horaInicio).toLocaleTimeString([], { timeStyle: 'short' })} • {claseSemana.clase.escuela.nombre}
                    </p>

                    {/* Tabs */}
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        <button
                            onClick={() => setActiveTab('substitution')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all
                                ${activeTab === 'substitution' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}
                            `}
                        >
                            <Users className="w-4 h-4" />
                            Sustitución
                        </button>
                        <button
                            onClick={() => setActiveTab('settings')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all
                                ${activeTab === 'settings' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}
                            `}
                        >
                            <Settings className="w-4 h-4" />
                            Ajustes de Clase
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 scroll-smooth">
                    {success ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center animate-in fade-in zoom-in">
                            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                                <CheckCircle className="w-8 h-8 text-green-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">Cambios Guardados</h3>
                            <p className="text-slate-500 text-sm">El dashboard se ha actualizado.</p>
                        </div>
                    ) : (
                        <>
                            {/* VIEW: SUSTITUCION */}
                            {activeTab === 'substitution' && (
                                <div className="animate-in fade-in slide-in-from-left duration-300">
                                    {/* Step 1: Select Absent */}
                                    <div className="mb-8">
                                        <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4 text-rose-500" />
                                            ¿Quién falta?
                                        </h3>
                                        <div className="grid grid-cols-1 gap-2">
                                            {currentTeachers.map((assign: any) => (
                                                <button
                                                    key={assign.id}
                                                    onClick={() => handleSelectAbsent(assign.profesor.id)}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                                                        ${selectedAbsentId === assign.profesor.id
                                                            ? 'border-rose-500 bg-rose-50 ring-1 ring-rose-500'
                                                            : 'border-slate-200 hover:border-slate-400 bg-white'}
                                                    `}
                                                >
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                                                        ${selectedAbsentId === assign.profesor.id ? 'bg-rose-200 text-rose-800' : 'bg-slate-100 text-slate-600'}
                                                    `}>
                                                        {assign.profesor.nombre.substring(0, 2)}
                                                    </div>
                                                    <span className={`font-medium ${selectedAbsentId === assign.profesor.id ? 'text-rose-900' : 'text-slate-700'}`}>
                                                        {assign.profesor.nombre}
                                                    </span>
                                                </button>
                                            ))}
                                            {currentTeachers.length === 0 && (
                                                <div className="p-4 bg-slate-50 rounded-xl text-center text-slate-400 text-sm">
                                                    No hay profesores asignados.
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Step 2: Candidates */}
                                    {loading && (
                                        <div className="flex justify-center py-8">
                                            <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
                                        </div>
                                    )}

                                    {candidates && (
                                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <div className="border-t border-slate-100 my-6"></div>
                                            <h3 className="text-sm font-bold text-slate-900 mb-4">Candidatos Disponibles</h3>
                                            <CandidateList title="Profesores Sobrantes" list={candidates.priority1_leftover} color="text-emerald-600" />
                                            <CandidateList title="Fuera de Horario / Libres" list={candidates.priority2_free} color="text-slate-500" />
                                            <CandidateList title="Profesores Ocupados (Críticos)" list={candidates.priority3_creative} color="text-amber-600" />
                                            <CandidateList title="Profesores Ausentes / Movidos" list={candidates.priority4_absent} color="text-rose-400" disabled={true} />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* VIEW: ADJUSTES */}
                            {activeTab === 'settings' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-right duration-300 pb-20">
                                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-2">
                                        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                        <p>Atención: Estos cambios modifican la <strong>Plantilla Base</strong> de la clase y afectarán a todas las semanas futuras.</p>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Mínimo de Profesores
                                        </label>
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="number"
                                                min="0"
                                                max="10"
                                                value={minTeachers}
                                                onChange={(e) => setMinTeachers(parseInt(e.target.value) || 0)}
                                                className="w-20 p-2 border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:ring-2 focus:ring-slate-500 outline-none"
                                            />
                                            <span className="text-sm text-slate-500">profesores requeridos</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">
                                            Profesores Base (Plantilla)
                                        </label>
                                        <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto">
                                            {allTeachers.map(teacher => {
                                                const isSelected = selectedBaseIds.includes(teacher.id)
                                                const isBusy = teacher.isBusy
                                                // Disable if busy checks out, unless it's already selected (allowing unselect)
                                                // Logic: If busy=true, disabled=true. BUT if selected=true, disabled=false (to allow removal).
                                                // So disabled = isBusy && !isSelected
                                                const disabled = isBusy && !isSelected

                                                return (
                                                    <button
                                                        key={teacher.id}
                                                        onClick={() => toggleBaseTeacher(teacher.id)}
                                                        disabled={disabled}
                                                        className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all w-full
                                                            ${isSelected
                                                                ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500'
                                                                : (disabled ? 'border-slate-200 bg-slate-50 opacity-60 border-dashed cursor-not-allowed' : 'border-slate-200 hover:border-slate-300 bg-white')}
                                                        `}
                                                    >
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold
                                                                ${isSelected ? 'bg-indigo-200 text-indigo-800' : 'bg-slate-100 text-slate-600'}
                                                            `}>
                                                                {teacher.nombre.substring(0, 2)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className={`block font-medium truncate ${isSelected ? 'text-indigo-900' : 'text-slate-700'}`}>
                                                                    {teacher.nombre}
                                                                </span>
                                                                {isBusy && (
                                                                    <div className="flex items-center gap-1 mt-0.5 text-xs text-rose-600 font-medium">
                                                                        <Clock className="w-3 h-3 flex-shrink-0" />
                                                                        <span className="truncate">
                                                                            Ocupado: {teacher.conflictDetails?.school} ({teacher.conflictDetails?.time})
                                                                        </span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {isSelected && <CheckCircle className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-1.5" />}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Footer Actions for Settings */}
                {activeTab === 'settings' && !success && (
                    <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0">
                        <button
                            onClick={handleSaveTemplate}
                            disabled={settingsLoading}
                            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                        >
                            {settingsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Guardar Cambios Permanentes
                        </button>
                    </div>
                )}

            </div>
        </div>
    )
}
