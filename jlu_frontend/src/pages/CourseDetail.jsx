import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { courses as coursesApi, marks as marksApi, results as resultsApi, enrolments as enrolmentsApi, students as studentsApi, iaComponents as iaApi, org as orgApi } from '../api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import ExportButton from '../components/ExportButton'
import Modal from '../components/Modal'

const GRADE_BANDS = [
  { grade: 'O',  min: 90 }, { grade: 'A+', min: 80 }, { grade: 'A', min: 70 },
  { grade: 'B+', min: 60 }, { grade: 'B',  min: 50 }, { grade: 'C', min: 40 },
  { grade: 'F',  min: 0  },
]
const GRADE_COLOR = { O:'#ffd700','A+':'#22d3a0',A:'#4a9eff','B+':'#a78bfa',B:'#f5a623',C:'#f05365',F:'#ff4444' }

function assignGrade(v) {
  if (v == null) return 'N/A'
  const n = parseFloat(v)
  for (const { grade, min } of GRADE_BANDS) if (n >= min) return grade
  return 'F'
}

// ── Unlock-reason modal ───────────────────────────────────────
function UnlockReasonModal({ courseCode, onClose, onUnlocked }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState('')
  const toast = useToast()

  async function submit(e) {
    e.preventDefault()
    if (!reason.trim()) { setErr('Please enter a reason.'); return }
    setSaving(true); setErr('')
    try {
      await coursesApi.unlock(courseCode, { reason: reason.trim() })
      toast.success('Course unlocked. Marks can now be edited.')
      onUnlocked(); onClose()
    } catch (error) {
      setErr(error.response?.data?.detail || error.response?.data?.message || 'Failed to unlock.')
    } finally { setSaving(false) }
  }

  return (
    <Modal title={`🔓 Unlock Course — ${courseCode}`} onClose={onClose} width={460}>
      <form onSubmit={submit}>
        <p style={{ color: 'var(--text2)', fontSize: 13.5, marginBottom: 16, lineHeight: 1.6 }}>
          Unlocking allows the faculty to edit marks again. This action is permanently logged with your reason.
        </p>
        <div className="form-group">
          <label className="form-label">Reason for unlock *</label>
          <textarea className="form-input" rows={3} style={{ resize: 'vertical' }}
            value={reason} onChange={e => { setReason(e.target.value); setErr('') }}
            placeholder="e.g. Marks entry error reported by faculty…" required autoFocus />
        </div>
        {err && <div className="alert alert-error" style={{ marginBottom: 12, padding: '10px 14px', fontSize: 13 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving || !reason.trim()}>
            {saving ? <><span className="spinner" style={{ width:14,height:14 }}/> Unlocking…</> : '🔓 Unlock'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// ── Shared layout helpers ─────────────────────────────────────
function ColHead({ children, cols }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '9px 14px',
      background: 'var(--surface2)', fontSize: 11, fontWeight: 600, letterSpacing: 1,
      textTransform: 'uppercase', color: 'var(--text3)',
    }}>{children}</div>
  )
}

function DataRow({ cols, children, highlight }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 14px', alignItems: 'center',
      borderTop: '1px solid var(--border)', background: highlight || undefined,
    }}>{children}</div>
  )
}

function Pill({ label, val, color }) {
  return (
    <span style={{ fontSize: 13 }}>
      <span style={{ color: 'var(--text3)' }}>{label}: </span>
      <strong style={{ color: color || 'var(--text)' }}>{val}</strong>
    </span>
  )
}

