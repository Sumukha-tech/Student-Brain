import React, { useState, useEffect, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { 
  auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, 
  collection, doc, setDoc, getDoc, onSnapshot, addDoc, Timestamp, query, where, orderBy 
} from './firebase';
import { User } from 'firebase/auth';
import { 
  BookOpen, Calendar, LayoutDashboard, LogOut, Plus, Search, 
  Sparkles, TrendingUp, User as UserIcon, Mic, FileText, 
  BrainCircuit, CheckCircle2, AlertCircle, Loader2, Send,
  Video, Image as ImageIcon, Trash2, ChevronRight, GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { GoogleGenAI, Type } from '@google/genai';
import { cn } from './lib/utils';
import { format } from 'date-fns';
import { UserProfile, StudyNote, StudyPlan, PerformanceAnalysis } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-600 mb-6 text-sm">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'notes' | 'plan' | 'tools'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [plans, setPlans] = useState<StudyPlan[]>([]);
  const [performance, setPerformance] = useState<PerformanceAnalysis | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Fetch or create profile
        const userRef = doc(db, 'users', u.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setProfile(userSnap.data() as UserProfile);
        } else {
          const newProfile: UserProfile = {
            uid: u.uid,
            email: u.email || '',
            displayName: u.displayName || '',
            photoURL: u.photoURL || '',
            syllabus: { 
              'Engineering Mathematics': 0, 
              'Data Structures & Algorithms': 0, 
              'Operating Systems': 0, 
              'Computer Networks': 0, 
              'Database Management Systems': 0 
            },
            createdAt: new Date().toISOString(),
          };
          await setDoc(userRef, newProfile);
          setProfile(newProfile);
        }

        // Real-time listeners
        const notesUnsub = onSnapshot(
          query(collection(db, `users/${u.uid}/notes`), orderBy('createdAt', 'desc')),
          (snapshot) => {
            setNotes(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudyNote)));
          }
        );

        const plansUnsub = onSnapshot(
          query(collection(db, `users/${u.uid}/studyPlans`), orderBy('date', 'desc')),
          (snapshot) => {
            setPlans(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as StudyPlan)));
          }
        );

        const perfUnsub = onSnapshot(
          query(collection(db, `users/${u.uid}/performance`), orderBy('createdAt', 'desc')),
          (snapshot) => {
            if (!snapshot.empty) {
              setPerformance({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as PerformanceAnalysis);
            }
          }
        );

        setLoading(false);
        return () => {
          notesUnsub();
          plansUnsub();
          perfUnsub();
        };
      } else {
        setProfile(null);
        setNotes([]);
        setPlans([]);
        setPerformance(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <BrainCircuit className="text-white w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Student Brain</h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <NavItem 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')}
            icon={<LayoutDashboard size={20} />}
            label="Dashboard"
          />
          <NavItem 
            active={activeTab === 'notes'} 
            onClick={() => setActiveTab('notes')}
            icon={<BookOpen size={20} />}
            label="Study Notes"
          />
          <NavItem 
            active={activeTab === 'plan'} 
            onClick={() => setActiveTab('plan')}
            icon={<Calendar size={20} />}
            label="Study Plan"
          />
          <NavItem 
            active={activeTab === 'tools'} 
            onClick={() => setActiveTab('tools')}
            icon={<Sparkles size={20} />}
            label="AI Tools"
          />
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 mb-4">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt="Avatar" 
              className="w-8 h-8 rounded-full"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.displayName}</p>
              <p className="text-xs text-slate-500 truncate">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800 capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search notes..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-transparent focus:bg-white focus:border-indigo-300 rounded-full text-sm transition-all outline-none w-64"
              />
            </div>
          </div>
        </header>

        <div className="p-8 max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div 
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-8"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatCard 
                    title="Overall Progress" 
                    value={`${Math.round(Object.values(profile?.syllabus || {}).reduce((a, b) => a + b, 0) / (Object.keys(profile?.syllabus || {}).length || 1))}%`}
                    icon={<TrendingUp className="text-indigo-600" />}
                    color="indigo"
                  />
                  <StatCard 
                    title="Notes Created" 
                    value={notes.length.toString()}
                    icon={<FileText className="text-emerald-600" />}
                    color="emerald"
                  />
                  <StatCard 
                    title="Exam Readiness" 
                    value={performance ? `${performance.readiness}%` : 'N/A'}
                    icon={<GraduationCap className="text-amber-600" />}
                    color="amber"
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <CheckCircle2 className="text-indigo-600" size={20} />
                      Syllabus Progress
                    </h3>
                    <div className="space-y-6">
                      {Object.entries(profile?.syllabus || {}).map(([subject, progress]) => (
                        <div key={subject}>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium text-slate-700">{subject}</span>
                            <span className="text-slate-500">{progress}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              className="h-full bg-indigo-600 rounded-full"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                      <BrainCircuit className="text-indigo-600" size={20} />
                      AI Performance Insights
                    </h3>
                    {performance ? (
                      <div className="prose prose-slate prose-sm max-w-none">
                        <Markdown>{performance.analysis}</Markdown>
                      </div>
                    ) : (
                      <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-3">
                        <AlertCircle size={32} />
                        <p className="text-sm">No analysis available. Run AI Analysis in Tools.</p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'notes' && (
              <NotesView notes={notes} userId={user.uid} />
            )}

            {activeTab === 'plan' && (
              <StudyPlanView plans={plans} userId={user.uid} profile={profile} />
            )}

            {activeTab === 'tools' && (
              <AIToolsView userId={user.uid} profile={profile} notes={notes} />
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
        active 
          ? "bg-indigo-50 text-indigo-600 shadow-sm" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) {
  const colors: Record<string, string> = {
    indigo: "bg-indigo-50",
    emerald: "bg-emerald-50",
    amber: "bg-amber-50"
  };
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colors[color])}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-slate-500 font-medium">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white p-10 rounded-3xl shadow-xl border border-slate-100 text-center"
      >
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-lg shadow-indigo-200">
          <BrainCircuit className="text-white w-10 h-10" />
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">Student Brain</h1>
        <p className="text-slate-600 mb-10 leading-relaxed">
          The ultimate AI-powered Study Operating System for **B.Tech Engineering** students. Convert lectures, track technical syllabus, and ace your engineering exams with intelligent assistance.
        </p>
        <button 
          onClick={onLogin}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-2xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 active:scale-95"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6 bg-white rounded-full p-1" />
          Continue with Google
        </button>
        <p className="mt-8 text-xs text-slate-400">
          Secure authentication powered by Firebase
        </p>
      </motion.div>
    </div>
  );
}

// --- Sub-Views ---

function NotesView({ notes, userId }: { notes: StudyNote[]; userId: string }) {
  const [selectedNote, setSelectedNote] = useState<StudyNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const [isVisionAnalyzing, setIsVisionAnalyzing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVisionAnalysis = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsVisionAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        const mimeType = file.type;

        const prompt = file.type.startsWith('video/') 
          ? "Analyze this video for key information and summarize it for study notes."
          : "Analyze this image for key information and summarize it for study notes.";

        const response = await ai.models.generateContent({
          model: "gemini-3.1-pro-preview",
          contents: {
            parts: [
              { inlineData: { data: base64Data, mimeType } },
              { text: prompt }
            ]
          }
        });

        setNewNoteContent(prev => prev + "\n\n## Vision Analysis Result\n" + response.text);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error(error);
    } finally {
      setIsVisionAnalyzing(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteTitle || !newNoteContent) return;
    setLoading(true);
    try {
      await addDoc(collection(db, `users/${userId}/notes`), {
        userId,
        title: newNoteTitle,
        content: newNoteContent,
        type: 'lecture',
        createdAt: new Date().toISOString()
      });
      setNewNoteTitle('');
      setNewNoteContent('');
      setIsCreating(false);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAISummarize = async () => {
    if (!newNoteContent) return;
    setIsGenerating(true);
    try {
      const prompt = `Convert the following lecture transcript into structured study notes.
Requirements:
- Clean grammar and remove filler words
- Organize into headings and subheadings
- Extract key concepts and definitions
- Add bullet points for clarity
- Highlight important terms
- Add a "Quick Revision" section at the end
- Add 3–5 possible exam questions

Transcript:
${newNoteContent}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      
      setNewNoteContent(response.text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-12rem)]">
      <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">My Library</h3>
          <button 
            onClick={() => setIsCreating(true)}
            className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notes.map(note => (
            <button 
              key={note.id}
              onClick={() => { setSelectedNote(note); setIsCreating(false); }}
              className={cn(
                "w-full text-left p-4 rounded-xl border transition-all group",
                selectedNote?.id === note.id 
                  ? "bg-indigo-50 border-indigo-200" 
                  : "bg-white border-slate-100 hover:border-indigo-200"
              )}
            >
              <div className="flex items-center gap-3 mb-2">
                <FileText size={16} className={selectedNote?.id === note.id ? "text-indigo-600" : "text-slate-400"} />
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">{note.type}</span>
              </div>
              <h4 className="font-bold text-slate-900 truncate mb-1">{note.title}</h4>
              <p className="text-xs text-slate-500">{format(new Date(note.createdAt), 'MMM d, yyyy')}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        {isCreating ? (
          <div className="p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold text-slate-900">New Study Note</h3>
              <div className="flex gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleVisionAnalysis} 
                  className="hidden" 
                  accept="image/*,video/*"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isVisionAnalyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  {isVisionAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                  Add Media
                </button>
                <button 
                  onClick={handleAISummarize}
                  disabled={isGenerating || !newNoteContent}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-all disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  AI Smart Note
                </button>
              </div>
            </div>
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Lecture Title..." 
                value={newNoteTitle}
                onChange={e => setNewNoteTitle(e.target.value)}
                className="w-full text-xl font-bold border-none outline-none placeholder:text-slate-300"
              />
              <textarea 
                placeholder="Paste transcript or type notes here..." 
                value={newNoteContent}
                onChange={e => setNewNoteContent(e.target.value)}
                className="w-full h-96 resize-none border-none outline-none text-slate-700 leading-relaxed placeholder:text-slate-300"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button onClick={() => setIsCreating(false)} className="px-6 py-2 text-slate-600 font-medium">Cancel</button>
              <button 
                onClick={handleCreateNote}
                disabled={loading}
                className="px-8 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={18} className="animate-spin" />}
                Save Note
              </button>
            </div>
          </div>
        ) : selectedNote ? (
          <div className="flex-1 overflow-y-auto">
            <div className="p-8 border-b border-slate-100">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full uppercase tracking-widest">{selectedNote.type}</span>
                <span className="text-xs text-slate-400">{format(new Date(selectedNote.createdAt), 'MMMM d, yyyy')}</span>
              </div>
              <h3 className="text-3xl font-extrabold text-slate-900 mb-4">{selectedNote.title}</h3>
            </div>
            <div className="p-8 prose prose-slate max-w-none">
              <Markdown>{selectedNote.content}</Markdown>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-4">
            <BookOpen size={48} className="opacity-20" />
            <p className="text-sm">Select a note from the library or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}

function StudyPlanView({ plans, userId, profile }: { plans: StudyPlan[]; userId: string; profile: UserProfile | null }) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [examDate, setExamDate] = useState('');
  const [hours, setHours] = useState('4');

  const generatePlan = async () => {
    if (!examDate) return;
    setIsGenerating(true);
    try {
      const subjects = Object.keys(profile?.syllabus || {}).join(', ');
      const weakTopics = Object.entries(profile?.syllabus || {})
        .filter(([_, p]) => p < 50)
        .map(([s, _]) => s)
        .join(', ');

      const prompt = `Create a personalized daily study plan.
Input:
- Exam date: ${examDate}
- Subjects: ${subjects}
- Weak areas: ${weakTopics}
- Available study hours: ${hours}

Output in JSON format:
{
  "schedule": [{"hour": "time", "task": "description", "type": "study|break|revision"}],
  "motivation": "string"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
      });

      const data = JSON.parse(response.text);
      await addDoc(collection(db, `users/${userId}/studyPlans`), {
        userId,
        date: new Date().toISOString(),
        schedule: data.schedule,
        motivation: data.motivation,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(error);
    } finally {
      setIsGenerating(false);
    }
  };

  const currentPlan = plans[0];

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Calendar className="text-indigo-600" size={24} />
          Generate Daily Plan
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Target Exam Date</label>
            <input 
              type="date" 
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Available Hours Today</label>
            <select 
              value={hours}
              onChange={e => setHours(e.target.value)}
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-300"
            >
              {[2, 4, 6, 8, 10].map(h => <option key={h} value={h}>{h} Hours</option>)}
            </select>
          </div>
          <button 
            onClick={generatePlan}
            disabled={isGenerating || !examDate}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            Generate Plan
          </button>
        </div>
      </div>

      {currentPlan ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-bold text-slate-900">Today's Schedule</h4>
              <p className="text-xs text-slate-500">{format(new Date(currentPlan.date), 'EEEE, MMMM d')}</p>
            </div>
            <div className="divide-y divide-slate-100">
              {currentPlan.schedule.map((item, i) => (
                <div key={i} className="p-4 flex items-center gap-6 hover:bg-slate-50 transition-colors">
                  <div className="w-20 text-sm font-bold text-indigo-600">{item.hour}</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{item.task}</p>
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                      item.type === 'study' ? "bg-indigo-100 text-indigo-700" : 
                      item.type === 'revision' ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
                    )}>
                      {item.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-indigo-600 p-8 rounded-2xl text-white shadow-lg shadow-indigo-200 relative overflow-hidden">
              <Sparkles className="absolute top-4 right-4 opacity-20" size={48} />
              <h4 className="text-lg font-bold mb-4">Daily Motivation</h4>
              <p className="text-indigo-100 italic leading-relaxed">"{currentPlan.motivation}"</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h4 className="font-bold text-slate-900 mb-4">Quick Tips</h4>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Take 5-min breaks every 25 mins</li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Stay hydrated while studying</li>
                <li className="flex gap-2"><CheckCircle2 size={16} className="text-emerald-500 shrink-0" /> Review notes before sleeping</li>
              </ul>
            </div>
          </div>
        </div>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-4 bg-white rounded-2xl border border-dashed border-slate-300">
          <Calendar size={48} className="opacity-20" />
          <p className="text-sm">No study plan generated for today yet.</p>
        </div>
      )}
    </div>
  );
}

function AIToolsView({ userId, profile, notes }: { userId: string; profile: UserProfile | null; notes: StudyNote[] }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingQuestions, setIsGeneratingQuestions] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState('');
  const [aiResponse, setAiResponse] = useState('');

  const [isResearching, setIsResearching] = useState(false);
  const [researchQuery, setResearchQuery] = useState('');
  const [researchResult, setResearchResult] = useState('');
  const [groundingUrls, setGroundingUrls] = useState<{ uri: string; title: string }[]>([]);

  const handleResearch = async () => {
    if (!researchQuery) return;
    setIsResearching(true);
    setGroundingUrls([]);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: researchQuery,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      setAiResponse(response.text);
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        const urls = chunks
          .filter(c => c.web)
          .map(c => ({ uri: c.web!.uri, title: c.web!.title }));
        setGroundingUrls(urls);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsResearching(false);
    }
  };

  const analyzePerformance = async () => {
    setIsAnalyzing(true);
    try {
      const subjects = Object.keys(profile?.syllabus || {}).join(', ');
      const scores = "N/A (No exam data yet)";
      const progress = JSON.stringify(profile?.syllabus);
      
      const prompt = `Analyze the student's academic performance in their B.Tech Engineering course.
Input:
- Subjects: ${subjects}
- Scores: ${scores}
- Study time: ${notes.length * 2} hours (estimated)
- Completed syllabus: ${progress}

Output:
1. Engineering Strengths (e.g., analytical, coding, theory)
2. Technical Weak areas
3. Improvement suggestions for engineering exams
4. Predicted exam readiness (in %)
5. Priority technical topics to focus on

Format the response in Markdown. Include a section "READINESS: [number]%" at the end.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.1-pro-preview",
        contents: prompt
      });

      const text = response.text;
      const readinessMatch = text.match(/READINESS: (\d+)%/);
      const readiness = readinessMatch ? parseInt(readinessMatch[1]) : 50;

      await addDoc(collection(db, `users/${userId}/performance`), {
        userId,
        analysis: text,
        readiness,
        createdAt: new Date().toISOString()
      });
      setAiResponse(text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateQuestions = async () => {
    if (!selectedNoteId) return;
    setIsGeneratingQuestions(true);
    try {
      const note = notes.find(n => n.id === selectedNoteId);
      if (!note) return;

      const prompt = `Generate B.Tech engineering exam-level questions from the technical content.
Requirements:
- 5 MCQs (focus on technical concepts and numericals)
- 3 short answer questions (definitions/derivations)
- 2 long answer questions (design/problem-solving)
- Provide answers separately

Content:
${note.content}

Format the response in Markdown.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      setAiResponse(response.text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGeneratingQuestions(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-8">
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Search className="text-indigo-600" size={24} />
            Smart Research
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Search for the latest information on any topic to supplement your study materials.
          </p>
          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Ask anything..." 
              value={researchQuery}
              onChange={e => setResearchQuery(e.target.value)}
              className="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-300"
            />
            <button 
              onClick={handleResearch}
              disabled={isResearching || !researchQuery}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-xl transition-all disabled:opacity-50"
            >
              {isResearching ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
          {groundingUrls.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase">Sources:</p>
              <div className="flex flex-wrap gap-2">
                {groundingUrls.map((u, i) => (
                  <a key={i} href={u.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline bg-indigo-50 px-2 py-1 rounded">
                    {u.title}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="text-indigo-600" size={24} />
            Performance Analyzer
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Get a deep dive into your learning patterns, strengths, and predicted exam readiness based on your syllabus progress and study activity.
          </p>
          <button 
            onClick={analyzePerformance}
            disabled={isAnalyzing}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAnalyzing ? <Loader2 size={20} className="animate-spin" /> : <BrainCircuit size={20} />}
            Run AI Performance Analysis
          </button>
        </div>

        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <GraduationCap className="text-indigo-600" size={24} />
            Exam Question Generator
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Select a study note to generate mock exam questions including MCQs and long-form answers.
          </p>
          <div className="space-y-4">
            <select 
              value={selectedNoteId}
              onChange={e => setSelectedNoteId(e.target.value)}
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-300"
            >
              <option value="">Select a note...</option>
              {notes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
            <button 
              onClick={generateQuestions}
              disabled={isGeneratingQuestions || !selectedNoteId}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 px-6 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isGeneratingQuestions ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
              Generate Exam Questions
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden min-h-[600px]">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h4 className="font-bold text-slate-900">AI Output</h4>
          {aiResponse && (
            <button 
              onClick={() => setAiResponse('')}
              className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
            >
              <Trash2 size={14} /> Clear
            </button>
          )}
        </div>
        <div className="flex-1 p-8 overflow-y-auto prose prose-slate prose-sm max-w-none">
          {aiResponse ? (
            <Markdown>{aiResponse}</Markdown>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
              <Sparkles size={64} className="opacity-10" />
              <p className="text-sm">AI results will appear here</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
