import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const DAILY_RATE = 250
const STORAGE_KEY = 'goshala-fir-records'

const today = () => new Date().toISOString().slice(0, 10)
const dateLabel = (value) => value
  ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : 'Pending'
const amountFor = (record) => {
  if (!record.firDate) return 0
  const start = new Date(`${record.firDate}T00:00:00`)
  const end = new Date(`${record.finalOrderDate || today()}T00:00:00`)
  const days = Math.max(1, Math.floor((end - start) / 86400000) + 1)
  return days * Number(record.cowCount || 0) * DAILY_RATE
}
const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value)
const stageFor = (record) => record.finalOrderDate ? 3 : record.fieldDate ? 2 : 1
const phoneDigits = (record) => `${record.goshalaPhone || ''} ${record.advocatePhone || ''}`.replace(/\D/g, '')

function App() {
  const [currentDateLabel] = useState(() => new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }))
  const [records, setRecords] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    } catch {
      return []
    }
  })
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState('all')
  const [isStaff, setIsStaff] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [editingRecord, setEditingRecord] = useState(null)
  const [loginError, setLoginError] = useState('')

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  }, [records])

  const filteredRecords = useMemo(() => records
    .filter((record) => stageFilter === 'all' || stageFor(record) === Number(stageFilter))
    .filter((record) => {
      const normalizedQuery = query.trim().toLowerCase()
      const phoneQuery = query.replace(/\D/g, '')
      const searchableText = [
        ...Object.values(record),
        record.policeStation,
        record.district,
        record.goshalaPhone,
        record.advocatePhone,
        dateLabel(record.firDate),
        dateLabel(record.finalOrderDate),
      ].join(' ').toLowerCase()
      return searchableText.includes(normalizedQuery) || (phoneQuery.length > 0 && phoneDigits(record).includes(phoneQuery))
    })
    .sort((a, b) => b.firDate.localeCompare(a.firDate)), [records, query, stageFilter])
  const selectedRecord = filteredRecords.find((record) => record.id === selectedId) || filteredRecords[0]
  const activeCount = records.filter((record) => !record.finalOrderDate).length
  const totalCows = records.filter((record) => !record.finalOrderDate).reduce((sum, record) => sum + Number(record.cowCount || 0), 0)
  const pendingAmount = records.filter((record) => !record.finalOrderDate).reduce((sum, record) => sum + amountFor(record), 0)

  function openEditor(record = null) {
    setEditingRecord(record)
    setShowEditor(true)
  }

  function handleSave(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const values = Object.fromEntries(formData.entries())
    const record = {
      ...values,
      id: editingRecord?.id || `FIR-${values.firDate.slice(0, 4)}-${String(Date.now()).slice(-4)}`,
      cowCount: Number(values.cowCount),
      finalOrderAmount: Number(values.finalOrderAmount || 0),
    }
    setRecords((currentRecords) => editingRecord
      ? currentRecords.map((item) => item.id === editingRecord.id ? record : item)
      : [record, ...currentRecords])
    setSelectedId(record.id)
    setShowEditor(false)
  }

  function handleLogin(event) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    if (formData.get('username') === 'admin' && formData.get('password') === 'FIR2026') {
      setIsStaff(true)
      setShowLogin(false)
      setLoginError('')
    } else {
      setLoginError('Incorrect username or password.')
    }
  }

  function handleLogout() {
    setIsStaff(false)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="Gau Raksha case register home">
          <span className="brand-mark">GR</span>
          <span><strong>Gau Raksha</strong><small>CASE REGISTER</small></span>
        </a>
        <div className="topbar-right">
          <span className={`view-indicator ${isStaff ? 'staff' : ''}`}><span />{isStaff ? 'Staff workspace' : 'Public register'}</span>
          {isStaff ? (
            <button className="text-button" onClick={handleLogout}>Sign out</button>
          ) : (
            <button className="button button-dark" onClick={() => setShowLogin(true)}>Staff sign in <span aria-hidden="true">↗</span></button>
          )}
        </div>
      </header>

      <main id="home" className="workspace">
        <section className="page-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />RAJASTHAN · CATTLE PROTECTION</div>
            <h1>FIR case register</h1>
            <p className="page-subtitle">A clear record of every case, from first report to final order.</p>
          </div>
          {isStaff && <button className="button button-green" onClick={() => openEditor()}><span className="plus">+</span> New FIR record</button>}
        </section>

        <section className="summary-grid" aria-label="Case summary">
          <div className="summary-item"><span className="summary-label">OPEN CASES</span><strong>{String(activeCount).padStart(2, '0')}</strong><span className="summary-note">Awaiting final order</span></div>
          <div className="summary-item"><span className="summary-label">CATTLE IN CARE</span><strong>{String(totalCows).padStart(2, '0')}</strong><span className="summary-note">Across open cases</span></div>
          <div className="summary-aside"><span className="summary-date">{currentDateLabel}</span><span>All times local</span></div>
        </section>

        <div className="register-layout">
          <section className="record-panel" aria-label="FIR records">
            <div className="panel-heading">
              <div><span className="section-kicker">CASE FILES</span><h2>Register <span className="count-pill">{filteredRecords.length}</span></h2></div>
              <span className="panel-period">2026</span>
            </div>
            <label className="search-box">
              <span aria-hidden="true" className="search-symbol">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search FIR, station, district, phone…" aria-label="Search FIR number, vehicle number, date, police station, district, goshala, advocate, or phone number" />
              {query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search">×</button>}
            </label>
            <div className="filter-tabs" aria-label="Filter by case stage">
              {[['all', 'All'], ['1', 'FIR'], ['2', 'Field'], ['3', 'Final order']].map(([value, label]) => (
                <button key={value} className={stageFilter === value ? 'active' : ''} onClick={() => setStageFilter(value)}>{label}</button>
              ))}
            </div>
            <div className="record-list">
              {filteredRecords.map((record) => (
                <button key={record.id} className={`record-row ${selectedRecord?.id === record.id ? 'selected' : ''}`} onClick={() => setSelectedId(record.id)}>
                  <span className="record-stage">0{stageFor(record)}</span>
                  <span className="record-row-main"><strong>FIR {record.firNo}</strong><small>{record.vehicleNo} <i>·</i> {record.cowCount} cattle</small><small className="row-goshala">{record.goshalaName}</small></span>
                  <span className="record-row-date">{dateLabel(record.firDate)}</span>
                </button>
              ))}
              {filteredRecords.length === 0 && <div className="empty-state"><span>⌕</span><strong>No case records yet</strong><small>FIR records saved by staff will appear here.</small></div>}
            </div>
            <div className="panel-footnote"><span className="status-dot" /> Records are stored in this browser</div>
          </section>

          {selectedRecord ? (
            <section className="detail-panel" aria-label="Selected FIR details">
              <div className="detail-topline"><span className="section-kicker">CASE DETAIL</span><span className={`status-tag ${selectedRecord.finalOrderDate ? 'complete' : ''}`}>{selectedRecord.finalOrderDate ? 'CLOSED' : 'IN PROGRESS'}</span></div>
              <div className="case-title-row">
                <div><h2>FIR <span>{selectedRecord.firNo}</span></h2><p>{selectedRecord.policeStation} Police Station <i>·</i> Registered {dateLabel(selectedRecord.firDate)}</p></div>
                {isStaff && <button className="button button-outline" onClick={() => openEditor(selectedRecord)}><span aria-hidden="true">✎</span> Edit record</button>}
              </div>

              <div className="timeline" aria-label={`Case at stage ${stageFor(selectedRecord)} of 3`}>
                {[
                  { number: 1, title: 'FIR', detail: dateLabel(selectedRecord.firDate), done: true },
                  { number: 2, title: 'Field report', detail: selectedRecord.fieldDate ? dateLabel(selectedRecord.fieldDate) : 'Awaiting report', done: Boolean(selectedRecord.fieldDate) },
                  { number: 3, title: 'Final order', detail: selectedRecord.finalOrderDate ? dateLabel(selectedRecord.finalOrderDate) : 'Awaiting order', done: Boolean(selectedRecord.finalOrderDate) },
                ].map((stage) => <div className={`timeline-step ${stage.done ? 'done' : ''} ${stage.number === stageFor(selectedRecord) ? 'current' : ''}`} key={stage.number}><span className="timeline-node">{stage.done ? '✓' : `0${stage.number}`}</span><span className="timeline-copy"><strong>{stage.title}</strong><small>{stage.detail}</small></span></div>)}
              </div>

              <div className="detail-columns">
                <div className="detail-column">
                  <div className="detail-section-title"><span className="section-kicker">01 / TRANSPORT</span><span className="section-rule" /></div>
                  <dl className="data-list">
                    <div><dt>Vehicle number</dt><dd className="mono">{selectedRecord.vehicleNo}</dd></div>
                    {selectedRecord.vehicleOwnerName && <div><dt>Vehicle registered to</dt><dd>{selectedRecord.vehicleOwnerName}</dd></div>}
                    {selectedRecord.driverName && <div><dt>Driver</dt><dd>{selectedRecord.driverName}</dd></div>}
                    {selectedRecord.driverPhone && <div><dt>Driver phone</dt><dd><a href={`tel:${selectedRecord.driverPhone}`}>{selectedRecord.driverPhone}</a></dd></div>}
                    {selectedRecord.otherPersons && <div className="note-row"><dt>Other persons in vehicle</dt><dd>{selectedRecord.otherPersons}</dd></div>}
                    <div><dt>Cattle in custody</dt><dd>{selectedRecord.cowCount} <span>cattle</span></dd></div>
                    <div><dt>Police station</dt><dd>{selectedRecord.policeStation}</dd></div>
                    {selectedRecord.state && <div><dt>State</dt><dd>{selectedRecord.state}</dd></div>}
                    {selectedRecord.district && <div><dt>District</dt><dd>{selectedRecord.district}</dd></div>}
                  </dl>
                  <div className="detail-section-title section-spaced"><span className="section-kicker">02 / FIELD REPORT</span><span className="section-rule" /></div>
                  <dl className="data-list">
                    <div><dt>Inspection date</dt><dd>{dateLabel(selectedRecord.fieldDate)}</dd></div>
                    <div className="note-row"><dt>Field note</dt><dd>{selectedRecord.fieldNote || 'No field note recorded.'}</dd></div>
                  </dl>
                </div>
                <div className="detail-column">
                  <div className="detail-section-title"><span className="section-kicker">03 / CUSTODY & ORDER</span><span className="section-rule" /></div>
                  <div className="goshala-block"><span className="mini-label">REGISTERED GOSHALA</span><strong>{selectedRecord.goshalaName}</strong><span>{selectedRecord.goshalaAddress}</span><a href={`tel:${selectedRecord.goshalaPhone}`}>{selectedRecord.goshalaPhone}</a></div>
                  <dl className="data-list order-data">
                    <div><dt>Final order date</dt><dd>{dateLabel(selectedRecord.finalOrderDate)}</dd></div>
                    {Number(selectedRecord.finalOrderAmount || 0) > 0 && <div><dt>Amount given after final order</dt><dd>{money(Number(selectedRecord.finalOrderAmount || 0))}</dd></div>}
                    {selectedRecord.caseWorker && <div><dt>Person working on this case</dt><dd>{selectedRecord.caseWorker}</dd></div>}
                    <div><dt>Order reference</dt><dd className="mono">{selectedRecord.orderNo || 'Not issued'}</dd></div>
                  </dl>
                  <div className="advocate-block"><span className="mini-label">CASE ADVOCATE</span><strong>{selectedRecord.advocateName}</strong><a href={`tel:${selectedRecord.advocatePhone}`}>{selectedRecord.advocatePhone}</a></div>
                </div>
              </div>

              <div className="cost-strip">
                <div className="cost-copy"><span className="section-kicker">CATTLE CARE CALCULATION</span><small>{selectedRecord.cowCount} cattle × ₹250 × {Math.max(1, Math.floor((new Date(`${selectedRecord.finalOrderDate || today()}T00:00:00`) - new Date(`${selectedRecord.firDate}T00:00:00`)) / 86400000) + 1)} days <span>{selectedRecord.finalOrderDate ? '· through final order' : '· accrued to today'}</span></small></div>
                <div className="cost-total"><span>TOTAL CARE AMOUNT</span><strong>{money(amountFor(selectedRecord))}</strong></div>
              </div>
              <div className="calculation-note">Calculated from FIR date through {selectedRecord.finalOrderDate ? 'final order date' : 'today'}, inclusive. Rate: ₹250 per cow per day.</div>
            </section>
          ) : (
            <section className="detail-panel detail-empty"><span className="empty-mark">GR</span><h2>Select a case file</h2><p>Choose a record from the register to see its full case history.</p></section>
          )}
        </div>
      </main>

      <footer className="site-footer"><span>GAU RAKSHA <i>·</i> FIR & CUSTODY REGISTER</span><span>Records stay on this device</span></footer>

      {showLogin && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowLogin(false)}><section className="modal-card login-card" role="dialog" aria-modal="true" aria-labelledby="login-title">
        <button className="modal-close" onClick={() => setShowLogin(false)} aria-label="Close sign in">×</button><span className="section-kicker">STAFF ACCESS</span><h2 id="login-title">Welcome back.</h2><p>Sign in to manage FIR and custody records.</p>
        <form onSubmit={handleLogin} className="modal-form"><label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{loginError && <span className="form-error">{loginError}</span>}<button className="button button-green full-button" type="submit">Sign in <span aria-hidden="true">→</span></button></form>
        <div className="demo-hint"><strong>DEMO ACCESS</strong><span>Username: admin</span><span>Password: FIR2026</span></div>
        <p className="security-note">Demo-only access. This browser-only mode does not provide secure authentication or shared data.</p>
      </section></div>}

      {showEditor && <div className="modal-backdrop editor-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setShowEditor(false)}><section className="modal-card editor-card" role="dialog" aria-modal="true" aria-labelledby="editor-title">
        <div className="editor-heading"><div><span className="section-kicker">STAFF WORKSPACE</span><h2 id="editor-title">{editingRecord ? 'Update case record' : 'Register a new FIR'}</h2></div><button className="modal-close" onClick={() => setShowEditor(false)} aria-label="Close form">×</button></div>
        <form onSubmit={handleSave} className="record-form">
          <div className="form-section-label">01 <span>FIR & TRANSPORT</span></div>
          <div className="form-grid"><label>FIR number<input name="firNo" defaultValue={editingRecord?.firNo} required placeholder="e.g. 151/2026" /></label><label>FIR date<input name="firDate" type="date" defaultValue={editingRecord?.firDate || today()} required /></label><label>Police station<input name="policeStation" defaultValue={editingRecord?.policeStation} required /></label><label>State <span className="optional-label">OPTIONAL</span><input name="state" defaultValue={editingRecord?.state} placeholder="State" /></label><label>District <span className="optional-label">OPTIONAL</span><input name="district" defaultValue={editingRecord?.district} placeholder="District" /></label><label>Vehicle number<input name="vehicleNo" defaultValue={editingRecord?.vehicleNo} required placeholder="RJ 00 AA 0000" /></label><label>Registered vehicle owner <span className="optional-label">OPTIONAL</span><input name="vehicleOwnerName" defaultValue={editingRecord?.vehicleOwnerName} /></label><label>Driver name <span className="optional-label">OPTIONAL</span><input name="driverName" defaultValue={editingRecord?.driverName} /></label><label>Driver phone <span className="optional-label">OPTIONAL</span><input name="driverPhone" type="tel" defaultValue={editingRecord?.driverPhone} /></label><label className="span-two">Other persons in vehicle <span className="optional-label">OPTIONAL</span><textarea name="otherPersons" rows="2" defaultValue={editingRecord?.otherPersons} placeholder="Names of other occupants, separated by commas" /></label><label>Cattle count<input name="cowCount" type="number" min="1" defaultValue={editingRecord?.cowCount || 1} required /></label></div>
          <div className="form-section-label">02 <span>FIELD REPORT</span></div>
          <div className="form-grid"><label>Inspection date<input name="fieldDate" type="date" defaultValue={editingRecord?.fieldDate} /></label><label className="span-two">Field note<textarea name="fieldNote" rows="2" defaultValue={editingRecord?.fieldNote} placeholder="Inspection findings, veterinary report…" /></label></div>
          <div className="form-section-label">03 <span>GOSHALA & FINAL ORDER</span></div>
          <div className="form-grid"><label>Goshala name<input name="goshalaName" defaultValue={editingRecord?.goshalaName} required /></label><label>Goshala phone<input name="goshalaPhone" type="tel" defaultValue={editingRecord?.goshalaPhone} required /></label><label className="span-two">Goshala address<input name="goshalaAddress" defaultValue={editingRecord?.goshalaAddress} required /></label><label>Advocate name<input name="advocateName" defaultValue={editingRecord?.advocateName} required /></label><label>Advocate phone<input name="advocatePhone" type="tel" defaultValue={editingRecord?.advocatePhone} required /></label><label>Person working on that case <span className="optional-label">OPTIONAL</span><input name="caseWorker" defaultValue={editingRecord?.caseWorker} placeholder="Staff or volunteer name" /></label><label>Final order date<input name="finalOrderDate" type="date" defaultValue={editingRecord?.finalOrderDate} /></label><label>Amount given after final order <span className="optional-label">OPTIONAL</span><input name="finalOrderAmount" type="number" min="0" step="0.01" defaultValue={editingRecord?.finalOrderAmount || ''} placeholder="e.g. 25000" /></label><label>Order reference<input name="orderNo" defaultValue={editingRecord?.orderNo} placeholder="Optional until issued" /></label></div>
          <div className="form-footer"><span>Care amount is calculated automatically at ₹250 / cow / day.</span><div><button type="button" className="button button-outline" onClick={() => setShowEditor(false)}>Cancel</button><button type="submit" className="button button-green">{editingRecord ? 'Save changes' : 'Create record'}</button></div></div>
        </form>
      </section></div>}
    </div>
  )
}

export default App