// ══ Main ══════════════════════════════════════════════════════
export default function CourseDetail() {
  const { code } = useParams()
  const navigate = useNavigate()
  const toast    = useToast()
  const { user } = useAuth()
  const [course, setCourse]           = useState(null)
  const [components, setComponents]   = useState([])
  const [students, setStudents]       = useState([])
  const [tab, setTab]                 = useState('marks')
  const [activeComp, setActiveComp]   = useState(null)
  const [loading, setLoading]         = useState(true)
  const [unlockModal, setUnlockModal] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, compRes, stuRes] = await Promise.all([
        coursesApi.get(code),
        coursesApi.components(code),
        coursesApi.students(code),
      ])
      setCourse(cRes.data)
      const comps = compRes.data.results ?? compRes.data
      setComponents(comps)
      setActiveComp(comps[0]?.id ?? null)
      setStudents(stuRes.data.results ?? stuRes.data)
    } catch {
      toast.error('Failed to load course data.')
    } finally { setLoading(false) }
  }, [code])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="loading"><div className="spinner" /> Loading course…</div>
  if (!course)  return <div className="alert alert-error">Course not found.</div>

  const TABS = [
    ['marks',   '◈ IA Marks'],
    ['ese',     '⊞ ESE Marks'],
    ['results', '◎ Results'],
    ['enrol',   '⊕ Enrolments'],
    ['overview','▣ Overview'],
  ]

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/courses')}>← Back</button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="text-mono" style={{ color: 'var(--accent)', fontSize: 18, fontWeight: 700 }}>{course.course_code}</span>
            <span className="badge badge-blue">{course.course_type}</span>
            <span className="badge badge-gray">Sem {course.semester}</span>
            <span className="badge badge-gray">{course.academic_year}</span>
            {course.is_submitted
              ? <span className="badge badge-green">✓ Submitted &amp; Locked</span>
              : <span className="badge badge-amber">Draft Mode</span>}
            {course.is_deprecated && (
              <span className="badge badge-gray" style={{ background:'var(--surface2)', color:'var(--text3)', border:'1px solid var(--border)' }}>
                ⚠ Deprecated
              </span>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>{course.course_name}</div>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginTop: 2 }}>
                {students.length} enrolled · {course.credits} credits · IA {course.int_weightage}% / ESE {course.ese_weightage}%
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {user?.role === 'admin' && course.is_submitted && (
                <button className="btn btn-primary btn-sm" onClick={() => setUnlockModal(true)}>
                  🔓 Unlock Course
                </button>
              )}
              {user?.role === 'faculty' && !course.is_submitted && (
                <button className="btn btn-primary btn-sm" onClick={async () => {
                  if (!window.confirm('Submit marks to admin? Changes will be locked.')) return
                  try {
                    await coursesApi.submit(course.course_code)
                    setCourse(prev => ({ ...prev, is_submitted: true }))
                    toast.success('Course submitted.')
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Failed to submit.')
                  }
                }}>⇪ Submit to Admin</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unlock reason modal */}
      {unlockModal && (
        <UnlockReasonModal
          courseCode={course.course_code}
          onClose={() => setUnlockModal(false)}
          onUnlocked={() => setCourse(prev => ({ ...prev, is_submitted: false }))}
        />
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 20 }}>
        {TABS.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '10px 18px', background: 'none', border: 'none',
            color: tab === key ? 'var(--accent)' : 'var(--text3)',
            fontFamily: 'var(--font)', fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
            borderBottom: `2px solid ${tab === key ? 'var(--accent)' : 'transparent'}`,
            marginBottom: -1,
          }}>{label}</button>
        ))}
      </div>

      {tab === 'marks'    && <MarksTab    course={course} components={components} setComponents={setComponents} students={students} activeComp={activeComp} setActiveComp={setActiveComp} toast={toast} />}
      {tab === 'ese'      && <ESETab      course={course} students={students} toast={toast} />}
      {tab === 'results'  && <ResultsTab  course={course} students={students} components={components} toast={toast} assignGrade={assignGrade} />}
      {tab === 'enrol'    && <EnrolTab    course={course} students={students} setStudents={setStudents} toast={toast} />}
      {tab === 'overview' && <OverviewTab course={course} students={students} components={components} setComponents={setComponents} toast={toast} />}
    </>
  )
}

