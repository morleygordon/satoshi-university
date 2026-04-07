import { useState, useEffect, useRef } from "react";
import { PROFESSORS, CURRICULUM, CAREERS } from "./data.js";

// ─── PERSISTENCE ────────────────────────────────────────────────────
const load = (k, d) => { try { const v = localStorage.getItem("su_" + k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem("su_" + k, JSON.stringify(v)); } catch {} };

// ─── HELPERS ────────────────────────────────────────────────────────
const getAllCourses = (level) => CURRICULUM[level].semesters.flatMap(s => s.courses);
const allCourses = () => [...getAllCourses("undergraduate"), ...getAllCourses("graduate")];
const isCourseComplete = (progress, id) => {
  const cp = progress[id];
  const course = allCourses().find(c => c.id === id);
  if (!cp || !course) return false;
  return cp.modulesComplete?.length === course.modules.length && cp.quizPassed && cp.examPassed && cp.hwSubmitted;
};
const prereqsMet = (progress, course) => !course.prereqs?.length || course.prereqs.every(p => isCourseComplete(progress, p));
const courseGrade = (cp) => {
  if (!cp?.quizScore && !cp?.examScore) return null;
  const avg = ((cp.quizScore || 0) + (cp.examScore || 0)) / 2;
  if (avg >= 93) return "A"; if (avg >= 90) return "A-"; if (avg >= 87) return "B+"; if (avg >= 83) return "B";
  if (avg >= 80) return "B-"; if (avg >= 77) return "C+"; if (avg >= 73) return "C"; if (avg >= 70) return "C-";
  return "F";
};
const gradePoints = (g) => ({ "A":4,"A-":3.7,"B+":3.3,"B":3,"B-":2.7,"C+":2.3,"C":2,"C-":1.7,"F":0 }[g] || 0);
const calcGPA = (progress) => {
  let pts = 0, creds = 0;
  allCourses().forEach(c => {
    const cp = progress[c.id];
    if (isCourseComplete(progress, c.id) && cp) {
      const g = courseGrade(cp);
      if (g) { pts += gradePoints(g) * c.credits; creds += c.credits; }
    }
  });
  return creds > 0 ? (pts / creds).toFixed(2) : "N/A";
};

// ─── STYLES ─────────────────────────────────────────────────────────
const S = {
  mono: "'JetBrains Mono', monospace",
  serif: "'Crimson Pro', serif",
  bg: "#0a0c14",
  card: "rgba(255,255,255,0.03)",
  border: "rgba(255,255,255,0.06)",
  gold: "#f0c040",
  green: "#22c55e",
  red: "#ef4444",
  purple: "#a78bfa",
  text: "#c0c8e0",
  muted: "#5a6080",
  bright: "#e0e4f0",
};
const btn = (bg, color, extra = {}) => ({
  padding: "12px 24px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
  background: bg, color, fontFamily: S.mono, transition: "all 0.2s", ...extra,
});
const tag = (bg, color) => ({
  fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 5, background: bg, color,
  fontFamily: S.mono, letterSpacing: 1, textTransform: "uppercase", whiteSpace: "nowrap",
});
const heading = (size = 12) => ({ color: S.gold, fontSize: size, fontWeight: 700, letterSpacing: 2, fontFamily: S.mono, textTransform: "uppercase" });

// ─── ENROLLMENT MODAL ───────────────────────────────────────────────
function EnrollmentModal({ onEnroll }) {
  const [name, setName] = useState("");
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,12,20,0.95)",zIndex:3000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
      <div style={{ background:"#1a1d2e",borderRadius:20,maxWidth:460,width:"100%",border:`1px solid rgba(240,192,64,0.2)`,padding:40,textAlign:"center" }}>
        <div style={{ fontSize:48,marginBottom:16 }}>₿</div>
        <div style={heading(14)}>Satoshi University</div>
        <div style={{ color:S.bright,fontSize:26,fontWeight:700,fontFamily:S.serif,margin:"8px 0 4px" }}>Enrollment</div>
        <div style={{ color:S.muted,fontSize:14,fontFamily:S.serif,marginBottom:28 }}>School of Cryptographic Sciences — Est. 2009</div>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="Enter your full name"
          onKeyDown={e => e.key === "Enter" && name.trim() && onEnroll(name.trim())}
          style={{ width:"100%",padding:"14px 18px",borderRadius:10,border:`1px solid ${S.border}`,background:"rgba(255,255,255,0.05)",
            color:S.bright,fontSize:16,fontFamily:S.serif,outline:"none",marginBottom:16,boxSizing:"border-box" }} />
        <button onClick={() => name.trim() && onEnroll(name.trim())}
          disabled={!name.trim()}
          style={btn(`linear-gradient(135deg,${S.gold},#e6a817)`, "#0a0c14", { width:"100%",fontSize:15,opacity:name.trim()?1:0.4 })}>
          Enroll Now →
        </button>
      </div>
    </div>
  );
}

