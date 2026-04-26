import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth as authApi } from '../api'

function ForceChangePasswordModal({ onDone }) {
  const [form, setForm]     = useState({ old_password: 'Password', new_password: '', confirm: '' })
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.new_password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (form.new_password === 'Password') { setError('Please choose a different password than the default.'); return }
    if (form.new_password !== form.confirm) { setError('Passwords do not match.'); return }
    setSaving(true)
    try {
      await authApi.changePassword({ old_password: form.old_password, new_password: form.new_password })
      onDone()
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change password.')
    } finally { setSaving(false) }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: '32px 36px',
        width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        border: '1px solid var(--border)',
      }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 6 }}>🔐 Change Your Password</div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
            You're using the default password <strong>"Password"</strong>. For your security, you must set a new password before continuing.
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">New Password *</label>
            <input
              className="form-input" type="password" autoFocus required
              placeholder="Min 8 characters"
              value={form.new_password}
              onChange={e => setForm(f => ({ ...f, new_password: e.target.value }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password *</label>
            <input
              className="form-input" type="password" required
              placeholder="Repeat your new password"
              value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            />
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: 14, padding: '10px 14px', fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={saving || !form.new_password || !form.confirm}
          >
            {saving
              ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Updating…</>
              : 'Set New Password →'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function Login() {
  const { login, clearMustChangePassword } = useAuth()
  const navigate     = useNavigate()
  const [form, setForm]   = useState({ jlu_id: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForceChange, setShowForceChange] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const me = await login(form.jlu_id.trim(), form.password)
      if (me.must_change_password) {
        setShowForceChange(true)
      } else {
        navigate('/')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function fill(jlu_id, password) {
    setForm({ jlu_id, password })
  }

  function handlePasswordChanged() {
    clearMustChangePassword()
    setShowForceChange(false)
    navigate('/')
  }

  return (
    <div className="login-page">
      {showForceChange && <ForceChangePasswordModal onDone={handlePasswordChanged} />}

      <div className="login-card">
        <div className="login-logo">
          <div className="mark">JLU <span>Marks</span></div>
          <div className="tagline">Academic Management System</div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">JLU ID</label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. FAC001"
              value={form.jlu_id}
              onChange={e => setForm(f => ({ ...f, jlu_id: e.target.value }))}
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            disabled={loading}
          >
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Signing in…</> : 'Sign In →'}
          </button>
        </form>

        {/* Demo credentials */}
        <div style={{ marginTop: 28, borderTop: '1px solid var(--border)', paddingTop: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
            Demo Accounts
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              ['ADM001', 'Admin@1234',   'Admin'],
              ['FAC001', 'Faculty@1234', 'Faculty'],
              ['STU001', 'Student@1234', 'Student'],
            ].map(([id, pw, role]) => (
              <button
                key={id}
                className="btn btn-ghost btn-sm"
                style={{ justifyContent: 'space-between' }}
                type="button"
                onClick={() => fill(id, pw)}
              >
                <span style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>{id}</span>
                <span className="badge badge-gray">{role}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