// ══ IA MARKS TAB ══════════════════════════════════════════════
function MarksTab({ course, components, setComponents, students, activeComp, setActiveComp, toast }) {
  const [marksMap, setMarksMap] = useState({})
  const [savedSet, setSavedSet] = useState(new Set())
  const [saving, setSaving]     = useState(false)
  const [compLoad, setCompLoad] = useState(false)
  const [viewMode, setViewMode] = useState('raw')
  const { user } = useAuth()

  const comp = components.find(c => c.id === activeComp)
  // Faculty can edit freely while course is in draft; admin can always edit
  const canEdit = user?.role === 'admin' || !course.is_submitted

  useEffect(() => {
    if (!activeComp) return
    setCompLoad(true)
    marksApi.list({ component: activeComp, page_size: 500 })
      .then(r => {
        const data = r.data.results ?? r.data
        const map = {}, saved = new Set()
        data.forEach(m => {
          map[m.student] = String(m.marks_obtained ?? '')
          if (m.marks_obtained !== null) saved.add(m.student)
        })
        setMarksMap(map); setSavedSet(saved)
      })
      .finally(() => setCompLoad(false))
  }, [activeComp])

  const hasOverMax = comp && students.some(s => {
    const v = parseFloat(marksMap[s.student])
    return !isNaN(v) && v > parseFloat(comp.max_marks)
  })
  const filledCount = students.filter(s => (marksMap[s.student] ?? '') !== '').length

  async function saveAll() {
    if (!comp) return
    if (!canEdit) { toast.error('Course is locked. Ask admin to unlock.'); return }
    setSaving(true)
    const payload = students
      .filter(s => (marksMap[s.student] ?? '') !== '')
      .map(s => ({ student: s.student, component: activeComp, marks_obtained: parseFloat(marksMap[s.student]) }))
    if (!payload.length) { toast.warn('No marks entered.'); setSaving(false); return }
    try {
      const { data } = await marksApi.bulk(payload)
      const saved = new Set(savedSet)
      ;(data.saved ?? []).forEach(e => saved.add(e.student))
      setSavedSet(saved)
      if ((data.errors ?? []).length) {
        const msg = data.errors.map(e => e.errors?.non_field_errors?.[0] || JSON.stringify(e.errors)).join('; ')
        toast.warn(`Saved ${(data.saved??[]).length}, ${data.errors.length} errors: ${msg}`)
      } else {
        toast.success(`✓ ${(data.saved??[]).length} marks saved for "${comp.name}".`)
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || e.response?.data?.message || 'Save failed.')
    } finally { setSaving(false) }
  }

  const COLS = '36px 110px 130px 1fr 150px 90px'

  async function handleDeleteComp(e, comp) {
    e.stopPropagation()
    if (!window.confirm(`Delete component "${comp.name}"?\nThis will permanently remove all marks entered for it.`)) return
    try {
      await iaApi.delete(comp.id)
      setComponents(prev => prev.filter(c => c.id !== comp.id))
      if (activeComp === comp.id) {
        const next = components.find(c => c.id !== comp.id)
        setActiveComp(next?.id ?? null)
      }
      toast?.success(`Component "${comp.name}" deleted.`)
    } catch (err) {
      toast?.error(err.response?.data?.detail || 'Failed to delete component.')
    }
  }

  return (
    <div className="card">
      {/* Component selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {components.map(c => (
          <div key={c.id} style={{ display:'flex', alignItems:'center', gap:0 }}>
            <button
              className={`btn ${activeComp === c.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{ borderRadius: '6px 0 0 6px', borderRight: 'none' }}
              onClick={() => setActiveComp(c.id)}>
              {c.name} <span style={{ opacity:.6, fontWeight:400 }}>/{c.max_marks}</span>
            </button>
            <button
              className={`btn ${activeComp === c.id ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{
                borderRadius: '0 6px 6px 0', padding: '0 7px', fontSize: 12,
                opacity: 0.6, borderLeft: '1px solid rgba(255,255,255,0.15)',
              }}
              onClick={e => handleDeleteComp(e, c)}
              title={`Delete ${c.name}`}
            >✕</button>
          </div>
        ))}
      </div>

      {comp && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Pill label="Mode"      val={comp.mode} />
          <Pill label="Max"       val={comp.max_marks} />
          <Pill label="Weightage" val={`${comp.weightage}%`} />
          <Pill label="Filled"    val={`${filledCount}/${students.length}`}
            color={filledCount === students.length ? 'var(--green)' : undefined} />
          {hasOverMax && <span className="badge badge-red">⚠ Marks exceed max</span>}
          {/* View toggle */}
          <div style={{ display:'flex', background:'var(--surface2)', borderRadius:6, padding:3, marginLeft: 16 }}>
            <button className={`btn btn-sm ${viewMode==='raw'?'btn-primary':'btn-ghost'}`} onClick={() => setViewMode('raw')} style={{ minHeight:28, height:28, padding:'0 10px' }}>Raw</button>
            <button className={`btn btn-sm ${viewMode==='scaled'?'btn-primary':'btn-ghost'}`} onClick={() => setViewMode('scaled')} style={{ minHeight:28, height:28, padding:'0 10px' }}>Scaled ({comp.weightage}%)</button>
          </div>
          {course.is_submitted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 8,
              background: user?.role === 'admin' ? 'rgba(245,166,35,0.12)' : 'rgba(240,83,101,0.12)',
              border: `1px solid ${user?.role === 'admin' ? 'var(--amber)' : 'var(--red)'}`,
              fontSize: 12.5, fontWeight: 500,
              color: user?.role === 'admin' ? 'var(--amber)' : 'var(--red)',
            }}>
              🔒 {user?.role === 'admin' ? 'Submitted — you can still edit' : 'Locked — ask admin to unlock'}
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <ExportButton
              title={`${course.course_code} - ${comp.name} Marks`}
              filenamePrefix={`${course.course_code}_${comp.name}`}
              dataRows={students.map((s, i) => ({
                idx: i+1, jlu: s.student_jlu_id, roll: s.student_roll, name: s.student_name,
                marks: marksMap[s.student] ?? '', saved: savedSet.has(s.student) ? 'Yes' : 'No'
              }))}
              availableCols={[
                { key: 'idx', label: '#' }, { key: 'jlu', label: 'JLU ID' }, { key: 'roll', label: 'Roll No' },
                { key: 'name', label: 'Name' }, { key: 'marks', label: `Marks (/${comp.max_marks})` }, { key: 'saved', label: 'Saved' }
              ]}
              courseInfo={{ code: course.course_code, name: course.course_name }}
            />
            <button className="btn btn-primary btn-sm" onClick={saveAll} disabled={saving || hasOverMax || !canEdit}>
              {saving ? <><span className="spinner" style={{ width:12,height:12 }}/> Saving…</> : '⇪ Save All'}
            </button>
          </div>
        </div>
      )}

      {compLoad
        ? <div className="loading" style={{ padding: 32 }}><div className="spinner" /></div>
        : (
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            <ColHead cols={COLS}>
              <div>#</div><div>JLU ID</div><div>Roll No</div><div>Name</div>
              <div>{viewMode==='raw' ? `Marks (/${comp?.max_marks})` : `Scaled (${comp?.weightage}%)`}</div>
              <div>Status</div>
            </ColHead>
            {students.map((enr, idx) => {
              const sid   = enr.student
              const val   = marksMap[sid] ?? ''
              const saved = savedSet.has(sid)
              const isOver = comp && val !== '' && parseFloat(val) > parseFloat(comp.max_marks)
              return (
                <DataRow key={sid} cols={COLS} highlight={isOver ? 'rgba(240,83,101,.04)' : undefined}>
                  <div style={{ color:'var(--text3)', fontSize:12 }}>{idx+1}</div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text3)' }}>{enr.student_jlu_id}</span></div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text2)' }}>{enr.student_roll}</span></div>
                  <div style={{ fontSize:13.5 }}>{enr.student_name}</div>
                  <div>
                    {viewMode === 'raw' ? (
                      <input type="number" min="0" max={comp?.max_marks??100} step="0.5"
                        className={`marks-input${saved?' saved':''}`}
                        style={isOver ? { borderColor:'var(--red)', color:'var(--red)' } : {}}
                        value={val}
                        disabled={!canEdit}
                        onChange={e => {
                          setMarksMap(m => ({ ...m, [sid]: e.target.value }))
                          setSavedSet(s => { const n = new Set(s); n.delete(sid); return n })
                        }}
                        placeholder="—" />
                    ) : (
                      <div className="text-mono" style={{ padding:'8px 12px', fontWeight:600, color: val ? 'var(--text)' : 'var(--text3)' }}>
                        {val ? ((parseFloat(val)/comp.max_marks)*comp.weightage).toFixed(2) : '—'}
                      </div>
                    )}
                  </div>
                  <div>
                    {saved ? <span className="badge badge-green">✓</span>
                           : val ? <span className="badge badge-amber">Unsaved</span>
                                 : <span className="badge badge-gray">Empty</span>}
                  </div>
                </DataRow>
              )
            })}
            {!students.length && <div className="empty-state"><p>No students enrolled.</p></div>}
          </div>
        )}
    </div>
  )
}

