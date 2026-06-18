import React, { useState, useEffect } from 'react';
import { HelpCircle, Mail, MessageSquare, Plus, Clock, Inbox, AlertTriangle } from 'lucide-react';
import { SupportTicket } from '../types.ts';

interface SupportSectionProps {
  token: string | null;
  showToast: (msg: string, type?: 'success' | 'err') => void;
  darkMode?: boolean;
}

export default function SupportSection({ token, showToast, darkMode = true }: SupportSectionProps) {
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets' | 'contact'>('faq');
  const [ticketList, setTicketList] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // Form States
  const [newTicket, setNewTicket] = useState({ subject: '', message: '', priority: 'medium' });
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });

  // FAQ collections
  const faqs = [
    {
      q: "What payment gateways are accepted on checkout?",
      a: "We currently accept credit/debit card simulations, bKash, Nagad, Rocket, or Cash On Delivery (COD) for ultimate convenience."
    },
    {
      q: "How does the reward program or points system calculate points?",
      a: "Every transaction rewards you! You receive 1 point for every $10 spent automatically linked to your Firebase user profile."
    },
    {
      q: "Can I cancel/return order items after they are complete?",
      a: "Yes! Any pending orders can be cancelled immediately from your tracking history. Real delivered items support refunds/returns requested within 14 days."
    },
    {
      q: "How do I trigger the administration panel mock consoles?",
      a: "If you have staff/admin credentials linked to your profile, click 'Ctrl + Shift + A' or append '?admin=true' in your browser URL parameters to show the secret portal!"
    }
  ];

  // Fetch shopper logged tickets
  const fetchTickets = async () => {
    if (!token) return;
    setLoadingTickets(true);
    try {
      const res = await fetch('/api/support/tickets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTicketList(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (token && activeTab === 'tickets') {
      fetchTickets();
    }
  }, [token, activeTab]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      showToast('Please sign-in to open support tickets.', 'err');
      return;
    }
    if (!newTicket.subject || !newTicket.message) {
      showToast('Please specify a subject and outline your inquiry.', 'err');
      return;
    }

    try {
      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newTicket)
      });
      if (res.ok) {
        showToast('Support ticket logged successfully!', 'success');
        setNewTicket({ subject: '', message: '', priority: 'medium' });
        fetchTickets();
      } else {
        showToast('Ticket generation declined.', 'err');
      }
    } catch (err) {
      showToast('Offline support systems.', 'err');
    }
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast('Your message has been sent! Our agents will contact you shortly.', 'success');
    setContactForm({ name: '', email: '', message: '' });
  };

  return (
    <div className={`border rounded-3xl overflow-hidden transition-all duration-300 font-sans ${
      darkMode ? 'bg-slate-900/60 border-slate-800 shadow-xl' : 'bg-white border-slate-205 shadow-xs'
    }`}>
      <div className={`border-b px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
        darkMode ? 'border-slate-800 bg-slate-950/80' : 'border-slate-100 bg-slate-50/50'
      }`}>
        <h4 className={`text-md font-bold tracking-tight flex items-center gap-2.5 font-serif ${
          darkMode ? 'text-white' : 'text-slate-900'
        }`}>
          <MessageSquare className="w-5 h-5 text-indigo-500" /> Customer Support Service Desk
        </h4>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${
              activeTab === 'faq' 
                ? 'bg-indigo-650 text-white shadow-xs' 
                : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70')
            }`}
          >
            FAQs
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${
              activeTab === 'tickets' 
                ? 'bg-indigo-650 text-white shadow-xs' 
                : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70')
            }`}
          >
            My Incident Tickets
          </button>
          <button
            onClick={() => setActiveTab('contact')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200 ${
              activeTab === 'contact' 
                ? 'bg-indigo-650 text-white shadow-xs' 
                : (darkMode ? 'text-slate-400 hover:text-white hover:bg-slate-800/60' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70')
            }`}
          >
            Direct Contact Form
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* TAB 1: FAQ ACCORDION */}
        {activeTab === 'faq' && (
          <div className="space-y-4 max-w-3xl mx-auto">
            {faqs.map((faq, idx) => (
              <details key={idx} className={`group border rounded-2xl p-4.5 cursor-pointer transition-all duration-250 focus:outline-none ${
                darkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50/50 border-slate-150'
              }`}>
                <summary className={`font-semibold text-sm flex justify-between items-center select-none ${
                  darkMode ? 'text-slate-205 hover:text-white' : 'text-slate-800 hover:text-slate-950'
                }`}>
                  {faq.q}
                  <span className={`font-bold text-lg select-none group-open:rotate-45 transition duration-200 ${
                    darkMode ? 'text-indigo-400' : 'text-indigo-600'
                  }`}>+</span>
                </summary>
                <p className={`text-xs mt-3 leading-relaxed border-t pt-3 cursor-default ${
                  darkMode ? 'text-slate-400 border-slate-850' : 'text-slate-600 border-slate-200'
                }`}>
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        )}

        {/* TAB 2: SUPPORT TICKETS LIST & NEW FORM */}
        {activeTab === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* New Ticket Form */}
            <div className={`border p-6 rounded-3xl h-fit ${
              darkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50/50 border-slate-200 shadow-xs'
            }`}>
              <h5 className={`text-sm font-bold uppercase tracking-wide font-serif mb-4 ${
                darkMode ? 'text-slate-200' : 'text-slate-800'
              }`}>Log A New Incident Ticket</h5>
              
              {!token ? (
                <div className={`p-4 border rounded-2xl text-center ${
                  darkMode ? 'bg-slate-900/60 border-slate-805' : 'bg-white border-slate-200 shadow-inner'
                }`}>
                  <p className="text-xs text-slate-500">Please authenticate to write incident support tickets.</p>
                </div>
              ) : (
                <form onSubmit={handleCreateTicket} className="space-y-4 text-xs font-sans">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Subject / Header</label>
                    <input
                      type="text" required
                      placeholder="e.g., Shipping delayed on ORD-554"
                      value={newTicket.subject}
                      onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                      className={`w-full rounded-xl p-2.5 transition focus:outline-none focus:ring-1 focus:ring-indigo-554 ${
                        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Details / Messages</label>
                    <textarea
                      rows={4} required
                      placeholder="Give as much detail as possible to help our staff diagnose..."
                      value={newTicket.message}
                      onChange={(e) => setNewTicket({ ...newTicket, message: e.target.value })}
                      className={`w-full rounded-xl p-2.5 transition focus:outline-none focus:ring-1 focus:ring-indigo-554 ${
                        darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Priority urgency</label>
                    <select
                      value={newTicket.priority}
                      onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                      className={`w-full rounded-xl p-2.5 transition focus:outline-none focus:ring-1 focus:ring-indigo-554 ${
                        darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-700 shadow-xs'
                      }`}
                    >
                      <option value="low">Low - General Question</option>
                      <option value="medium">Medium - Delivery Issue</option>
                      <option value="high">High - Cash/Payment Issue</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-505 hover:to-violet-550 font-bold transition rounded-xl text-white text-xs cursor-pointer uppercase tracking-wider shadow-sm"
                  >
                    Transmit Incident Ticket
                  </button>
                </form>
              )}
            </div>

            {/* List Shoppers Tickets */}
            <div className="space-y-4">
              <h5 className={`text-sm font-bold uppercase tracking-wide font-serif ${
                darkMode ? 'text-slate-200' : 'text-slate-800'
              }`}>My Ticket Logbook</h5>
              
              {!token ? (
                <div className={`p-4 border rounded-2xl text-center text-xs ${
                  darkMode ? 'bg-slate-950/40 border-slate-850 text-slate-500' : 'bg-slate-50 border-slate-150 text-slate-600'
                }`}>
                  Please log in to check ticket status.
                </div>
              ) : loadingTickets ? (
                <p className="text-xs text-slate-400 font-mono animate-pulse">Loading incident registers...</p>
              ) : ticketList.length === 0 ? (
                <div className={`p-6 border rounded-2xl text-center text-xs ${
                  darkMode ? 'bg-slate-950/40 border-slate-850 text-slate-500' : 'bg-slate-50 border-slate-150 text-slate-600'
                }`}>
                  No active/closed incidents under your profile.
                </div>
              ) : (
                <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1 scrollbar-thin">
                  {ticketList.map((ticket) => (
                    <div key={ticket.id} className={`p-4.5 border rounded-2xl space-y-2.5 transition shrink-0 ${
                      darkMode ? 'bg-slate-950/40 border-slate-850/80 hover:bg-slate-950/65' : 'bg-slate-50 border-slate-150 hover:bg-slate-100/50'
                    }`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className={`text-xs font-bold font-serif ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{ticket.subject}</span>
                        <div className="flex gap-1.5 shrink-0 font-mono text-[9px] uppercase font-bold">
                          <span className={`px-2 py-0.5 rounded-lg ${
                            ticket.status === 'open' ? 'bg-orange-950/40 text-orange-400 border border-orange-900/10' : 'bg-slate-900/60 text-slate-400'
                          }`}>
                            {ticket.status}
                          </span>
                          <span className={`px-2 py-0.5 rounded-lg ${
                            ticket.priority === 'high' ? 'bg-red-950/40 text-red-400' : 'bg-slate-900/60 text-slate-350'
                          }`}>
                            {ticket.priority}
                          </span>
                        </div>
                      </div>
                      <p className={`text-xs leading-relaxed font-sans ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{ticket.message}</p>
                      <p className={`text-[10px] pt-2 border-t font-mono ${
                        darkMode ? 'text-slate-500 border-slate-900/50' : 'text-slate-450 border-slate-150'
                      }`}>
                        Date: {new Date(ticket.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: CONTACT FORM */}
        {activeTab === 'contact' && (
          <div className={`border p-6 rounded-3xl max-w-md mx-auto ${
            darkMode ? 'bg-slate-950/40 border-slate-850' : 'bg-slate-50/50 border-slate-200 shadow-xs'
          }`}>
            <h5 className={`text-sm font-bold uppercase tracking-wide font-serif mb-4 ${
              darkMode ? 'text-slate-200' : 'text-slate-800'
            }`}>Direct Contact Ticket</h5>
            <form onSubmit={handleContactSubmit} className="space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-505 mb-1">Your Full Name</label>
                <input
                  type="text" required
                  placeholder="John Doe"
                  value={contactForm.name}
                  onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                  className={`w-full rounded-xl p-2.5 transition focus:outline-none focus:ring-1 focus:ring-indigo-554 ${
                    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Contact Email</label>
                <input
                  type="email" required
                  placeholder="john@example.com"
                  value={contactForm.email}
                  onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                  className={`w-full rounded-xl p-2.5 transition focus:outline-none focus:ring-1 focus:ring-indigo-554 ${
                    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                  }`}
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-550 mb-1">Correspondence details</label>
                <textarea
                  rows={4} required
                  placeholder="Outline your questions, bulk orders, or commercial inquiries..."
                  value={contactForm.message}
                  onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                  className={`w-full rounded-xl p-2.5 transition focus:outline-none focus:ring-1 focus:ring-indigo-554 ${
                    darkMode ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900 shadow-xs'
                  }`}
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-505 hover:to-violet-550 font-bold transition rounded-xl text-white text-xs cursor-pointer uppercase tracking-wider shadow-sm"
              >
                Submit Correspondence
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
