import { useCallback, useEffect, useState } from 'react';
import { initializeCoordinatorAttendanceDefaults, listCoordinatorAttendance, saveCoordinatorAttendance } from '../api/attendance';
import { listCoordinators } from '../api/coordinators';
import type { AttendanceRecord, Coordinator } from '../types';

const today = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return parts;
};

export function CoordinatorAttendancePage() {
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [pcId, setPcId] = useState('');
  const [date, setDate] = useState(today);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statuses, setStatuses] = useState<Record<string, 'P' | 'A'>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savedByCoordinator, setSavedByCoordinator] = useState<Record<string, AttendanceRecord>>({});
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    listCoordinators({ page_size: 1000, is_active: true })
      .then((result) => { setCoordinators(result.coordinators); })
      .catch(() => setError('Could not load project coordinators.'));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!dateFrom && !dateTo && date === today()) {
        await initializeCoordinatorAttendanceDefaults(date);
      }
      const result = await listCoordinatorAttendance({
        date_from: dateFrom || date, date_to: dateTo || date, pc_id: pcId || undefined,
        attendance_status: (filterStatus || undefined) as 'present' | 'absent' | undefined,
        search: search || undefined, page, page_size: pageSize,
      });
      setRecords(result.records);
      setTotal(result.total);
      setSavedByCoordinator(Object.fromEntries(result.records.map((record) => [record.employee_id, record])));
    } catch {
      setError('Could not load coordinator attendance.');
    } finally {
      setLoading(false);
    }
  }, [date, dateFrom, dateTo, pcId, filterStatus, search, page, pageSize, coordinators]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [date, dateFrom, dateTo, pcId, filterStatus, search, pageSize]);

  async function save(coordinator: Coordinator) {
    const code = statuses[coordinator.pc_id];
    if (!code) return;
    setSaving(coordinator.pc_id);
    setError('');
    setNotice('');
    try {
      const savedRecord = await saveCoordinatorAttendance({
        pc_id: coordinator.pc_id, date, attendance_code: code,
        reason: reasons[coordinator.pc_id]?.trim() || undefined,
      });
      setSavedByCoordinator((current) => ({ ...current, [coordinator.pc_id]: savedRecord }));
      setNotice(`Attendance saved for ${coordinator.name}.`);
      if (filterStatus && savedRecord.attendance_status !== filterStatus) {
        await load();
      } else {
        setRecords((current) => {
          const exists = current.some((record) => record.employee_id === savedRecord.employee_id && record.attendance_date === savedRecord.attendance_date);
          return exists ? current.map((record) => record.employee_id === savedRecord.employee_id && record.attendance_date === savedRecord.attendance_date ? savedRecord : record) : [...current, savedRecord];
        });
        if (!savedByCoordinator[coordinator.pc_id]) setTotal((current) => current + 1);
      }
    } catch {
      setError(`Could not save attendance for ${coordinator.name}.`);
    } finally {
      setSaving(null);
    }
  }

  const currentPageCoordinators = search.trim()
    ? coordinators.filter((item) => `${item.name} ${item.pc_id}`.toLowerCase().includes(search.trim().toLowerCase()))
    : coordinators;
  const pages = Math.max(1, Math.ceil((filterStatus ? total : currentPageCoordinators.length) / pageSize));
  const visibleCoordinators = filterStatus
    ? records.map((record) => coordinators.find((item) => item.pc_id === record.employee_id)).filter((item): item is Coordinator => !!item)
    : currentPageCoordinators.slice((page - 1) * pageSize, page * pageSize);

  return <section>
    <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
      <div><h1 className="text-lg font-medium" style={{ color: 'var(--color-ink)' }}>Project Coordinator Attendance</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-ink-muted)' }}>Record Present or Absent manually. Coordinator attendance does not use photo, check-in, or shift times.</p></div>
      <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--color-ink-muted)' }}><label>Date <input type="date" value={date} onChange={(event) => { setDate(event.target.value); setDateFrom(''); setDateTo(''); }} className="ml-2 rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }} /></label><span>or range</span><input aria-label="From date" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }} /><span>to</span><input aria-label="To date" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }} /></div>
    </div>
    <div className="flex flex-wrap gap-2 mb-4">
      <select value={pcId} onChange={(event) => setPcId(event.target.value)} className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}><option value="">All coordinators</option>{coordinators.map((item) => <option key={item.pc_id} value={item.pc_id}>{item.name}</option>)}</select>
      <select value={filterStatus} onChange={(event) => setFilterStatus(event.target.value)} className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}><option value="">All statuses</option><option value="present">Present</option><option value="absent">Absent</option></select>
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search coordinator…" className="rounded-md border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }} />
      <label className="ml-auto text-sm" style={{ color: 'var(--color-ink-muted)' }}>Show <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}>{[5, 10, 20, 25, 50, 100].map((size) => <option key={size}>{size}</option>)}</select></label>
    </div>
    {error && <p role="alert" className="mb-3 text-sm" style={{ color: 'var(--color-absent)' }}>{error}</p>}
    {notice && <p role="status" className="mb-3 text-sm" style={{ color: 'var(--color-present)' }}>{notice}</p>}
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--color-border)' }}><table className="w-full text-sm">
      <thead style={{ background: 'var(--color-surface-sunken)' }}><tr>{['ID', 'Project Co-ordinator', 'Attendance', 'Reason / note', 'Action'].map((heading) => <th key={heading} className="px-3 py-2.5 text-left text-xs font-medium" style={{ color: 'var(--color-ink-muted)' }}>{heading}</th>)}</tr></thead>
      <tbody>{visibleCoordinators.map((coordinator) => {
        const saved = savedByCoordinator[coordinator.pc_id];
        const value = statuses[coordinator.pc_id] ?? (saved?.attendance_status === 'present' ? 'P' : saved?.attendance_status === 'absent' ? 'A' : '');
        return <tr key={coordinator.pc_id} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <td className="px-3 py-2.5">{coordinator.pc_id}</td><td className="px-3 py-2.5">{coordinator.name}</td>
          <td className="px-3 py-2.5"><select aria-label={`Attendance for ${coordinator.name}`} value={value} onChange={(event) => setStatuses((current) => ({ ...current, [coordinator.pc_id]: event.target.value as 'P' | 'A' }))} className="rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }}><option value="">Select status</option><option value="P">Present</option><option value="A">Absent</option></select></td>
          <td className="px-3 py-2.5"><input value={reasons[coordinator.pc_id] ?? saved?.reason ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [coordinator.pc_id]: event.target.value }))} placeholder="Optional" className="w-full rounded-md border px-2 py-1.5" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface-raised)' }} /></td>
          <td className="px-3 py-2.5"><button disabled={!value || saving === coordinator.pc_id} onClick={() => void save(coordinator)} className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50" style={{ background: 'var(--color-accent)' }}>{saving === coordinator.pc_id ? 'Saving…' : saved ? 'Update' : 'Save'}</button></td>
        </tr>;
      })}
      {!loading && visibleCoordinators.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center" style={{ color: 'var(--color-ink-muted)' }}>No coordinator records for this date/filter.</td></tr>}</tbody>
    </table>{loading && <p className="p-3 text-sm" style={{ color: 'var(--color-ink-muted)' }}>Loading…</p>}
    {pages > 1 && <div className="flex justify-between px-3 py-2.5 text-xs" style={{ color: 'var(--color-ink-muted)' }}><span>Page {page} of {pages}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded border px-2 py-1 disabled:opacity-40">Previous</button><button disabled={page >= pages} onClick={() => setPage((current) => current + 1)} className="rounded border px-2 py-1 disabled:opacity-40">Next</button></div></div>}</div>
  </section>;
}