// ══ ESE MARKS TAB ═════════════════════════════════════════════
function ESETab({ course, students, toast }) {
  const [rsMap, setRsMap]     = useState({})
  const [savedSet, setSaved]  = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [computing, setComp]  = useState(false)
  const { user } = useAuth()

  const canEdit = user?.role === 'admin' || !course.is_submitted

  const nameOf = Object.fromEntries(students.map(s => [s.student, s.student_name]))
  const rollOf = Object.fromEntries(students.map(s => [s.student, s.student_roll]))
  const jluOf  = Object.fromEntries(students.map(s => [s.student, s.student_jlu_id]))

  useEffect(() => {
    resultsApi.list({ course: course.course_code, page_size: 500 })
      .then(r => {
        const data = r.data.results ?? r.data
        const map = {}, saved = new Set()
        data.forEach(rs => {
          map[rs.id] = {
            id: rs.id, sid: rs.student,
            jlu: jluOf[rs.student] ?? rs.student_jlu_id,
            roll: rollOf[rs.student] ?? rs.student_roll,
            name: nameOf[rs.student] ?? '',
            ese: String(rs.ese_marks ?? '')
          }
          if (rs.ese_marks !== null) saved.add(rs.id)
        })
        setRsMap(map); setSaved(saved)
      })
      .finally(() => setLoading(false))
  }, [course])

  async function saveOne(rsId) {
    const e = rsMap[rsId]
    if (!e?.ese) { toast.warn('Enter a mark first.'); return }
    try {
      await resultsApi.enterESE(rsId, { ese_marks: parseFloat(e.ese) })
      setSaved(s => new Set([...s, rsId]))
      toast.success(`✓ ESE saved for ${e.name || e.roll}.`)
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed.') }
  }

  async function saveAll() {
    const rows = Object.values(rsMap).filter(e => e.ese !== '')
    if (!rows.length) { toast.warn('No ESE marks entered.'); return }
    let ok = 0, fail = 0
    await Promise.all(rows.map(async e => {
      try { await resultsApi.enterESE(e.id, { ese_marks: parseFloat(e.ese) }); setSaved(s => new Set([...s, e.id])); ok++ }
      catch { fail++ }
    }))
    fail ? toast.warn(`Saved ${ok}, failed ${fail}.`) : toast.success(`✓ ESE saved for ${ok} students.`)
  }

  async function computeAll() {
    setComp(true)
    try { await resultsApi.computeAll(course.course_code); toast.success('✓ Grand totals recomputed.') }
    catch { toast.error('Recompute failed.') }
    finally { setComp(false) }
  }

  if (loading) return <div className="loading" style={{ padding: 48 }}><div className="spinner" /></div>

  const rows = Object.values(rsMap)
  const COLS = '36px 110px 130px 1fr 200px 60px'

  return (
    <div className="card">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <div className="card-title">ESE Marks Entry</div>
          <div className="card-subtitle">{course.ese_mode} · Max {course.ese_max_marks} · {course.ese_duration_hrs}h</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
          <ExportButton
            title={`${course.course_code} - ESE Marks`}
            filenamePrefix={`${course.course_code}_ESE`}
            dataRows={rows.map((e, i) => ({
              idx: i+1, jlu: e.jlu, roll: e.roll, name: e.name, ese: e.ese,
              saved: savedSet.has(e.id) ? 'Yes' : 'No'
            }))}
            availableCols={[
              { key:'idx', label:'#' }, { key:'jlu', label:'JLU ID' }, { key:'roll', label:'Roll No' },
              { key:'name', label:'Name' }, { key:'ese', label:'ESE Marks' }, { key:'saved', label:'Saved' }
            ]}
            courseInfo={{ code: course.course_code, name: course.course_name }}
          />
          <button className="btn btn-ghost btn-sm" onClick={saveAll} disabled={!canEdit}>⇪ Save All</button>
          <button className="btn btn-ghost btn-sm" onClick={computeAll} disabled={computing || !canEdit}>
            {computing ? <span className="spinner" style={{ width:12,height:12 }}/> : '⟳'} Recompute
          </button>
        </div>
      </div>
      <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
        <ColHead cols={COLS}><div>#</div><div>JLU ID</div><div>Roll No</div><div>Name</div><div>ESE (/{course.ese_max_marks})</div><div>Status</div></ColHead>
        {rows.map((e, i) => (
          <DataRow key={e.id} cols={COLS}>
            <div style={{ color:'var(--text3)', fontSize:12 }}>{i+1}</div>
            <div><span className="text-mono" style={{ fontSize:12, color:'var(--text3)' }}>{e.jlu}</span></div>
            <div><span className="text-mono" style={{ fontSize:12, color:'var(--text2)' }}>{e.roll}</span></div>
            <div style={{ fontSize:13.5 }}>{e.name}</div>
            <div style={{ display:'flex', gap:8 }}>
              <input type="number" min="0" max={course.ese_max_marks} step="0.5"
                className={`marks-input${savedSet.has(e.id)?' saved':''}`} style={{ width:90 }}
                value={e.ese} disabled={!canEdit}
                onChange={ev => setRsMap(m => ({ ...m, [e.id]: { ...m[e.id], ese: ev.target.value } }))}
                placeholder="—" />
              <button className="btn btn-ghost btn-sm" onClick={() => saveOne(e.id)} disabled={!canEdit}>Save</button>
            </div>
            <div>{savedSet.has(e.id) ? <span className="badge badge-green">✓</span> : <span className="badge badge-gray">—</span>}</div>
          </DataRow>
        ))}
        {!rows.length && <div className="empty-state"><p>No result sheets. Enrol students first.</p></div>}
      </div>
    </div>
  )
}

// ══ RESULTS TAB ═══════════════════════════════════════════════
function ResultsTab({ course, students, components, toast, assignGrade }) {
  const [sheets, setSheets]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [marksData, setMarksData] = useState({})

  const nameOf = Object.fromEntries(students.map(s => [s.student, s.student_name]))
  const rollOf = Object.fromEntries(students.map(s => [s.student, s.student_roll]))
  const jluOf  = Object.fromEntries(students.map(s => [s.student, s.student_jlu_id]))

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [sheetsRes, ...marksRes] = await Promise.all([
          resultsApi.list({ course: course.course_code, page_size: 500 }),
          ...components.map(c => marksApi.list({ component: c.id, page_size: 500 }))
        ])
        setSheets(sheetsRes.data.results ?? sheetsRes.data)
        const mData = {}
        components.forEach((comp, idx) => {
          const compMarks = marksRes[idx].data.results ?? marksRes[idx].data
          compMarks.forEach(m => {
            if (!mData[m.student]) mData[m.student] = {}
            mData[m.student][comp.id] = m.marks_obtained
          })
        })
        setMarksData(mData)
      } catch { toast.error('Failed to load results data.') }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [course, components])

  if (loading) return <div className="loading" style={{ padding: 48 }}><div className="spinner" /></div>

  const complete = sheets.filter(rs => rs.grand_total != null).length
  const passing  = sheets.filter(rs => rs.grand_total != null && parseFloat(rs.grand_total) >= 40).length
  const failing  = sheets.filter(rs => rs.grand_total != null && parseFloat(rs.grand_total) <  40).length
  const pending  = sheets.filter(rs => rs.grand_total == null).length

  const exportRows = sheets.map((rs, i) => {
    const sid = rs.student
    const row = {
      idx: i+1, jlu: jluOf[sid] ?? '', roll: rollOf[sid] ?? '', name: nameOf[sid] ?? '',
      ia_total: rs.int_total ?? '', ese: rs.ese_marks ?? '', total: rs.grand_total ?? '',
      grade: assignGrade(rs.grand_total),
    }
    components.forEach(comp => {
      const raw = marksData[sid]?.[comp.id]
      row[`ia_${comp.id}`] = raw ?? ''
      row[`ia_${comp.id}_scaled`] = raw != null && comp.max_marks > 0
        ? ((parseFloat(raw)/parseFloat(comp.max_marks))*parseFloat(comp.weightage)).toFixed(2) : ''
    })
    row.ia_total_raw    = rs.int_total ?? ''
    row.ia_total_scaled = rs.int_total != null ? ((parseFloat(rs.int_total)*course.int_weightage/100)).toFixed(2) : ''
    row.ese_total       = rs.ese_marks ?? ''
    row.ese_scaled      = rs.ese_marks != null ? ((parseFloat(rs.ese_marks)*course.ese_weightage/100)).toFixed(2) : ''
    return row
  })

  const genericCols = [
    { key:'idx', label:'#' }, { key:'jlu', label:'JLU ID' }, { key:'roll', label:'Roll No' },
    { key:'name', label:'Name' }, { key:'total', label:'Grand Total' }, { key:'grade', label:'Grade' },
  ]
  const COLS = '36px 110px 130px 1fr 90px 90px 120px 70px'

  return (
    <div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        {[['Total',sheets.length,''],['Complete',complete,'var(--blue)'],['Passing',passing,'var(--green)'],['Failing',failing,'var(--red)'],['Pending',pending,'var(--text3)']].map(([l,v,c])=>(
          <div key={l} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'10px 18px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:800, color:c||'var(--text)', marginTop:2 }}>{v}</div>
          </div>
        ))}
        <div style={{ marginLeft:'auto' }}>
          <ExportButton
            title={`${course.course_code} - Full Results`}
            filenamePrefix={`${course.course_code}_Results`}
            dataRows={exportRows}
            availableCols={genericCols}
            iaComponents={components.map(c => ({ id:c.id, name:c.name, max_marks:c.max_marks, weightage:c.weightage }))}
            courseWeightage={{ int_weightage:course.int_weightage, ese_weightage:course.ese_weightage, ese_max_marks:course.ese_max_marks }}
            courseInfo={{ code: course.course_code, name: course.course_name }}
          />
        </div>
      </div>
      <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', overflowX:'auto' }}>
        <ColHead cols={COLS}><div>#</div><div>JLU ID</div><div>Roll</div><div>Name</div><div>IA</div><div>ESE</div><div>Grand Total</div><div>Grade</div></ColHead>
        {sheets.map((rs, i) => {
          const grade = assignGrade(rs.grand_total)
          const sid = rs.student
          const fail = rs.grand_total != null && parseFloat(rs.grand_total) < 40
          return (
            <DataRow key={rs.id} cols={COLS} highlight={fail ? 'rgba(240,83,101,.04)' : undefined}>
              <div style={{ color:'var(--text3)', fontSize:12 }}>{i+1}</div>
              <div><span className="text-mono" style={{ fontSize:12, color:'var(--text3)' }}>{jluOf[sid] ?? sid}</span></div>
              <div><span className="text-mono" style={{ fontSize:12, color:'var(--text2)' }}>{rollOf[sid] ?? sid}</span></div>
              <div style={{ fontSize:13.5 }}>{nameOf[sid] ?? ''}</div>
              <div className="text-mono" style={{ fontSize:13 }}>{rs.int_total ?? '—'}</div>
              <div className="text-mono" style={{ fontSize:13 }}>{rs.ese_marks ?? '—'}</div>
              <div className="text-mono" style={{ fontSize:15, fontWeight:700, color: rs.grand_total!=null?(fail?'var(--red)':'var(--text)'):'var(--text3)' }}>
                {rs.grand_total ?? '—'}
              </div>
              <div>
                <span style={{ padding:'3px 8px', borderRadius:6, fontSize:12, fontWeight:700,
                  background:(GRADE_COLOR[grade]??'#4d607f')+'22', color:GRADE_COLOR[grade]??'var(--text3)' }}>
                  {grade}
                </span>
              </div>
            </DataRow>
          )
        })}
        {!sheets.length && <div className="empty-state"><p>No result sheets found.</p></div>}
      </div>
    </div>
  )
}

