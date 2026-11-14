import { apiUrl } from '@/lib/api-url';
import React, { useState } from 'react';
import { useCapabilities } from '@/lib/capabilities';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function Contact() {
  const { data: capabilities, loading: capabilitiesLoading, error: capabilitiesError } = useCapabilities();
  const [careerForm, setCareerForm] = useState({ name: '', email: '', interest: 'Research & Evidence', message: '', website: '' });
  const [careerStatus, setCareerStatus] = useState({ submitting: false, error: '', sent: false });
  const submitCareer = async event => {
    event.preventDefault();
    if (careerStatus.submitting) return;
    setCareerStatus({ submitting: true, error: '', sent: false });
    try {
      const response = await fetch(apiUrl('/api/contact'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(careerForm) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.error || 'Could not send your message.');
      setCareerStatus({ submitting: false, error: '', sent: true });
      setCareerForm({ name: '', email: '', interest: 'Research & Evidence', message: '', website: '' });
    } catch (error) {
      setCareerStatus({ submitting: false, error: error.message || 'Could not send your message.', sent: false });
    }
  };

  return (
    <main className="min-h-screen bg-[#f9fbfd] text-[#0d2440]">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-[76px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="EYLO home"><img src={import.meta.env.BASE_URL + 'brand/eylo-light.svg'} alt="EYLO" className="h-11 w-auto" /></Link>
          <Link to="/" className="text-sm font-medium text-[#17375c] hover:underline">Back to EYLO</Link>
        </div>
      </header>
      <section className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#356ba0]">EYLO / CONTACT</p>
        <h1 className="mt-4 font-serif text-4xl text-[#102b4e] sm:text-5xl">Get in touch.</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">Questions about EYLO, your research workflow or a possible collaboration? Tell us what you have in mind.</p>
          <div className="mt-10 max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-7">
            <h3 className="text-xl font-semibold text-slate-900">Start a conversation</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Share your question, tell us about your work or explore how we might collaborate.</p>
            {!capabilitiesLoading && capabilitiesError && <p role="status" className="mt-4 text-sm text-amber-800">We couldn’t load the contact form. Please refresh the page or try again later.</p>}
            {!capabilitiesLoading && !capabilitiesError && !capabilities.contact && <p role="status" className="mt-4 text-sm text-amber-800">The contact form is temporarily unavailable. Please check back soon.</p>}
            <form onSubmit={submitCareer} className="mt-6 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-medium text-slate-800">Your name<input required minLength={2} maxLength={100} value={careerForm.name} onChange={e => setCareerForm(s => ({ ...s, name: e.target.value }))} autoComplete="name" className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" /></label>
                <label className="grid gap-2 text-sm font-medium text-slate-800">Email<input type="email" required maxLength={200} value={careerForm.email} onChange={e => setCareerForm(s => ({ ...s, email: e.target.value }))} autoComplete="email" className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" /></label>
              </div>
              <label className="grid gap-2 text-sm font-medium text-slate-800">Area of interest<select value={careerForm.interest} onChange={e => setCareerForm(s => ({ ...s, interest: e.target.value }))} className="rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]"><option>Research & Evidence</option><option>AI & Engineering</option><option>Design & Partnerships</option><option>Other</option></select></label>
              <label className="grid gap-2 text-sm font-medium text-slate-800">A little about you<textarea required minLength={20} maxLength={2400} rows={5} value={careerForm.message} onChange={e => setCareerForm(s => ({ ...s, message: e.target.value }))} placeholder="What do you work on, and how might we collaborate?" className="resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-[#7eb1d1]" /></label>
              <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={careerForm.website} onChange={e => setCareerForm(s => ({ ...s, website: e.target.value }))} /></label></div>
              <p className="text-xs leading-5 text-slate-500">Your details will be used to review and reply to your enquiry. Please don't include sensitive personal information.</p>
              {careerStatus.error && <p role="alert" className="text-sm text-red-700">{careerStatus.error}</p>}
              {careerStatus.sent && <p role="status" className="text-sm text-green-800">Thank you. Your message was sent to the EYLO team.</p>}
              <button type="submit" disabled={careerStatus.submitting || capabilitiesLoading || Boolean(capabilitiesError) || !capabilities.contact} className="inline-flex w-fit items-center gap-2 rounded-xl bg-[#153c72] px-6 py-3 text-sm font-semibold text-white hover:bg-[#25578d] disabled:cursor-wait disabled:opacity-60">{careerStatus.submitting ? 'Sending…' : 'Send your message'} <ArrowRight size={16} /></button>
            </form>
          </div>

      </section>
    </main>
  );
}
