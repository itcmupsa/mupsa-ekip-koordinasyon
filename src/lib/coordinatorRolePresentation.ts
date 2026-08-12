export interface CoordinatorRolePresentation {
  shortLabel: string
  dotClass: string
  softClass: string
  selectedClass: string
  calendarBadgeClass: string
}

const rolePresentations: Record<string, Omit<CoordinatorRolePresentation, 'shortLabel'>> = {
  president: {
    dotClass: 'bg-rose-600',
    softClass: 'border-rose-200 bg-rose-50 text-rose-800',
    selectedClass: 'border-rose-500 bg-rose-100 text-rose-900',
    calendarBadgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
  },
  'epsa-communication-secretary': {
    dotClass: 'bg-indigo-600',
    softClass: 'border-indigo-200 bg-indigo-50 text-indigo-800',
    selectedClass: 'border-indigo-500 bg-indigo-100 text-indigo-900',
    calendarBadgeClass: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  },
  'general-secretary': {
    dotClass: 'bg-slate-600',
    softClass: 'border-slate-200 bg-slate-50 text-slate-800',
    selectedClass: 'border-slate-500 bg-slate-100 text-slate-900',
    calendarBadgeClass: 'border-slate-200 bg-slate-50 text-slate-800',
  },
  treasurer: {
    dotClass: 'bg-amber-600',
    softClass: 'border-amber-200 bg-amber-50 text-amber-800',
    selectedClass: 'border-amber-500 bg-amber-100 text-amber-900',
    calendarBadgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  },
  'twinnet-coordinator': {
    dotClass: 'bg-fuchsia-600',
    softClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
    selectedClass: 'border-fuchsia-500 bg-fuchsia-100 text-fuchsia-900',
    calendarBadgeClass: 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800',
  },
  'public-relations-coordinator': {
    dotClass: 'bg-pink-600',
    softClass: 'border-pink-200 bg-pink-50 text-pink-800',
    selectedClass: 'border-pink-500 bg-pink-100 text-pink-900',
    calendarBadgeClass: 'border-pink-200 bg-pink-50 text-pink-800',
  },
  'public-health-coordinator': {
    dotClass: 'bg-emerald-600',
    softClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    selectedClass: 'border-emerald-500 bg-emerald-100 text-emerald-900',
    calendarBadgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  },
  'project-and-education-coordinator': {
    dotClass: 'bg-blue-600',
    softClass: 'border-blue-200 bg-blue-50 text-blue-800',
    selectedClass: 'border-blue-500 bg-blue-100 text-blue-900',
    calendarBadgeClass: 'border-blue-200 bg-blue-50 text-blue-800',
  },
  'social-events-coordinator': {
    dotClass: 'bg-orange-600',
    softClass: 'border-orange-200 bg-orange-50 text-orange-800',
    selectedClass: 'border-orange-500 bg-orange-100 text-orange-900',
    calendarBadgeClass: 'border-orange-200 bg-orange-50 text-orange-800',
  },
  'social-responsibility-coordinator': {
    dotClass: 'bg-cyan-600',
    softClass: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    selectedClass: 'border-cyan-500 bg-cyan-100 text-cyan-900',
    calendarBadgeClass: 'border-cyan-200 bg-cyan-50 text-cyan-800',
  },
  'logistics-coordinator': {
    dotClass: 'bg-lime-700',
    softClass: 'border-lime-200 bg-lime-50 text-lime-800',
    selectedClass: 'border-lime-600 bg-lime-100 text-lime-900',
    calendarBadgeClass: 'border-lime-200 bg-lime-50 text-lime-800',
  },
  'press-and-publication-coordinator': {
    dotClass: 'bg-violet-600',
    softClass: 'border-violet-200 bg-violet-50 text-violet-800',
    selectedClass: 'border-violet-500 bg-violet-100 text-violet-900',
    calendarBadgeClass: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  'information-technologies-coordinator': {
    dotClass: 'bg-sky-600',
    softClass: 'border-sky-200 bg-sky-50 text-sky-800',
    selectedClass: 'border-sky-500 bg-sky-100 text-sky-900',
    calendarBadgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
  },
  'design-coordinator': {
    dotClass: 'bg-purple-600',
    softClass: 'border-purple-200 bg-purple-50 text-purple-800',
    selectedClass: 'border-purple-500 bg-purple-100 text-purple-900',
    calendarBadgeClass: 'border-purple-200 bg-purple-50 text-purple-800',
  },
}

const fallbackPresentations = [
  rolePresentations['public-health-coordinator'],
  rolePresentations['project-and-education-coordinator'],
  rolePresentations['social-events-coordinator'],
  rolePresentations['information-technologies-coordinator'],
]

export function shortCoordinatorRoleName(name: string): string {
  return name
    .replace(/\s+Koordinatörü$/i, '')
    .replace(/^Bilişim Teknolojileri$/i, 'Bilişim Tekno.')
}

export function coordinatorRolePresentation(slug: string | null, name = ''): CoordinatorRolePresentation {
  const hash = [...(slug ?? name)].reduce((total, character) => total + character.charCodeAt(0), 0)
  const presentation = (slug && rolePresentations[slug]) || fallbackPresentations[hash % fallbackPresentations.length]
  return { ...presentation, shortLabel: shortCoordinatorRoleName(name) }
}