// ══ OVERVIEW TAB ══════════════════════════════════════════════
function OverviewTab({ course, students, components, setComponents, toast }) {
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ name:'', mode:'Offline', max_marks:'', weightage:'' })
  const [saving, setSaving] = useState(false)

  const totalWt   = components.reduce((a, c) => a + parseFloat(c.weightage || 0), 0)
  const remaining = parseFloat(course.int_weightage) - totalWt

  async function handleAdd(e) {
    e.preventDefault()
    const newWt = parseFloat(form.weightage)
    if (newWt > remaining + 0.001) {
      toast.error(`Weightage exceeds limit. You can add at most ${remaining.toFixed(2)}% more.`)
      return
    }
    setSaving(true)
    try {
      const { data } = await iaApi.create({
        course: course.course_code, name: form.name, mode: form.mode,
        max_marks: parseFloat(form.max_marks), weightage: newWt
      })
      setComponents(prev => [...prev, data])
      setAdding(false)
      setForm({ name:'', mode:'Offline', max_marks:'', weightage:'' })
      toast?.success('IA Component added.')
    } catch (err) {
      toast?.error(err.response?.data?.message || err.response?.data?.detail || 'Failed to add component.')
    } finally { setSaving(false) }
  }

  async function handleDeleteComp(comp) {
    if (!window.confirm(`Delete component "${comp.name}"? This will permanently remove all marks entered for it.`)) return
    try {
      await iaApi.delete(comp.id)
      setComponents(prev => prev.filter(c => c.id !== comp.id))
      toast?.success(`Component "${comp.name}" deleted.`)
    } catch (err) {
      toast?.error(err.response?.data?.detail || 'Failed to delete component. It may have marks entries — delete those first, or contact your admin.')
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <div className="card">
        <div className="card-title" style={{ marginBottom:16 }}>Course Details</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px 24px' }}>
          {[
            ['Course Code', course.course_code], ['Course Name', course.course_name],
            ['Type', course.course_type], ['Academic Year', course.academic_year],
            ['Semester', course.semester], ['Term', course.term],
            ['Credits', course.credits], ['Lecture Hrs', course.lecture_hrs],
            ['Tutorial Hrs', course.tutorial_hrs], ['Practical Hrs', course.practical_hrs],
            ['Total Hrs', course.total_hrs], ['ESE Mode', course.ese_mode],
            ['ESE Max Marks', course.ese_max_marks], ['ESE Duration', `${course.ese_duration_hrs}h`],
            ['IA Weightage', `${course.int_weightage}%`], ['ESE Weightage', `${course.ese_weightage}%`],
            ['Status', course.is_deprecated ? '⚠ Deprecated' : course.is_submitted ? '✓ Submitted' : 'Draft'],
          ].map(([label, val]) => (
            <div key={label} style={{ display:'flex', gap:10, padding:'5px 0', borderBottom:'1px solid var(--border)' }}>
              <span style={{ color:'var(--text3)', fontSize:12, minWidth:130 }}>{label}</span>
              <span style={{ fontWeight:600, fontSize:13 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div>
            <div className="card-title">IA Components ({components.length})</div>
            <div style={{ fontSize:12, marginTop:4,
              color: remaining < 0 ? 'var(--red)' : remaining === 0 ? 'var(--green)' : 'var(--text3)' }}>
              Total: <strong>{totalWt.toFixed(2)}% / {course.int_weightage}%</strong>
              {remaining > 0 && <span> — {remaining.toFixed(2)}% remaining</span>}
              {remaining <= 0 && remaining >= -0.01 && <span> — ✓ Limit reached</span>}
              {remaining < -0.01 && <span> — ⚠ Exceeds limit!</span>}
            </div>
          </div>
          <button className="btn btn-primary btn-sm"
            onClick={() => setAdding(!adding)}
            disabled={remaining <= 0.005 && !adding}>
            {adding ? 'Cancel' : '+ Add Component'}
          </button>
        </div>

        {adding && (
          <form onSubmit={handleAdd} style={{ display:'flex', gap:10, marginBottom:16, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="form-group" style={{ marginBottom:0, flex:1, minWidth:150 }}>
              <label className="form-label">Name</label>
              <input required className="form-input" value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder="e.g. Mid-Term" />
            </div>
            <div className="form-group" style={{ marginBottom:0, width:120 }}>
              <label className="form-label">Mode</label>
              <select className="form-input" value={form.mode} onChange={e => setForm({...form, mode:e.target.value})}>
                <option>Offline</option><option>Online</option><option>Certificate</option><option>Hackathon</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0, width:90 }}>
              <label className="form-label">Max Marks</label>
              <input required type="number" min="1" className="form-input" value={form.max_marks} onChange={e => setForm({...form, max_marks:e.target.value})} placeholder="50" />
            </div>
            <div className="form-group" style={{ marginBottom:0, width:130 }}>
              <label className="form-label">Wt % (max {remaining.toFixed(1)})</label>
              <input required type="number" min="0.01" max={remaining} step="0.5" className="form-input"
                value={form.weightage}
                onChange={e => setForm({...form, weightage:e.target.value})}
                placeholder={`≤${remaining.toFixed(0)}`}
                style={parseFloat(form.weightage) > remaining ? { borderColor:'var(--red)' } : {}} />
              {parseFloat(form.weightage) > remaining && (
                <div style={{ fontSize:11, color:'var(--red)', marginTop:2 }}>Exceeds {remaining.toFixed(2)}% remaining</div>
              )}
            </div>
            <button type="submit" className="btn btn-primary"
              disabled={saving || !form.weightage || parseFloat(form.weightage) > remaining}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </form>
        )}

        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Mode</th><th>Max Marks</th><th>Weightage</th><th></th></tr></thead>
            <tbody>{components.map(c => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td><span className="badge badge-gray">{c.mode}</span></td>
                <td className="text-mono">{c.max_marks}</td>
                <td>{c.weightage}%</td>
                <td>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ color:'var(--red)', padding:'2px 8px', fontSize:12 }}
                    onClick={() => handleDeleteComp(c)}
                    title="Delete component"
                  >✕ Delete</button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-title" style={{ marginBottom:16 }}>Enrolled Students ({students.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>#</th><th>JLU ID</th><th>Roll No</th><th>Name</th><th>Enrolled At</th></tr></thead>
            <tbody>{students.map((s, i) => (
              <tr key={s.student}>
                <td style={{ color:'var(--text3)' }}>{i+1}</td>
                <td><span className="text-mono text-muted">{s.student_jlu_id}</span></td>
                <td><span className="text-mono">{s.student_roll}</span></td>
                <td>{s.student_name}</td>
                <td className="text-muted">{new Date(s.enrolled_at).toLocaleDateString('en-IN')}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══ ENROLMENT TAB ═════════════════════════════════════════════
function EnrolTab({ course, students, setStudents, toast }) {
  const [search, setSearch]         = useState('')
  const [searchRes, setSearchRes]   = useState([])
  const [searching, setSearching]   = useState(false)
  const [removing, setRemoving]     = useState(null)
  const [programs, setPrograms]     = useState([])
  const [batchForm, setBatchForm]   = useState({ program:'', semester:'', section:'' })
  const [batchLoading, setBatchLoading] = useState(false)

  const isOE = course.course_type === 'OE'

  useEffect(() => {
    orgApi.programs({ page_size: 200 }).then(r => setPrograms(r.data.results ?? r.data)).catch(() => {})
  }, [])

  const enrolledStudentIds = new Set(students.map(s => String(s.student)))
  const enrolIdMap = Object.fromEntries(students.map(s => [String(s.student), s.id]))

  async function doSearch() {
    const q = search.trim(); if (!q) return
    setSearching(true)
    try { const r = await studentsApi.list({ search: q, page_size: 20 }); setSearchRes(r.data.results ?? r.data) }
    catch { toast.error('Search failed.') }
    finally { setSearching(false) }
  }

  async function enrol(student) {
    // Semester match guard (for non-OE courses)
    if (!isOE && student.semester !== course.semester) {
      toast.error(`Cannot enrol: student is in Semester ${student.semester}, but this course is for Semester ${course.semester}.`)
      return
    }
    try {
      await enrolmentsApi.create({ student: student.student_id, course: course.course_code, academic_year: course.academic_year })
      const updated = await coursesApi.students(course.course_code)
      setStudents(updated.data.results ?? updated.data)
      toast.success(`✓ ${student.user_info?.first_name} ${student.user_info?.last_name} enrolled.`)
    } catch (e) {
      const msg = e.response?.data?.message || e.response?.data?.detail
        || (Array.isArray(e.response?.data) ? e.response.data[0] : null) || 'Enrolment failed.'
      toast.error(msg)
    }
  }

  async function unenrol(studentId, enrolId) {
    if (!enrolId) { toast.error('Could not find enrolment record.'); return }
    if (!window.confirm('Remove this student from the course?')) return
    setRemoving(studentId)
    try {
      await enrolmentsApi.delete(enrolId)
      setStudents(prev => prev.filter(s => s.student !== studentId))
      toast.success('Student removed from course.')
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed to remove student.') }
    finally { setRemoving(null) }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* Batch enrol */}
      {!isOE && (
        <div className="card">
          <div className="card-title" style={{ marginBottom:12 }}>Batch Enrol by Program / Semester</div>
          <div style={{ fontSize:12, color:'var(--amber)', marginBottom:10, padding:'8px 12px', background:'rgba(245,166,35,.08)', borderRadius:8, border:'1px solid rgba(245,166,35,.2)' }}>
            ⚠ Only students currently in Semester {course.semester} of the selected program will be enrolled. Cross-semester enrolment is blocked.
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap' }}>
            <div className="form-group" style={{ marginBottom:0, minWidth:180 }}>
              <label className="form-label">Program *</label>
              <select className="form-select" value={batchForm.program} onChange={e => setBatchForm({...batchForm, program:e.target.value})}>
                <option value="">Select program…</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.short_name} — {p.name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0, width:100 }}>
              <label className="form-label">Semester *</label>
              <select className="form-select" value={batchForm.semester} onChange={e => setBatchForm({...batchForm, semester:e.target.value})}>
                <option value="">Sem</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(s => <option key={s} value={s}>Sem {s}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom:0, width:80 }}>
              <label className="form-label">Section</label>
              <input className="form-input" value={batchForm.section} onChange={e => setBatchForm({...batchForm, section:e.target.value})} placeholder="All" />
            </div>
            <button className="btn btn-primary btn-sm"
              disabled={batchLoading || !batchForm.program || !batchForm.semester}
              onClick={async () => {
                setBatchLoading(true)
                try {
                  const { data } = await enrolmentsApi.batchEnrol({
                    course: course.course_code, program: parseInt(batchForm.program),
                    semester: parseInt(batchForm.semester),
                    section: batchForm.section || undefined, academic_year: course.academic_year,
                  })
                  toast.success(data.message)
                  const updated = await coursesApi.students(course.course_code)
                  setStudents(updated.data.results ?? updated.data)
                } catch (err) { toast.error(err.response?.data?.detail || 'Batch enrol failed.') }
                finally { setBatchLoading(false) }
              }}>
              {batchLoading ? <><span className="spinner" style={{ width:12,height:12 }}/> Enrolling…</> : '⇪ Batch Enrol'}
            </button>
          </div>
        </div>
      )}

      {/* Individual search */}
      <div className="card">
        <div className="card-title" style={{ marginBottom:16 }}>{isOE ? 'Add Students' : 'Add Individual Student'}</div>
        <div style={{ display:'flex', gap:10, marginBottom:16 }}>
          <input className="form-input" placeholder="Search by name, roll no, or JLU ID…"
            value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()} style={{ flex:1 }} />
          <button className="btn btn-primary btn-sm" onClick={doSearch} disabled={searching}>
            {searching ? <span className="spinner" style={{ width:14,height:14 }}/> : 'Search'}
          </button>
        </div>
        {searchRes.length > 0 && (
          <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
            {searchRes.map((s, i) => {
              const already = enrolledStudentIds.has(String(s.student_id))
              const semMismatch = !isOE && s.semester !== course.semester
              return (
                <div key={s.student_id} style={{
                  display:'flex', alignItems:'center', gap:12, padding:'11px 14px',
                  borderTop: i===0 ? 'none' : '1px solid var(--border)',
                  background: already ? 'var(--green-dim)' : semMismatch ? 'rgba(240,83,101,.04)' : undefined,
                }}>
                  <span className="text-mono" style={{ fontSize:12, color:'var(--text3)', minWidth:80 }}>{s.roll_no}</span>
                  <span style={{ flex:1, fontSize:13.5 }}>{s.user_info?.first_name} {s.user_info?.last_name}</span>
                  <span className="badge badge-gray">{s.program_name}</span>
                  <span className="badge badge-gray">Sem {s.semester}</span>
                  {semMismatch && (
                    <span className="badge badge-red" title={`Course requires Sem ${course.semester}`}>Sem mismatch</span>
                  )}
                  {already
                    ? <span className="badge badge-green">✓ Enrolled</span>
                    : semMismatch
                      ? <button className="btn btn-ghost btn-sm" disabled style={{ opacity:.4 }}>Can't enrol</button>
                      : <button className="btn btn-primary btn-sm" onClick={() => enrol(s)}>+ Enrol</button>}
                </div>
              )
            })}
          </div>
        )}
        {searchRes.length === 0 && search && !searching && (
          <div className="empty-state" style={{ padding:24 }}><p>No students found for "{search}".</p></div>
        )}
      </div>

      {/* Enrolled list */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <div className="card-title">Currently Enrolled ({students.length})</div>
        </div>
        {students.length === 0
          ? <div className="empty-state"><p>No students enrolled yet.</p></div>
          : (
            <div style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
              <div style={{
                display:'grid', gridTemplateColumns:'36px 110px 130px 1fr 130px 100px 80px',
                gap:12, padding:'9px 14px', background:'var(--surface2)',
                fontSize:11, fontWeight:600, letterSpacing:1, textTransform:'uppercase', color:'var(--text3)',
              }}>
                <div>#</div><div>JLU ID</div><div>Roll No</div><div>Name</div><div>Program</div><div>Enrolled</div><div></div>
              </div>
              {students.map((s, i) => (
                <div key={s.student} style={{
                  display:'grid', gridTemplateColumns:'36px 110px 130px 1fr 130px 100px 80px',
                  gap:12, padding:'10px 14px', alignItems:'center', borderTop:'1px solid var(--border)',
                }}>
                  <div style={{ color:'var(--text3)', fontSize:12 }}>{i+1}</div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text3)' }}>{s.student_jlu_id}</span></div>
                  <div><span className="text-mono" style={{ fontSize:12, color:'var(--text2)' }}>{s.student_roll}</span></div>
                  <div style={{ fontSize:13.5 }}>{s.student_name}</div>
                  <div><span className="badge badge-gray" style={{ fontSize:11 }}>{course.course_code}</span></div>
                  <div style={{ fontSize:12, color:'var(--text3)' }}>
                    {s.enrolled_at ? new Date(s.enrolled_at).toLocaleDateString('en-IN') : '—'}
                  </div>
                  <div>
                    <button className="btn btn-danger btn-sm" disabled={removing===s.student}
                      onClick={() => unenrol(s.student, enrolIdMap[String(s.student)])}
                      style={{ fontSize:11 }}>
                      {removing===s.student ? '…' : 'Remove'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  )
}