// ─── QUIZ / EXAM MODAL ─────────────────────────────────────────────
function TestModal({ questions, title, isTimed, timePerQ = 45, onClose, onComplete }) {
  const [pool] = useState(() => {
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(questions.length, isTimed ? 10 : 10));
  });
  const [cur, setCur] = useState(0);
  const [sel, setSel] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(isTimed ? pool.length * timePerQ : null);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isTimed || done) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); setDone(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [isTimed, done]);

  const pick = (i) => { if (answered) return; setSel(i); setAnswered(true); if (i === pool[cur].a) setScore(s => s + 1); };
  const next = () => {
    if (cur < pool.length - 1) { setCur(c => c + 1); setSel(null); setAnswered(false); }
    else { clearInterval(timerRef.current); setDone(true); }
  };
  const pct = Math.round((score / pool.length) * 100);
  const passed = pct >= 70;
  const fmtTime = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`;

  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,12,20,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(8px)" }}>
      <div style={{ background:"#1a1d2e",borderRadius:16,maxWidth:640,width:"100%",border:`1px solid ${S.border}`,maxHeight:"90vh",overflow:"auto" }}>
        <div style={{ padding:"18px 22px",borderBottom:`1px solid ${S.border}`,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8 }}>
          <div>
            <div style={{ ...heading(), color: isTimed ? S.red : S.gold }}>
              {done ? "Results" : isTimed ? "⏱ TIMED FINAL EXAM" : `Question ${cur+1}/${pool.length}`}
            </div>
            <div style={{ color:S.bright,fontSize:14,marginTop:2,fontFamily:S.serif }}>{title}</div>
          </div>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            {isTimed && !done && <div style={{ ...tag("rgba(239,68,68,0.15)",S.red), fontSize:13, padding:"6px 12px" }}>⏱ {fmtTime(timeLeft)}</div>}
            <button onClick={onClose} style={{ background:"none",border:"none",color:"#666",fontSize:20,cursor:"pointer" }}>✕</button>
          </div>
        </div>
        <div style={{ padding:22 }}>
          {done ? (
            <div style={{ textAlign:"center",padding:"16px 0" }}>
              <div style={{ width:90,height:90,borderRadius:"50%",margin:"0 auto 18px",background:passed?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)",
                border:`3px solid ${passed?S.green:S.red}`,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:28,fontWeight:800,color:passed?S.green:S.red,fontFamily:S.mono }}>{pct}%</div>
              <div style={{ color:S.bright,fontSize:20,fontWeight:600,fontFamily:S.serif }}>{passed ? (isTimed ? "Final Exam Passed" : "Quiz Passed") : "Not Passed"}</div>
              <div style={{ color:"#8890a8",fontSize:13,marginTop:6 }}>{score}/{pool.length} correct — {passed ? "You may proceed." : "70% required. Review material and retry."}</div>
              <button onClick={() => { onComplete(passed, pct); onClose(); }}
                style={btn(passed ? `linear-gradient(135deg,${S.green},#16a34a)` : `linear-gradient(135deg,${S.red},#dc2626)`, "#fff", { marginTop:20 })}>
                {passed ? "Continue →" : "Close"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ color:S.bright,fontSize:16,lineHeight:1.6,marginBottom:18,fontFamily:S.serif }}>{pool[cur].q}</div>
              <div style={{ display:"flex",flexDirection:"column",gap:8 }}>
                {pool[cur].o.map((opt, i) => {
                  let bg = "rgba(255,255,255,0.04)", bdr = `1px solid ${S.border}`, col = S.text;
                  if (answered) {
                    if (i === pool[cur].a) { bg = "rgba(34,197,94,0.15)"; bdr = `1px solid ${S.green}`; col = S.green; }
                    else if (i === sel) { bg = "rgba(239,68,68,0.15)"; bdr = `1px solid ${S.red}`; col = S.red; }
                  }
                  return (
                    <button key={i} onClick={() => pick(i)} style={{
                      padding:"12px 14px",borderRadius:10,background:bg,border:bdr,color:col,
                      textAlign:"left",cursor:answered?"default":"pointer",fontSize:14,fontFamily:S.serif,transition:"all 0.2s"
                    }}>
                      <span style={{ fontWeight:700,marginRight:8,fontFamily:S.mono,fontSize:11 }}>{String.fromCharCode(65+i)}.</span>{opt}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <button onClick={next} style={btn(`linear-gradient(135deg,${S.gold},#e6a817)`,"#0a0c14",{ marginTop:18,float:"right" })}>
                  {cur < pool.length - 1 ? "Next →" : "See Results"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── CERTIFICATE MODAL ──────────────────────────────────────────────
function CertificateModal({ course, student, grade, onClose }) {
  const prof = PROFESSORS[course.professor];
  return (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,12,20,0.9)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16 }}>
      <div style={{ background:"linear-gradient(135deg,#1a1d2e,#0f1118)",borderRadius:20,maxWidth:520,width:"100%",
        border:`2px solid rgba(240,192,64,0.3)`,padding:"36px 32px",textAlign:"center" }}>
        <div style={{ ...heading(11), letterSpacing:3, marginBottom:4 }}>SATOSHI UNIVERSITY</div>
        <div style={{ width:50,height:1,background:`linear-gradient(90deg,transparent,${S.gold},transparent)`,margin:"8px auto 16px" }} />
        <div style={{ color:"#8890a8",fontSize:12,fontFamily:S.mono,letterSpacing:2 }}>CERTIFICATE OF COMPLETION</div>
        <div style={{ color:S.bright,fontSize:22,fontWeight:700,fontFamily:S.serif,margin:"20px 0 4px" }}>{student}</div>
        <div style={{ color:"#8890a8",fontSize:14,fontFamily:S.serif }}>has successfully completed</div>
        <div style={{ color:S.gold,fontSize:18,fontWeight:700,fontFamily:S.serif,margin:"16px 0 4px" }}>{course.code}: {course.title}</div>
        <div style={{ color:"#8890a8",fontSize:13,fontFamily:S.serif }}>Instructor: {prof.name}</div>
        <div style={{ display:"flex",justifyContent:"center",gap:24,margin:"20px 0" }}>
          <div><div style={{ color:S.muted,fontSize:10,fontFamily:S.mono,letterSpacing:1 }}>GRADE</div><div style={{ color:S.green,fontSize:22,fontWeight:800,fontFamily:S.mono }}>{grade}</div></div>
          <div><div style={{ color:S.muted,fontSize:10,fontFamily:S.mono,letterSpacing:1 }}>CREDITS</div><div style={{ color:S.gold,fontSize:22,fontWeight:800,fontFamily:S.mono }}>{course.credits}</div></div>
        </div>
        <div style={{ width:50,height:1,background:`linear-gradient(90deg,transparent,${S.gold},transparent)`,margin:"0 auto 16px" }} />
        <div style={{ color:S.muted,fontSize:11,fontFamily:S.mono }}>School of Cryptographic Sciences · Est. 2009</div>
        <button onClick={onClose} style={btn(`linear-gradient(135deg,${S.gold},#e6a817)`,"#0a0c14",{ marginTop:20 })}>Close</button>
      </div>
    </div>
  );
}

// ─── COURSE DETAIL ──────────────────────────────────────────────────
function CourseDetail({ course, onBack, progress, setProgress, student }) {
  const [showQuiz, setShowQuiz] = useState(false);
  const [showExam, setShowExam] = useState(false);
  const [showCert, setShowCert] = useState(false);
  const prof = PROFESSORS[course.professor];
  const cp = progress[course.id] || { modulesComplete: [], quizPassed: false, quizScore: 0, examPassed: false, examScore: 0, hwSubmitted: false };
  const update = (patch) => { const next = { ...progress, [course.id]: { ...cp, ...patch } }; setProgress(next); save("progress", next); };

  const toggleModule = (i) => {
    const m = cp.modulesComplete?.includes(i) ? cp.modulesComplete.filter(x => x !== i) : [...(cp.modulesComplete || []), i];
    update({ modulesComplete: m });
  };
  const complete = isCourseComplete(progress, course.id);
  const grade = courseGrade(cp);

  return (
    <div>
      {showQuiz && <TestModal questions={course.quiz} title={`${course.code} — Midterm Quiz`} isTimed={false}
        onClose={() => setShowQuiz(false)} onComplete={(p, s) => p && update({ quizPassed: true, quizScore: s })} />}
      {showExam && <TestModal questions={course.exam} title={`${course.code} — Final Exam`} isTimed={true} timePerQ={45}
        onClose={() => setShowExam(false)} onComplete={(p, s) => p && update({ examPassed: true, examScore: s })} />}
      {showCert && <CertificateModal course={course} student={student} grade={grade} onClose={() => setShowCert(false)} />}

      <button onClick={onBack} style={{ background:"none",border:"none",color:S.gold,cursor:"pointer",fontSize:13,marginBottom:18,padding:0,fontFamily:S.mono }}>← Back to Courses</button>

      {/* Header */}
      <div style={{ background:`linear-gradient(135deg,rgba(240,192,64,0.08),rgba(255,255,255,0.02))`,borderRadius:16,padding:24,border:`1px solid rgba(240,192,64,0.15)`,marginBottom:24 }}>
        <div style={{ display:"flex",gap:14,alignItems:"flex-start",flexWrap:"wrap" }}>
          <div style={{ width:50,height:50,borderRadius:12,background:prof.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:15,fontFamily:S.mono,flexShrink:0 }}>{prof.avatar}</div>
          <div style={{ flex:1,minWidth:200 }}>
            <div style={heading()}>{course.code} · {course.credits} CREDITS {complete && <span style={{ color:S.green }}> · GRADE: {grade}</span>}</div>
            <div style={{ color:S.bright,fontSize:22,fontWeight:700,marginTop:4,fontFamily:S.serif }}>{course.title}</div>
            <div style={{ color:"#8890a8",fontSize:13,marginTop:2 }}>{prof.name} — {prof.title}</div>
            <div style={{ color:"#a0a8c0",fontSize:14,marginTop:8,lineHeight:1.6,fontFamily:S.serif }}>{course.description}</div>
            {course.prereqs?.length > 0 && (
              <div style={{ marginTop:8,fontSize:12,color:S.muted,fontFamily:S.mono }}>
                Prerequisites: {course.prereqs.join(", ")}
              </div>
            )}
          </div>
          {complete && <button onClick={() => setShowCert(true)} style={btn("rgba(34,197,94,0.15)",S.green,{ border:`1px solid ${S.green}` })}>View Certificate</button>}
        </div>
      </div>

      {/* Modules */}
      <div style={{ marginBottom:24 }}>
        <div style={{ ...heading(), marginBottom:12 }}>MODULES — {cp.modulesComplete?.length || 0}/{course.modules.length}</div>
        {course.modules.map((mod, i) => {
          const done = cp.modulesComplete?.includes(i);
          return (
            <div key={i} onClick={() => toggleModule(i)} role="button" tabIndex={0} onKeyDown={e => e.key === "Enter" && toggleModule(i)}
              style={{ display:"flex",alignItems:"center",gap:12,padding:"12px 14px",cursor:"pointer",borderRadius:10,marginBottom:5,transition:"all 0.2s",
                background:done?"rgba(34,197,94,0.06)":S.card, border:`1px solid ${done?"rgba(34,197,94,0.15)":S.border}` }}>
              <div style={{ width:24,height:24,borderRadius:6,flexShrink:0,background:done?S.green:"rgba(255,255,255,0.06)",
                border:done?"none":`2px solid rgba(255,255,255,0.15)`,display:"flex",alignItems:"center",justifyContent:"center",
                color:"#fff",fontSize:13,fontWeight:800 }}>{done ? "✓" : ""}</div>
              <div style={{ flex:1,color:done?"#a0d8b0":S.text,fontSize:14,fontFamily:S.serif }}>{mod.title}</div>
              <div style={tag(mod.type==="lab"?"rgba(139,92,246,0.15)":"rgba(240,192,64,0.1)", mod.type==="lab"?S.purple:S.gold)}>{mod.type}</div>
            </div>
          );
        })}
      </div>

      {/* Reading List */}
      {course.readings && (
        <div style={{ marginBottom:24,background:"rgba(39,117,202,0.06)",borderRadius:14,padding:20,border:"1px solid rgba(39,117,202,0.15)" }}>
          <div style={{ ...heading(), color:"#4a9eff", marginBottom:10 }}>📚 READING LIST</div>
          {course.readings.map((r, i) => (
            <div key={i} style={{ marginBottom:8 }}>
              <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color:"#6ab0ff",fontSize:14,fontFamily:S.serif,textDecoration:"none" }}>
                {r.title}
              </a>
              <span style={{ color:S.muted,fontSize:12,fontFamily:S.mono,marginLeft:8 }}>— {r.author}</span>
            </div>
          ))}
        </div>
      )}

      {/* Homework */}
      <div style={{ background:"rgba(139,92,246,0.06)",borderRadius:14,padding:20,marginBottom:16,border:"1px solid rgba(139,92,246,0.15)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10 }}>
          <div style={{ flex:1,minWidth:200 }}>
            <div style={{ ...heading(), color:S.purple }}>📝 HOMEWORK</div>
            <div style={{ color:S.text,fontSize:14,marginTop:6,lineHeight:1.6,fontFamily:S.serif }}>{course.homework}</div>
          </div>
          <button onClick={() => update({ hwSubmitted:true })} disabled={cp.hwSubmitted}
            style={btn(cp.hwSubmitted?"rgba(34,197,94,0.2)":`linear-gradient(135deg,${S.purple},#7c3aed)`, cp.hwSubmitted?S.green:"#fff", { whiteSpace:"nowrap" })}>
            {cp.hwSubmitted ? "✓ Submitted" : "Mark Complete"}
          </button>
        </div>
      </div>

      {/* Quiz (Midterm — untimed) */}
      <div style={{ background:"rgba(240,192,64,0.06)",borderRadius:14,padding:20,marginBottom:16,border:"1px solid rgba(240,192,64,0.15)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
          <div>
            <div style={heading()}>📋 MIDTERM QUIZ (OPEN-NOTE)</div>
            <div style={{ color:S.text,fontSize:13,marginTop:4,fontFamily:S.serif }}>
              10 questions · untimed · 70% to pass {cp.quizPassed && <span style={{ color:S.green,marginLeft:8 }}>Score: {cp.quizScore}%</span>}
            </div>
          </div>
          <button onClick={() => setShowQuiz(true)} disabled={cp.quizPassed}
            style={btn(cp.quizPassed?"rgba(34,197,94,0.2)":`linear-gradient(135deg,${S.gold},#e6a817)`, cp.quizPassed?S.green:"#0a0c14", { whiteSpace:"nowrap" })}>
            {cp.quizPassed ? "✓ Passed" : "Take Quiz"}
          </button>
        </div>
      </div>

      {/* Exam (Final — timed) */}
      <div style={{ background:"rgba(239,68,68,0.06)",borderRadius:14,padding:20,border:"1px solid rgba(239,68,68,0.15)" }}>
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10 }}>
          <div>
            <div style={{ ...heading(), color:S.red }}>⏱ FINAL EXAM (TIMED)</div>
            <div style={{ color:S.text,fontSize:13,marginTop:4,fontFamily:S.serif }}>
              {course.exam?.length || 0} question pool · 45s per question · 70% to pass
              {cp.examPassed && <span style={{ color:S.green,marginLeft:8 }}>Score: {cp.examScore}%</span>}
            </div>
          </div>
          <button onClick={() => setShowExam(true)} disabled={cp.examPassed || !cp.quizPassed}
            style={btn(cp.examPassed?"rgba(34,197,94,0.2)":cp.quizPassed?`linear-gradient(135deg,${S.red},#dc2626)`:"rgba(255,255,255,0.05)",
              cp.examPassed?S.green:cp.quizPassed?"#fff":S.muted, { whiteSpace:"nowrap",opacity:(!cp.quizPassed&&!cp.examPassed)?0.4:1 })}>
            {cp.examPassed ? "✓ Passed" : !cp.quizPassed ? "Pass Quiz First" : "Take Exam"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ───────────────────────────────────────────────────────
export default function SatoshiUniversity() {
  const [student, setStudent] = useState(() => load("student", null));
  const [progress, setProgress] = useState(() => load("progress", {}));
  const [view, setView] = useState("dashboard");
  const [activeCourse, setActiveCourse] = useState(null);
  const [search, setSearch] = useState("");
  const [showGrad, setShowGrad] = useState(false);

  useEffect(() => { save("progress", progress); }, [progress]);

  const ugCourses = getAllCourses("undergraduate");
  const grCourses = getAllCourses("graduate");
  const ugDone = ugCourses.every(c => isCourseComplete(progress, c.id));
  const grDone = grCourses.every(c => isCourseComplete(progress, c.id));
  const graduated = ugDone && grDone;
  const gpa = calcGPA(progress);
  const creditsEarned = (level) => getAllCourses(level).reduce((a, c) => a + (isCourseComplete(progress, c.id) ? c.credits : 0), 0);
  const maxCredits = (level) => getAllCourses(level).reduce((a, c) => a + c.credits, 0);
  const completedCount = (level) => getAllCourses(level).filter(c => isCourseComplete(progress, c.id)).length;

  useEffect(() => { if (graduated && !showGrad) setShowGrad(true); }, [graduated]);

  const enroll = (name) => { setStudent(name); save("student", name); };
  const resetAll = () => { if (confirm("Reset all progress? This cannot be undone.")) { setProgress({}); save("progress", {}); setStudent(null); save("student", null); setView("dashboard"); setActiveCourse(null); } };

  if (!student) return <EnrollmentModal onEnroll={enroll} />;

  // ─── NAV ────────────────────────────────────────────────────────
  const tabs = ["dashboard","courses","transcript","careers","faculty"];
  const tabLabels = { dashboard:"Home", courses:"Courses", transcript:"Transcript", careers:"Careers", faculty:"Faculty" };

  const renderNav = () => (
    <div style={{ borderBottom:`1px solid ${S.border}`,padding:"0 20px",display:"flex",alignItems:"center",gap:0,overflowX:"auto",WebkitOverflowScrolling:"touch" }}>
      {tabs.map(t => (
        <button key={t} onClick={() => { setView(t); setActiveCourse(null); setSearch(""); }}
          style={{ background:"none",border:"none",padding:"14px 16px",cursor:"pointer",color:view===t?S.gold:S.muted,fontWeight:700,fontSize:12,
            borderBottom:view===t?`2px solid ${S.gold}`:"2px solid transparent",fontFamily:S.mono,letterSpacing:0.5,textTransform:"uppercase",
            transition:"all 0.2s",whiteSpace:"nowrap" }}>{tabLabels[t]}</button>
      ))}
    </div>
  );

  // ─── DASHBOARD ──────────────────────────────────────────────────
  const renderDashboard = () => {
    const totalDone = completedCount("undergraduate") + completedCount("graduate");
    const totalAll = ugCourses.length + grCourses.length;
    return (
      <div>
        <div style={{ marginBottom:28 }}>
          <div style={heading()}>STUDENT DASHBOARD</div>
          <div style={{ color:S.bright,fontSize:26,fontWeight:700,fontFamily:S.serif,marginTop:6 }}>Welcome back, {student}</div>
          <div style={{ color:"#8890a8",fontSize:14,fontFamily:S.serif,marginTop:2 }}>Crawl → Walk → Run — your path to crypto mastery.</div>
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:28 }}>
          {[
            { l:"GPA", v:gpa, s:gpa!=="N/A"?"of 4.00":"no grades yet", c:S.gold },
            { l:"Courses", v:`${totalDone}/${totalAll}`, s:"completed", c:"#627EEA" },
            { l:"Undergrad", v:`${creditsEarned("undergraduate")}/${maxCredits("undergraduate")}`, s:"credits", c:ugDone?S.green:"#627EEA" },
            { l:"Graduate", v:`${creditsEarned("graduate")}/${maxCredits("graduate")}`, s:"credits", c:grDone?S.green:S.purple },
            { l:"Status", v:graduated?"GRAD":ugDone?"Grad":"Undergrad", s:graduated?"M.C.S.":"in progress", c:graduated?S.green:S.gold },
          ].map((c,i) => (
            <div key={i} style={{ background:S.card,borderRadius:12,padding:18,border:`1px solid ${S.border}` }}>
              <div style={{ color:S.muted,fontSize:10,fontWeight:700,letterSpacing:1.5,fontFamily:S.mono,textTransform:"uppercase" }}>{c.l}</div>
              <div style={{ color:c.c,fontSize:24,fontWeight:800,marginTop:6,fontFamily:S.mono }}>{c.v}</div>
              <div style={{ color:"#4a5070",fontSize:12,marginTop:1,fontFamily:S.serif }}>{c.s}</div>
            </div>
          ))}
        </div>
        {/* Path */}
        <div style={{ ...heading(), marginBottom:14 }}>LEARNING PATH</div>
        <div style={{ display:"flex",gap:0,marginBottom:28,flexWrap:"wrap" }}>
          {[
            { p:"CRAWL",l:"Foundations",s:"Semester 1",d:completedCount("undergraduate")>=3 },
            { p:"WALK",l:"Applied Knowledge",s:"Semesters 2–3",d:ugDone },
            { p:"RUN",l:"Graduate Mastery",s:"Semesters 4–5",d:grDone },
          ].map((st,i) => (
            <div key={i} style={{ flex:1,minWidth:140 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,padding:"16px 18px",
                background:st.d?"rgba(34,197,94,0.08)":S.card,border:`1px solid ${st.d?"rgba(34,197,94,0.2)":S.border}`,
                borderRadius:i===0?"12px 0 0 12px":i===2?"0 12px 12px 0":0 }}>
                <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0,background:st.d?S.green:"rgba(240,192,64,0.15)",
                  display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:800,color:st.d?"#fff":S.gold,fontFamily:S.mono }}>{st.d?"✓":i+1}</div>
                <div>
                  <div style={{ color:st.d?S.green:S.gold,fontSize:9,fontWeight:800,letterSpacing:1.5,fontFamily:S.mono }}>{st.p}</div>
                  <div style={{ color:S.text,fontSize:13,fontWeight:600,fontFamily:S.serif }}>{st.l}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex",gap:10,flexWrap:"wrap" }}>
          <button onClick={() => { setView("courses"); setActiveCourse(null); }} style={btn(`linear-gradient(135deg,${S.gold},#e6a817)`,"#0a0c14")}>Start / Continue Courses →</button>
          <button onClick={resetAll} style={btn("rgba(239,68,68,0.1)",S.red,{ border:`1px solid rgba(239,68,68,0.2)` })}>Reset All Progress</button>
        </div>
      </div>
    );
  };

  // ─── COURSES ────────────────────────────────────────────────────
  const renderCourses = () => {
    if (activeCourse) {
      const course = allCourses().find(c => c.id === activeCourse);
      return <CourseDetail course={course} onBack={() => setActiveCourse(null)} progress={progress} setProgress={setProgress} student={student} />;
    }
    const filtered = search ? allCourses().filter(c => c.title.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()) || PROFESSORS[c.professor].name.toLowerCase().includes(search.toLowerCase())) : null;

    const renderCourseRow = (course, locked) => {
      const prof = PROFESSORS[course.professor];
      const cp = progress[course.id];
      const done = isCourseComplete(progress, course.id);
      const started = cp && (cp.modulesComplete?.length > 0 || cp.quizPassed || cp.hwSubmitted);
      const missingPrereqs = !prereqsMet(progress, course);
      const isLocked = locked || missingPrereqs;
      return (
        <div key={course.id} onClick={() => !isLocked && setActiveCourse(course.id)} role="button" tabIndex={isLocked?-1:0}
          onKeyDown={e => e.key === "Enter" && !isLocked && setActiveCourse(course.id)}
          style={{ display:"flex",alignItems:"center",gap:14,padding:"16px 18px",borderRadius:12,cursor:isLocked?"not-allowed":"pointer",
            background:done?"rgba(34,197,94,0.06)":S.card,border:`1px solid ${done?"rgba(34,197,94,0.15)":S.border}`,
            transition:"all 0.2s",opacity:isLocked?0.35:1,marginBottom:8 }}>
          <div style={{ width:40,height:40,borderRadius:10,background:prof.color,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:13,fontFamily:S.mono }}>{prof.avatar}</div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ color:S.gold,fontSize:10,fontWeight:700,letterSpacing:1.5,fontFamily:S.mono }}>{course.code} · {course.credits} CR</div>
            <div style={{ color:S.bright,fontSize:15,fontWeight:600,fontFamily:S.serif,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{course.title}</div>
            <div style={{ color:"#5a6080",fontSize:11,fontFamily:S.serif }}>{prof.name}</div>
          </div>
          <div style={tag(done?"rgba(34,197,94,0.15)":started?"rgba(240,192,64,0.1)":"rgba(255,255,255,0.05)", done?S.green:started?S.gold:S.muted)}>
            {isLocked ? "🔒 LOCKED" : done ? "✓ DONE" : started ? "IN PROGRESS" : "START"}
          </div>
        </div>
      );
    };

    return (
      <div>
        <div style={{ marginBottom:20 }}>
          <div style={heading()}>COURSE CATALOG</div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses, professors..."
            style={{ width:"100%",maxWidth:400,padding:"10px 14px",borderRadius:8,border:`1px solid ${S.border}`,background:"rgba(255,255,255,0.04)",
              color:S.bright,fontSize:14,fontFamily:S.serif,outline:"none",marginTop:12,boxSizing:"border-box" }} />
        </div>
        {filtered ? (
          <div>
            <div style={{ color:S.muted,fontSize:12,fontFamily:S.mono,marginBottom:12 }}>{filtered.length} results</div>
            {filtered.map(c => renderCourseRow(c, false))}
          </div>
        ) : (
          ["undergraduate","graduate"].map(level => (
            <div key={level} style={{ marginBottom:32 }}>
              <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:16 }}>
                <div style={{ color:S.bright,fontSize:20,fontWeight:700,fontFamily:S.serif }}>{CURRICULUM[level].label}</div>
                <div style={tag("rgba(240,192,64,0.1)",S.gold)}>{CURRICULUM[level].phase}</div>
                <div style={tag("rgba(255,255,255,0.05)",S.muted)}>{creditsEarned(level)}/{maxCredits(level)} CR</div>
              </div>
              {level === "graduate" && !ugDone && (
                <div style={{ background:"rgba(239,68,68,0.08)",border:`1px solid rgba(239,68,68,0.2)`,borderRadius:10,padding:16,marginBottom:16,display:"flex",gap:10,alignItems:"center" }}>
                  <span>🔒</span><div style={{ color:S.red,fontSize:13,fontFamily:S.serif }}>Complete all undergraduate courses to unlock graduate school.</div>
                </div>
              )}
              {CURRICULUM[level].semesters.map((sem, si) => (
                <div key={si} style={{ marginBottom:20 }}>
                  <div style={{ color:"#8890a8",fontSize:12,fontWeight:700,fontFamily:S.mono,letterSpacing:1.5,marginBottom:10,paddingBottom:6,borderBottom:`1px solid ${S.border}` }}>{sem.name}</div>
                  {sem.courses.map(c => renderCourseRow(c, level === "graduate" && !ugDone))}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    );
  };

  // ─── TRANSCRIPT ─────────────────────────────────────────────────
  const renderTranscript = () => {
    const completed = allCourses().filter(c => isCourseComplete(progress, c.id));
    return (
      <div>
        <div style={{ background:`linear-gradient(135deg,rgba(240,192,64,0.06),transparent)`,borderRadius:16,padding:28,border:`1px solid rgba(240,192,64,0.12)`,marginBottom:28 }}>
          <div style={{ ...heading(11), letterSpacing:3, marginBottom:4 }}>SATOSHI UNIVERSITY — OFFICIAL TRANSCRIPT</div>
          <div style={{ color:S.bright,fontSize:22,fontWeight:700,fontFamily:S.serif,marginTop:8 }}>{student}</div>
          <div style={{ display:"flex",gap:24,marginTop:12,flexWrap:"wrap" }}>
            <div><span style={{ color:S.muted,fontSize:11,fontFamily:S.mono }}>GPA </span><span style={{ color:S.gold,fontSize:18,fontWeight:800,fontFamily:S.mono }}>{gpa}</span></div>
            <div><span style={{ color:S.muted,fontSize:11,fontFamily:S.mono }}>CREDITS </span><span style={{ color:S.gold,fontSize:18,fontWeight:800,fontFamily:S.mono }}>{creditsEarned("undergraduate")+creditsEarned("graduate")}/{maxCredits("undergraduate")+maxCredits("graduate")}</span></div>
            <div><span style={{ color:S.muted,fontSize:11,fontFamily:S.mono }}>STATUS </span><span style={{ color:graduated?S.green:S.gold,fontSize:14,fontWeight:700,fontFamily:S.mono }}>{graduated?"GRADUATED":ugDone?"GRAD STUDENT":"UNDERGRADUATE"}</span></div>
          </div>
        </div>
        {completed.length === 0 ? (
          <div style={{ textAlign:"center",padding:40,color:S.muted,fontFamily:S.serif }}>No courses completed yet. Start your journey in the Courses tab.</div>
        ) : (
          <div style={{ border:`1px solid ${S.border}`,borderRadius:12,overflow:"hidden" }}>
            <div style={{ display:"grid",gridTemplateColumns:"1fr 3fr 1fr 1fr 1fr",padding:"12px 16px",background:"rgba(255,255,255,0.03)",gap:8 }}>
              {["Code","Course","Credits","Grade","GPA Pts"].map(h => (
                <div key={h} style={{ color:S.muted,fontSize:10,fontWeight:700,fontFamily:S.mono,letterSpacing:1 }}>{h}</div>
              ))}
            </div>
            {completed.map(c => {
              const cp = progress[c.id]; const g = courseGrade(cp); const pts = gradePoints(g);
              return (
                <div key={c.id} style={{ display:"grid",gridTemplateColumns:"1fr 3fr 1fr 1fr 1fr",padding:"12px 16px",borderTop:`1px solid ${S.border}`,gap:8,alignItems:"center" }}>
                  <div style={{ color:S.gold,fontSize:11,fontFamily:S.mono }}>{c.code}</div>
                  <div style={{ color:S.text,fontSize:14,fontFamily:S.serif }}>{c.title}</div>
                  <div style={{ color:S.text,fontSize:13,fontFamily:S.mono }}>{c.credits}</div>
                  <div style={{ color:S.green,fontSize:14,fontWeight:700,fontFamily:S.mono }}>{g}</div>
                  <div style={{ color:S.text,fontSize:13,fontFamily:S.mono }}>{pts.toFixed(1)}</div>
                </div>
              );
            })}
            <div style={{ display:"grid",gridTemplateColumns:"1fr 3fr 1fr 1fr 1fr",padding:"14px 16px",borderTop:`1px solid rgba(240,192,64,0.2)`,background:"rgba(240,192,64,0.04)",gap:8 }}>
              <div /><div style={{ color:S.gold,fontSize:13,fontWeight:700,fontFamily:S.mono }}>CUMULATIVE</div>
              <div style={{ color:S.gold,fontSize:13,fontWeight:700,fontFamily:S.mono }}>{completed.reduce((a,c) => a+c.credits,0)}</div>
              <div /><div style={{ color:S.gold,fontSize:14,fontWeight:800,fontFamily:S.mono }}>{gpa}</div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ─── CAREERS ────────────────────────────────────────────────────
  const renderCareers = () => (
    <div>
      <div style={{ marginBottom:24 }}>
        <div style={heading()}>CAREER LAUNCHPAD</div>
        <div style={{ color:S.bright,fontSize:22,fontWeight:700,fontFamily:S.serif,marginTop:6 }}>Crypto Career Paths</div>
        <div style={{ color:"#8890a8",fontSize:14,fontFamily:S.serif,marginTop:2 }}>See which roles your coursework qualifies you for.</div>
      </div>
      <div style={{ display:"flex",flexDirection:"column",gap:14 }}>
        {CAREERS.map((career, i) => {
          const ready = career.courses.filter(id => isCourseComplete(progress, id)).length;
          const total = career.courses.length;
          const pct = Math.round((ready / total) * 100);
          return (
            <div key={i} style={{ background:S.card,borderRadius:14,padding:20,border:`1px solid ${S.border}` }}>
              <div style={{ display:"flex",alignItems:"flex-start",gap:14,flexWrap:"wrap" }}>
                <div style={{ fontSize:28 }}>{career.icon}</div>
                <div style={{ flex:1,minWidth:200 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:10,flexWrap:"wrap" }}>
                    <div style={{ color:S.bright,fontSize:17,fontWeight:700,fontFamily:S.serif }}>{career.title}</div>
                    <div style={tag(pct===100?"rgba(34,197,94,0.15)":"rgba(240,192,64,0.1)", pct===100?S.green:S.gold)}>{pct===100?"QUALIFIED":`${pct}%`}</div>
                  </div>
                  <div style={{ color:S.green,fontSize:13,fontFamily:S.mono,marginTop:2 }}>{career.salary}</div>
                  <div style={{ color:"#a0a8c0",fontSize:14,fontFamily:S.serif,marginTop:6,lineHeight:1.5 }}>{career.desc}</div>
                  <div style={{ marginTop:10 }}>
                    <div style={{ color:S.muted,fontSize:10,fontFamily:S.mono,letterSpacing:1,marginBottom:6 }}>REQUIRED COURSES</div>
                    <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
                      {career.courses.map(id => {
                        const done = isCourseComplete(progress, id);
                        return <span key={id} style={{ ...tag(done?"rgba(34,197,94,0.15)":"rgba(255,255,255,0.05)", done?S.green:S.muted), padding:"4px 8px" }}>{done?"✓ ":""}{id}</span>;
                      })}
                    </div>
                  </div>
                  <div style={{ marginTop:8 }}>
                    <span style={{ color:S.muted,fontSize:10,fontFamily:S.mono }}>JOB BOARDS: </span>
                    {career.boards.map((b,j) => <a key={j} href={b} target="_blank" rel="noopener noreferrer" style={{ color:"#6ab0ff",fontSize:12,fontFamily:S.mono,marginRight:10 }}>{b.replace("https://","")}</a>)}
                  </div>
                </div>
                {/* Progress bar */}
                <div style={{ width:60,textAlign:"center",flexShrink:0 }}>
                  <div style={{ position:"relative",width:50,height:50,margin:"0 auto" }}>
                    <svg width={50} height={50} viewBox="0 0 50 50">
                      <circle cx={25} cy={25} r={20} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
                      <circle cx={25} cy={25} r={20} fill="none" stroke={pct===100?S.green:S.gold} strokeWidth={4}
                        strokeDasharray={`${(pct/100)*125.6} 125.6`} strokeLinecap="round"
                        transform="rotate(-90 25 25)" style={{ transition:"stroke-dasharray 0.5s" }} />
                    </svg>
                    <div style={{ position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:pct===100?S.green:S.gold,fontFamily:S.mono }}>{pct}%</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── FACULTY ────────────────────────────────────────────────────
  const renderFaculty = () => (
    <div>
      <div style={{ marginBottom:24 }}>
        <div style={heading()}>DISTINGUISHED FACULTY</div>
        <div style={{ color:S.bright,fontSize:22,fontWeight:700,fontFamily:S.serif,marginTop:6 }}>World-Class Professors</div>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(270px,1fr))",gap:14 }}>
        {Object.entries(PROFESSORS).map(([key, prof]) => {
          const courses = allCourses().filter(c => c.professor === key);
          return (
            <div key={key} style={{ background:S.card,borderRadius:14,padding:20,border:`1px solid ${S.border}` }}>
              <div style={{ display:"flex",alignItems:"center",gap:12,marginBottom:12 }}>
                <div style={{ width:48,height:48,borderRadius:12,background:prof.color,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,color:"#fff",fontSize:15,fontFamily:S.mono }}>{prof.avatar}</div>
                <div>
                  <div style={{ color:S.bright,fontSize:15,fontWeight:600,fontFamily:S.serif }}>{prof.name}</div>
                  <div style={{ color:prof.color,fontSize:11,fontWeight:600,fontFamily:S.mono }}>{prof.title}</div>
                </div>
              </div>
              <div style={{ color:"#8890a8",fontSize:13,lineHeight:1.5,fontFamily:S.serif,marginBottom:12 }}>{prof.bio}</div>
              {courses.length > 0 && (
                <div style={{ borderTop:`1px solid ${S.border}`,paddingTop:10 }}>
                  <div style={{ color:S.muted,fontSize:10,fontWeight:700,fontFamily:S.mono,letterSpacing:1.5,marginBottom:6 }}>TEACHES</div>
                  {courses.map(c => (
                    <div key={c.id} style={{ color:"#a0a8c0",fontSize:12,marginBottom:3,fontFamily:S.serif }}>
                      <span style={{ color:S.muted,fontFamily:S.mono,fontSize:10 }}>{c.code}</span> {c.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ─── GRADUATION MODAL ──────────────────────────────────────────
  const renderGradModal = () => showGrad && (
    <div style={{ position:"fixed",inset:0,background:"rgba(10,12,20,0.92)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",padding:16,backdropFilter:"blur(12px)" }}>
      <div style={{ background:"linear-gradient(135deg,#1a1d2e,#0f1118)",borderRadius:20,maxWidth:500,width:"100%",border:`2px solid rgba(240,192,64,0.3)`,padding:40,textAlign:"center" }}>
        <div style={{ fontSize:56,marginBottom:12 }}>🎓</div>
        <div style={{ ...heading(14), letterSpacing:3 }}>CONGRATULATIONS</div>
        <div style={{ color:S.bright,fontSize:28,fontWeight:700,fontFamily:S.serif,margin:"10px 0 4px" }}>Master of Crypto Science</div>
        <div style={{ color:"#8890a8",fontSize:14,fontFamily:S.serif }}>conferred upon</div>
        <div style={{ color:S.gold,fontSize:22,fontWeight:700,fontFamily:S.serif,margin:"8px 0" }}>{student}</div>
        <div style={{ color:"#8890a8",fontSize:13,fontFamily:S.serif }}>Satoshi University · School of Cryptographic Sciences</div>
        <div style={{ width:50,height:1,background:`linear-gradient(90deg,transparent,${S.gold},transparent)`,margin:"16px auto" }} />
        <div style={{ display:"flex",justifyContent:"center",gap:24,margin:"16px 0" }}>
          <div><div style={{ color:S.muted,fontSize:10,fontFamily:S.mono }}>GPA</div><div style={{ color:S.gold,fontSize:22,fontWeight:800,fontFamily:S.mono }}>{gpa}</div></div>
          <div><div style={{ color:S.muted,fontSize:10,fontFamily:S.mono }}>CREDITS</div><div style={{ color:S.gold,fontSize:22,fontWeight:800,fontFamily:S.mono }}>{creditsEarned("undergraduate")+creditsEarned("graduate")}</div></div>
        </div>
        <button onClick={() => setShowGrad(false)} style={btn(`linear-gradient(135deg,${S.gold},#e6a817)`,"#0a0c14",{ marginTop:12 })}>Accept Diploma →</button>
      </div>
    </div>
  );

  // ─── RENDER ─────────────────────────────────────────────────────
  return (
    <div style={{ minHeight:"100vh",background:S.bg,color:S.text,fontFamily:S.serif }}>
      {renderGradModal()}
      {/* Header */}
      <div style={{ padding:"16px 20px",borderBottom:`1px solid ${S.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10 }}>
        <div style={{ display:"flex",alignItems:"center",gap:12,cursor:"pointer" }} onClick={() => { setView("dashboard"); setActiveCourse(null); }}>
          <div style={{ width:38,height:38,borderRadius:9,background:`linear-gradient(135deg,${S.gold},#e6a817)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,fontWeight:900,color:"#0a0c14",fontFamily:S.mono }}>₿</div>
          <div>
            <div style={{ color:S.bright,fontSize:17,fontWeight:700,fontFamily:S.serif }}>Satoshi University</div>
            <div style={{ color:S.muted,fontSize:10,fontFamily:S.mono,letterSpacing:1 }}>EST. 2009 · SCHOOL OF CRYPTOGRAPHIC SCIENCES</div>
          </div>
        </div>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          {gpa !== "N/A" && <div style={tag("rgba(240,192,64,0.1)",S.gold)}>GPA {gpa}</div>}
          <div style={tag(graduated?"rgba(34,197,94,0.15)":"rgba(240,192,64,0.1)", graduated?S.green:S.gold)}>
            {graduated ? "✓ ALUMNUS" : ugDone ? "GRAD" : "UNDERGRAD"}
          </div>
        </div>
      </div>
      {renderNav()}
      <div style={{ padding:24,maxWidth:920,margin:"0 auto" }}>
        {view === "dashboard" && renderDashboard()}
        {view === "courses" && renderCourses()}
        {view === "transcript" && renderTranscript()}
        {view === "careers" && renderCareers()}
        {view === "faculty" && renderFaculty()}
      </div>
    </div>
  );
}
