import { useState } from 'react'
import { supabase } from './supabaseClient'

const BLANK_EXP = {
  company_name: '',
  job_title: '',
  date_of_joining: '',
  date_of_relieving: '',
  joining_letter: null,
  relieving_letter: null,
  payslips: [],
  ctc_at_exit: '',
}

const STEPS = ['Personal', 'Professional', 'KYC']

function fileUrl(file) {
  return file ? URL.createObjectURL(file) : null
}

export default function App() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [showChequeNotice, setShowChequeNotice] = useState(false)

  const [personal, setPersonal] = useState({
    full_name: '', email: '', phone: '', address: '',
    emergency_contact_name: '', emergency_contact_phone: '', blood_group: '',
  })

  const [experiences, setExperiences] = useState([{ ...BLANK_EXP }])
  const [expDone, setExpDone] = useState([])

  const [kyc, setKyc] = useState({
    aadhaar_number: '', aadhaar_file: null,
    pan_number: '', pan_file: null,
    account_type: '', account_number: '', bank_proof_file: null,
  })

  function updatePersonal(field, value) {
    setPersonal((p) => ({ ...p, [field]: value }))
  }

  function updateExp(i, field, value) {
    setExperiences((list) => list.map((e, idx) => (idx === i ? { ...e, [field]: value } : e)))
  }

  function updateExpPayslip(i, slotIdx, file) {
    setExperiences((list) =>
      list.map((e, idx) => {
        if (idx !== i) return e
        const payslips = [...e.payslips]
        payslips[slotIdx] = file
        return { ...e, payslips }
      })
    )
  }

  function markExpDone(i) {
    setExpDone((d) => [...new Set([...d, i])])
  }

  function editExp(i) {
    setExpDone((d) => d.filter((x) => x !== i))
  }

  function addExperience() {
    if (experiences.length >= 4) return
    setExperiences((list) => [...list, { ...BLANK_EXP }])
  }

  function removeExperience(i) {
    setExperiences((list) => list.filter((_, idx) => idx !== i))
    setExpDone((d) => d.filter((x) => x !== i).map((x) => (x > i ? x - 1 : x)))
  }

  function updateKyc(field, value) {
    setKyc((k) => ({ ...k, [field]: value }))
  }

  function chooseAccountType(type) {
    updateKyc('account_type', type)
    if (type === 'cancelled_cheque') setShowChequeNotice(true)
  }

  function validatePersonal() {
    return personal.full_name.trim() && personal.email.trim() && personal.phone.trim()
  }

  function validateKyc() {
    return kyc.aadhaar_number.trim() && kyc.pan_number.trim() && kyc.account_type && kyc.account_number.trim()
  }

  async function uploadFile(submissionId, file, label) {
    if (!file) return null
    const ext = file.name.split('.').pop()
    const path = `${submissionId}/${label}-${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage.from('pre-onboarding-docs').upload(path, file)
    if (upErr) throw upErr
    return path
  }

  async function handleFinalSubmit() {
    setError('')
    if (!validateKyc()) {
      setError('Please complete the Aadhaar, PAN and account details before submitting.')
      return
    }
    setSubmitting(true)
    try {
      const submissionId = crypto.randomUUID()

      const experiencePayload = []
      for (const [i, exp] of experiences.entries()) {
        if (!exp.company_name.trim()) continue
        const joining_letter_path = await uploadFile(submissionId, exp.joining_letter, `exp${i}-joining-letter`)
        const relieving_letter_path = await uploadFile(submissionId, exp.relieving_letter, `exp${i}-relieving-letter`)
        const payslip_paths = []
        for (const [j, slip] of exp.payslips.entries()) {
          const p = await uploadFile(submissionId, slip, `exp${i}-payslip${j}`)
          if (p) payslip_paths.push(p)
        }
        experiencePayload.push({
          company_name: exp.company_name.trim(),
          job_title: exp.job_title.trim(),
          date_of_joining: exp.date_of_joining || null,
          date_of_relieving: exp.date_of_relieving || null,
          joining_letter_path,
          relieving_letter_path,
          payslip_paths,
          ctc_at_exit: exp.ctc_at_exit.trim() || null,
        })
      }

      const aadhaar_file_path = await uploadFile(submissionId, kyc.aadhaar_file, 'aadhaar')
      const pan_file_path = await uploadFile(submissionId, kyc.pan_file, 'pan')
      const bank_proof_file_path = await uploadFile(submissionId, kyc.bank_proof_file, 'bank-proof')

      const { error: insertError } = await supabase.from('pre_onboarding_submissions').insert({
        id: submissionId,
        full_name: personal.full_name.trim(),
        email: personal.email.trim(),
        phone: personal.phone.trim(),
        address: personal.address.trim() || null,
        emergency_contact_name: personal.emergency_contact_name.trim() || null,
        emergency_contact_phone: personal.emergency_contact_phone.trim() || null,
        blood_group: personal.blood_group.trim() || null,
        experience: experiencePayload,
        aadhaar_number: kyc.aadhaar_number.trim(),
        aadhaar_file_path,
        pan_number: kyc.pan_number.trim(),
        pan_file_path,
        account_type: kyc.account_type,
        account_number: kyc.account_number.trim(),
        bank_proof_file_path,
      })
      if (insertError) throw insertError
      setDone(true)
    } catch {
      setError('Something went wrong submitting your details. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="page">
        <div className="card center">
          <img src="/logo.png" alt="Fabriq" className="logo" />
          <h1>Thanks, {personal.full_name.split(' ')[0]}!</h1>
          <p>We've received your details. Our HR team will reach out with the next steps.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="card wide">
        <img src="/logo.png" alt="Fabriq" className="logo" />
        <h1>Welcome to Fabriq</h1>
        <p className="subtitle">Before we begin onboarding, tell us a little about you.</p>

        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`step-pill ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              {i + 1}. {s}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="form">
            <label>Full name
              <input value={personal.full_name} onChange={(e) => updatePersonal('full_name', e.target.value)} placeholder="Your full name" />
            </label>
            <label>Email
              <input type="email" value={personal.email} onChange={(e) => updatePersonal('email', e.target.value)} placeholder="you@example.com" />
            </label>
            <label>Phone number
              <input type="tel" value={personal.phone} onChange={(e) => updatePersonal('phone', e.target.value)} placeholder="Your phone number" />
            </label>
            <label>Address
              <textarea rows={2} value={personal.address} onChange={(e) => updatePersonal('address', e.target.value)} placeholder="Current address" />
            </label>
            <div className="row">
              <label>Emergency contact name
                <input value={personal.emergency_contact_name} onChange={(e) => updatePersonal('emergency_contact_name', e.target.value)} />
              </label>
              <label>Emergency contact phone
                <input value={personal.emergency_contact_phone} onChange={(e) => updatePersonal('emergency_contact_phone', e.target.value)} />
              </label>
            </div>
            <label>Blood group
              <input value={personal.blood_group} onChange={(e) => updatePersonal('blood_group', e.target.value)} placeholder="e.g. O+" />
            </label>

            {error && <div className="error">{error}</div>}
            <div className="actions">
              <button type="button" onClick={() => { setError(''); if (validatePersonal()) setStep(1); else setError('Please fill in your name, email and phone.') }}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="form">
            {experiences.map((exp, i) => (
              <div key={i} className="exp-card">
                {expDone.includes(i) ? (
                  <div className="exp-summary">
                    <div>
                      <strong>{exp.company_name || 'Untitled'}</strong> — {exp.job_title}
                    </div>
                    <div className="exp-summary-actions">
                      <button type="button" className="link-btn" onClick={() => editExp(i)}>Edit</button>
                      {experiences.length > 1 && (
                        <button type="button" className="link-btn danger" onClick={() => removeExperience(i)}>Remove</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="exp-header">
                      <span>Experience {i + 1}</span>
                      {experiences.length > 1 && (
                        <button type="button" className="link-btn danger" onClick={() => removeExperience(i)}>Remove</button>
                      )}
                    </div>
                    <label>Company name
                      <input value={exp.company_name} onChange={(e) => updateExp(i, 'company_name', e.target.value)} />
                    </label>
                    <label>Job title
                      <input value={exp.job_title} onChange={(e) => updateExp(i, 'job_title', e.target.value)} />
                    </label>
                    <div className="row">
                      <label>Date of joining
                        <input type="date" value={exp.date_of_joining} onChange={(e) => updateExp(i, 'date_of_joining', e.target.value)} />
                      </label>
                      <label>Date of relieving
                        <input type="date" value={exp.date_of_relieving} onChange={(e) => updateExp(i, 'date_of_relieving', e.target.value)} />
                      </label>
                    </div>
                    <div className="row">
                      <FileField label="Joining letter" file={exp.joining_letter} onChange={(f) => updateExp(i, 'joining_letter', f)} />
                      <FileField label="Relieving letter" file={exp.relieving_letter} onChange={(f) => updateExp(i, 'relieving_letter', f)} />
                    </div>
                    <label>Payslips (last 3 months)</label>
                    <div className="row">
                      {[0, 1, 2].map((slot) => (
                        <FileField key={slot} label={`Month ${slot + 1}`} file={exp.payslips[slot]} onChange={(f) => updateExpPayslip(i, slot, f)} />
                      ))}
                    </div>
                    <label>CTC at exit
                      <input value={exp.ctc_at_exit} onChange={(e) => updateExp(i, 'ctc_at_exit', e.target.value)} placeholder="e.g. 8,00,000 per annum" />
                    </label>
                    <div className="actions">
                      <button type="button" onClick={() => markExpDone(i)} disabled={!exp.company_name.trim()}>Done</button>
                    </div>
                  </>
                )}
              </div>
            ))}

            {experiences.length < 4 && (
              <button type="button" className="secondary-btn" onClick={addExperience}>+ Add experience</button>
            )}

            {error && <div className="error">{error}</div>}
            <div className="actions">
              <button type="button" className="secondary-btn" onClick={() => setStep(0)}>Back</button>
              <button type="button" onClick={() => setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="form">
            <label>Aadhaar number
              <input value={kyc.aadhaar_number} onChange={(e) => updateKyc('aadhaar_number', e.target.value)} placeholder="XXXX XXXX XXXX" />
            </label>
            <FileField label="Aadhaar upload" file={kyc.aadhaar_file} onChange={(f) => updateKyc('aadhaar_file', f)} />

            <label>PAN number
              <input value={kyc.pan_number} onChange={(e) => updateKyc('pan_number', e.target.value)} placeholder="ABCDE1234F" />
            </label>
            <FileField label="PAN upload" file={kyc.pan_file} onChange={(f) => updateKyc('pan_file', f)} />

            <label>Bank proof</label>
            <div className="radio-row">
              <label className="radio-option">
                <input type="radio" name="account_type" checked={kyc.account_type === 'passbook'} onChange={() => chooseAccountType('passbook')} />
                Account number / Passbook
              </label>
              <label className="radio-option">
                <input type="radio" name="account_type" checked={kyc.account_type === 'cancelled_cheque'} onChange={() => chooseAccountType('cancelled_cheque')} />
                Cancelled cheque
              </label>
            </div>

            <label>Account number
              <input value={kyc.account_number} onChange={(e) => updateKyc('account_number', e.target.value)} placeholder="Bank account number" />
            </label>

            {kyc.account_type === 'passbook' && (
              <FileField label="Passbook photo" file={kyc.bank_proof_file} onChange={(f) => updateKyc('bank_proof_file', f)} />
            )}
            {kyc.account_type === 'cancelled_cheque' && (
              <FileField label="Cancelled cheque photo" file={kyc.bank_proof_file} onChange={(f) => updateKyc('bank_proof_file', f)} />
            )}

            {error && <div className="error">{error}</div>}
            <div className="actions">
              <button type="button" className="secondary-btn" onClick={() => setStep(1)}>Back</button>
              <button type="button" onClick={handleFinalSubmit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </div>
          </div>
        )}
      </div>

      {showChequeNotice && (
        <div className="modal-overlay">
          <div className="modal">
            <p>The uploaded cheque should have your name and account number visible.</p>
            <button type="button" onClick={() => setShowChequeNotice(false)}>OK</button>
          </div>
        </div>
      )}
    </div>
  )
}

function FileField({ label, file, onChange }) {
  const url = fileUrl(file)
  return (
    <div className="file-field">
      <label>{label}</label>
      {file ? (
        <div className="file-chosen">
          <span className="file-name" title={file.name}>{file.name}</span>
          <a href={url} target="_blank" rel="noreferrer" className="link-btn">View</a>
          <label className="link-btn file-replace">
            Change
            <input type="file" hidden onChange={(e) => onChange(e.target.files[0] || null)} />
          </label>
        </div>
      ) : (
        <label className="file-upload-btn">
          Choose file
          <input type="file" hidden onChange={(e) => onChange(e.target.files[0] || null)} />
        </label>
      )}
    </div>
  )
}
