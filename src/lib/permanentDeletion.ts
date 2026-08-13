import { supabase } from './supabaseClient'

export interface PermanentDeletionResult {
  cleanupWarning: string | null
}

async function removeStoredFiles(paths: string[]): Promise<string | null> {
  const uniquePaths = [...new Set(paths.filter(Boolean))]
  for (let index = 0; index < uniquePaths.length; index += 100) {
    const { error } = await supabase.storage.from('event-files').remove(uniquePaths.slice(index, index + 100))
    if (error) return 'Kayıt silindi ancak bağlı dosyalardan bazıları depolamadan temizlenemedi.'
  }
  return null
}

async function taskFilePaths(taskIds: string[]): Promise<string[]> {
  if (taskIds.length === 0) return []
  const { data, error } = await supabase.from('event_files').select('storage_path').in('task_id', taskIds)
  if (error) throw new Error('Bağlı dosyalar kontrol edilemedi. Silme işlemi başlatılmadı.')
  return (data ?? []).map((row) => row.storage_path as string)
}

export async function deleteEventPermanently(eventId: string): Promise<PermanentDeletionResult> {
  const [eventFiles, tasks] = await Promise.all([
    supabase.from('event_files').select('storage_path').eq('event_id', eventId),
    supabase.from('tasks').select('id').eq('event_id', eventId),
  ])
  if (eventFiles.error || tasks.error) throw new Error('Etkinliğe bağlı kayıtlar kontrol edilemedi. Silme işlemi başlatılmadı.')
  const taskIds = (tasks.data ?? []).map((row) => row.id as string)
  const paths = [...(eventFiles.data ?? []).map((row) => row.storage_path as string), ...(await taskFilePaths(taskIds))]
  const { error } = await supabase.rpc('permanently_delete_event', { target_event_id: eventId })
  if (error) throw new Error(error.message)
  return { cleanupWarning: await removeStoredFiles(paths) }
}

export async function deleteTaskPermanently(taskId: string): Promise<PermanentDeletionResult> {
  const paths = await taskFilePaths([taskId])
  const { error } = await supabase.rpc('permanently_delete_task', { target_task_id: taskId })
  if (error) throw new Error(error.message)
  return { cleanupWarning: await removeStoredFiles(paths) }
}

export async function deleteAwarenessPostPermanently(awarenessPostId: string): Promise<PermanentDeletionResult> {
  const { data: tasks, error: taskError } = await supabase.from('tasks').select('id').eq('awareness_post_id', awarenessPostId)
  if (taskError) throw new Error('Farkındalığa bağlı görevler kontrol edilemedi. Silme işlemi başlatılmadı.')
  const paths = await taskFilePaths((tasks ?? []).map((row) => row.id as string))
  const { error } = await supabase.rpc('permanently_delete_awareness_post', { target_awareness_post_id: awarenessPostId })
  if (error) throw new Error(error.message)
  return { cleanupWarning: await removeStoredFiles(paths) }
}

export async function deleteCalendarEntryPermanently(calendarEntryId: string): Promise<PermanentDeletionResult> {
  const { error } = await supabase.rpc('permanently_delete_calendar_entry', { target_calendar_entry_id: calendarEntryId })
  if (error) throw new Error(error.message)
  return { cleanupWarning: null }
}
