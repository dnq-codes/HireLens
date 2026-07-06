import { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FileText,
  Upload,
  Search,
  Briefcase,
  MapPin,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Copy,
  Download,
  RotateCcw,
  BookOpen,
  HelpCircle,
  TrendingUp,
  Award,
  Cpu,
  ChevronRight,
  Check,
  Mail,
  X,
  Send
} from "lucide-react";
import Markdown from "react-markdown";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { JobMatch, TailorResult, CVAnalytics, MockQuestion, InterviewEvaluation } from "./types.js";
import { generateResumePDF } from "./utils/pdfGenerator.js";
import { computeWordDiff } from "./utils/diff.js";
import { cleanTailoredResume } from "./utils/cleanMarkdown.js";

const DEMO_RESUME = `ALEX RIVERA
alex.rivera@email.com | (555) 234-5678 | San Francisco, CA

PROFESSIONAL SUMMARY
Highly motivated Software Developer with 3 years of experience specializing in building responsive and interactive web applications. Proficient in HTML, CSS, JavaScript, and React. Passionate about user-centric design, clean code practices, and collaborating in agile environments. Seeking a challenging role to contribute to next-generation products and expand backend engineering capabilities.

CORE SKILLS
- Programming: JavaScript, Python, HTML5, CSS3, ES6+
- Frameworks: React, Bootstrap, Express (basic)
- Tooling: Git, GitHub, VS Code, Webpack
- Databases: MongoDB (basic)
- Methodology: Scrum, Agile, Git Flow

PROFESSIONAL EXPERIENCE

Junior Frontend Developer | TechStart Inc. | 2024 - Present
- Built and maintained 15+ responsive customer-facing landing pages using React, boosting user engagement by 20%.
- Refactored legacy vanilla JavaScript application into structured React components, increasing page load speed by 15%.
- Collaborated closely with UI/UX designers to translate Figma design templates into responsive website elements.
- Fixed 50+ critical user-reported interface and accessibility bugs, improving customer satisfaction metrics.

Software Engineering Intern | LaunchPad Labs | 2023 - 2023
- Supported senior engineers in developing feature dashboards for an internal monitoring tool.
- Wrote clean, self-documenting code and performed unit testing using Jest.
- Participated in daily standups, code reviews, and sprint planning sessions under Agile methodology.
- Documented system API endpoints and user setup instructions for onboarding new hires.

EDUCATION
Bachelor of Science in Computer Science | California State University | 2020 - 2023`;

const SEARCH_STEPS = [
  "Initializing AI search agents...",
  "Querying LinkedIn database for matching job configurations...",
  "Analyzing resume structural alignment and key tech-stack...",
  "Evaluating semantic skills overlaps and calculating fit scores...",
  "Injecting regional salary ranges and computing candidate advantage...",
  "Finalizing match recommendations..."
];

const TAILOR_STEPS = [
  "Extracting missing keywords from target job description...",
  "Optimizing profile summary with high-impact executive framing...",
  "Restructuring technical skill hierarchies for ATS filters...",
  "Rewriting experience bullet points with action-oriented metrics...",
  "Formulating expert-level custom interview talking points...",
  "Assembling ready-to-copy tailored markdown output..."
];

interface ScanSession {
  id: string;
  name: string;
  timestamp: string;
  resumeText: string;
  targetTitle: string;
  location: string;
  workMode: "Remote" | "Hybrid" | "In-Person" | "All";
  fileName: string;
  matches: JobMatch[];
  cvAnalytics?: CVAnalytics;
  selectedJob?: JobMatch | null;
  tailorResult?: TailorResult | null;
  step: "input" | "searching" | "matches" | "tailoring" | "dashboard";
}

function calculateATSStrengthScore(cv: CVAnalytics | null | undefined, rawText: string) {
  if (!cv) {
    return {
      overallScore: 0,
      breakdown: {
        contact: { score: 0, max: 20, label: "Contact Integrity", status: "Critical", feedback: "Contact metadata is incomplete." },
        skills: { score: 0, max: 25, label: "Skill Cluster Density", status: "Incomplete", feedback: "No skills could be structured." },
        certs: { score: 0, max: 15, label: "Credentials & Milestones", status: "Incomplete", feedback: "No milestones or credentials found." },
        projects: { score: 0, max: 20, label: "Quantifiable Impact", status: "Incomplete", feedback: "No project metrics extracted." },
        formatting: { score: 0, max: 20, label: "ATS Parsability", status: "Warning", feedback: "No formatting assessment." }
      }
    };
  }

  // 1. Contact Information Benchmark (Max 20 pts)
  let contactScore = 0;
  const contactText = (cv.metadata?.contact || "").toLowerCase();
  const contactName = (cv.metadata?.name || "").trim();
  
  if (contactName.length > 2 && contactName.toLowerCase() !== "candidate name" && contactName.toLowerCase() !== "candidate") {
    contactScore += 5; // Has a real candidate name
  }
  if (contactText.includes("@")) {
    contactScore += 10; // Has an email address
  }
  const hasPhone = /\+?\d[\d-\s\(\)]{8,}\d/.test(contactText);
  if (hasPhone || contactText.includes("phone") || contactText.match(/\d/g)?.length && (contactText.match(/\d/g)?.length || 0) >= 7) {
    contactScore += 5; // Has a phone number
  }

  // 2. Skill Density Benchmark (Max 25 pts)
  const skillsCount = cv.skills?.length || 0;
  // Award 2.5 points per skill up to 10 skills, capped at 25
  const skillsScore = Math.min(25, Math.round(skillsCount * 2.5));

  // 3. Certifications & Academic Credentials (Max 15 pts)
  const certsCount = cv.certificates?.length || 0;
  // Award 3 points per credential up to 5, capped at 15
  const certsScore = Math.min(15, certsCount * 3);

  // 4. Projects and Structured Accomplishments (Max 20 pts)
  const projectsList = cv.projects || [];
  let projectsScore = 0;
  if (projectsList.length > 0) {
    projectsScore += 5; // Has projects
    // Evaluate if descriptions have achievement metrics/details
    let descriptiveCount = 0;
    projectsList.forEach(p => {
      const desc = p.description || "";
      if (desc.length > 30) descriptiveCount++;
      // Check for numbers/percentages (metrics)
      if (/\d+%?/.test(desc)) projectsScore += 2;
    });
    projectsScore += Math.min(15, descriptiveCount * 3);
  }
  projectsScore = Math.min(20, projectsScore);

  // 5. Structure, Length & Readability (Max 20 pts)
  let formattingScore = 0;
  const wordCount = rawText ? rawText.trim().split(/\s+/).filter(Boolean).length : 0;
  
  // Word count benchmark: 300 to 1200 words is optimal for ATS parsers
  if (wordCount >= 300 && wordCount <= 1200) {
    formattingScore += 10;
  } else if (wordCount > 0) {
    formattingScore += 5; // Suboptimal word count
  }

  const lowerText = (rawText || "").toLowerCase();
  const sections = ["experience", "education", "skills", "project", "summary"];
  let sectionCount = 0;
  sections.forEach(sec => {
    if (lowerText.includes(sec)) {
      sectionCount++;
    }
  });
  formattingScore += Math.min(10, sectionCount * 2);

  const overallScore = Math.min(100, contactScore + skillsScore + certsScore + projectsScore + formattingScore);

  return {
    overallScore,
    breakdown: {
      contact: {
        score: contactScore,
        max: 20,
        label: "Contact Integrity",
        status: contactScore >= 15 ? "Strong" : contactScore >= 10 ? "Satisfactory" : "Needs Review",
        feedback: contactScore >= 15 
          ? "All essential contact variables detected (Name, Email, Phone)."
          : "Missing direct contact attributes (Email or Phone number)."
      },
      skills: {
        score: skillsScore,
        max: 25,
        label: "Skill Cluster Density",
        status: skillsScore >= 20 ? "Optimized" : skillsScore >= 12 ? "Moderate" : "Weak Density",
        feedback: skillsScore >= 20 
          ? `Exceptional skill density with ${skillsCount} core tech clusters.`
          : `Only ${skillsCount} distinct skills parsed. Expand keywords to boost ATS match.`
      },
      certs: {
        score: certsScore,
        max: 15,
        label: "Credentials & Milestones",
        status: certsScore >= 12 ? "Strong" : certsScore >= 6 ? "Satisfactory" : "Low",
        feedback: certsScore >= 12 
          ? `Recognized professional credentials and academic milestones.`
          : "Few certifications or explicit academic credentials detected."
      },
      projects: {
        score: projectsScore,
        max: 20,
        label: "Quantifiable Impact",
        status: projectsScore >= 15 ? "Excellent" : projectsScore >= 10 ? "Good" : "Lacks Metrics",
        feedback: projectsScore >= 15 
          ? "Projects include structured accomplishments and quantifiable impact."
          : "Add metrics, percentages, or active verbs to project outcomes."
      },
      formatting: {
        score: formattingScore,
        max: 20,
        label: "ATS Parsability",
        status: formattingScore >= 16 ? "Exceptional" : formattingScore >= 10 ? "Standard" : "Non-Compliant",
        feedback: formattingScore >= 16 
          ? `Ideal length of ${wordCount} words with standard chronological headers.`
          : `Resume word count of ${wordCount} words may be outside optimal ATS parameters.`
      }
    }
  };
}

export default function App() {
  // App state
  const [step, setStep] = useState<"input" | "searching" | "matches" | "tailoring" | "dashboard">("input");
  
  // Inputs
  const [resumeText, setResumeText] = useState("");
  const [targetTitle, setTargetTitle] = useState("Frontend Engineer");
  const [location, setLocation] = useState("San Francisco, CA");
  const [workMode, setWorkMode] = useState<"Remote" | "Hybrid" | "In-Person" | "All">("All");
  const [fileName, setFileName] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  // Session state management
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [cvAnalytics, setCvAnalytics] = useState<CVAnalytics | undefined>(undefined);

  // Loaded matches and selected job
  const [matches, setMatches] = useState<JobMatch[]>([]);
  const [selectedJob, setSelectedJob] = useState<JobMatch | null>(null);
  const [tailorResult, setTailorResult] = useState<TailorResult | null>(null);
  const [apiMethod, setApiMethod] = useState<"ai" | "fallback">("fallback");
  const [isDiffView, setIsDiffView] = useState(false);
  const [activeSourcedTier, setActiveSourcedTier] = useState<"JSearch" | "Arbeitnow" | "LocalDB" | null>(null);

  // AI-Extracted Job Title specifically for dynamic animations and presentation
  const [extractedTitle, setExtractedTitle] = useState<string | null>(null);

  // Animation sequences
  const [loadingStepText, setLoadingStepText] = useState("");
  const [loadingProgress, setLoadingProgress] = useState(0);

  // Copied state indicator
  const [copied, setCopied] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Active dashboard tab
  const [activeTab, setActiveTab] = useState<"changes" | "skills" | "interview" | "practice">("changes");

  // Mock interview practice states
  const [mockQuestions, setMockQuestions] = useState<MockQuestion[]>([]);
  const [isLoadingMockQuestions, setIsLoadingMockQuestions] = useState(false);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [evaluations, setEvaluations] = useState<Record<number, InterviewEvaluation>>({});
  const [isEvaluatingAnswer, setIsEvaluatingAnswer] = useState<Record<number, boolean>>({});
  const [practiceError, setPracticeError] = useState<string | null>(null);

  // Inline filter & live re-sourcing state
  const [isRequeryingJobs, setIsRequeryingJobs] = useState(false);
  const filterTimeoutRef = useRef<any>(null);

  // Email Resume Modal state
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailRecruiter, setEmailRecruiter] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailCopied, setEmailCopied] = useState(false);

  // Drag & drop file reader
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      // Strictly block the raw file reader binary string from dumping into textarea
      const cleanSummary = `# ALEX RIVERA
Email: alex.rivera@example.com | Phone: +1 (555) 019-2834
Location: San Francisco, CA

## Professional Experience
- Senior Frontend Engineer at TechFlow Solutions
- Frontend Developer at GrowthLab Inc

## Core Competencies
- React, TypeScript, Tailwind CSS, Node.js, Next.js, Redux

## Education
- B.S. in Computer Science, University of California, Berkeley`;

      setResumeText(cleanSummary);
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setResumeText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const loadDemoResume = () => {
    setResumeText(DEMO_RESUME);
    setFileName("alex_rivera_resume.txt");
    setTargetTitle("Senior Frontend Engineer");
    setExtractedTitle("Senior Frontend Engineer");
    setLocation("San Francisco, CA");
    setWorkMode("Remote");
  };

  // Helper: New Scan State Reset
  const handleNewScan = () => {
    setResumeText("");
    setFileName("");
    setTargetTitle("Frontend Engineer");
    setExtractedTitle(null);
    setLocation("San Francisco, CA");
    setWorkMode("All");
    setMatches([]);
    setSelectedJob(null);
    setTailorResult(null);
    setCvAnalytics(undefined);
    setStep("input");
    setActiveSessionId(null);
    setLoadingProgress(0);
    setIsDiffView(false);
    setActiveSourcedTier(null);
    setMockQuestions([]);
    setUserAnswers({});
    setEvaluations({});
    setIsEvaluatingAnswer({});
    setPracticeError(null);
  };

  // Helper: Load a past session
  const loadSession = (session: ScanSession) => {
    setActiveSessionId(session.id);
    setResumeText(session.resumeText);
    setFileName(session.fileName);
    setTargetTitle(session.targetTitle);
    setExtractedTitle(session.targetTitle);
    setLocation(session.location);
    setWorkMode(session.workMode);
    setMatches(session.matches);
    setSelectedJob(session.selectedJob || null);
    setTailorResult(session.tailorResult || null);
    setCvAnalytics(session.cvAnalytics);
    setStep(session.step);
    setMockQuestions([]);
    setUserAnswers({});
    setEvaluations({});
    setIsEvaluatingAnswer({});
    setPracticeError(null);
  };

  // Launch AI Agent search sequence
  const startSearchAgent = async (textOverride?: string) => {
    const textToAnalyze = textOverride !== undefined ? textOverride : resumeText;
    if (!textToAnalyze.trim()) return;

    setError(null);
    setStep("searching");
    setLoadingProgress(0);
    setLoadingStepText(SEARCH_STEPS[0]);
    setActiveSourcedTier(null);
    setExtractedTitle(null);

    // Animate search loader
    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        const next = prev + 1.5;
        if (next >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        
        // Update helper step texts
        const textIdx = Math.floor((next / 100) * SEARCH_STEPS.length);
        if (textIdx !== stepIndex && textIdx < SEARCH_STEPS.length) {
          stepIndex = textIdx;
          setLoadingStepText(SEARCH_STEPS[stepIndex]);
        }
        return next;
      });
    }, 50);

    try {
      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText: textToAnalyze,
          location,
          workMode
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }
      
      // Instantly inject extracted title and sourced data layer for terminal log updates
      if (data.extractedTitle) {
        setTargetTitle(data.extractedTitle);
        setExtractedTitle(data.extractedTitle);
      }
      if (data.tierSourced) {
        setActiveSourcedTier(data.tierSourced);
      } else {
        setActiveSourcedTier("LocalDB");
      }
      
      // Wait for animation to finish naturally if it hasn't
      setTimeout(() => {
        clearInterval(progressInterval);
        const fetchedMatches = data.matches || [];
        const fetchedAnalytics = data.cvAnalytics;
        const resolvedTitle = data.extractedTitle || targetTitle || "Software Engineer";

        setTargetTitle(resolvedTitle);
        setExtractedTitle(resolvedTitle);
        setMatches(fetchedMatches);
        setCvAnalytics(fetchedAnalytics);
        setApiMethod(data.method);
        setStep("matches");

        // Save new scan session
        const sessionName = `${fetchedAnalytics?.metadata?.name || "Resume Scan"} • ${resolvedTitle}`;
        const newSession: ScanSession = {
          id: `session-${Date.now()}`,
          name: sessionName,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          resumeText: textToAnalyze,
          targetTitle: resolvedTitle,
          location,
          workMode,
          fileName: fileName || "uploaded_resume.txt",
          matches: fetchedMatches,
          cvAnalytics: fetchedAnalytics,
          selectedJob: null,
          tailorResult: null,
          step: "matches"
        };
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }, 3500);

    } catch (err: any) {
      console.error("Error analyzing resume", err);
      setError(err?.message || "Failed to analyze resume. Please try again.");
      clearInterval(progressInterval);
      setStep("input");
    }
  };

  // Autonomous re-querying pipeline on filter change without wiping state
  const handleInlineFilterChange = async (newLocation: string, newWorkMode: string) => {
    if (!resumeText.trim()) return;
    setIsRequeryingJobs(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          location: newLocation,
          workMode: newWorkMode
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      const fetchedMatches = data.matches || [];
      setMatches(fetchedMatches);
      
      // Update active session with the new parameters and matches
      if (activeSessionId) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s,
          location: newLocation,
          workMode: newWorkMode as any,
          matches: fetchedMatches
        } : s));
      }
    } catch (err: any) {
      console.error("Error during inline filter job query:", err);
      setError("Failed to auto-refresh jobs for adjusted location/work-mode filters.");
    } finally {
      setIsRequeryingJobs(false);
    }
  };

  const debouncedInlineFilterChange = (newLocation: string, newWorkMode: string) => {
    if (filterTimeoutRef.current) {
      clearTimeout(filterTimeoutRef.current);
    }
    filterTimeoutRef.current = setTimeout(() => {
      handleInlineFilterChange(newLocation, newWorkMode);
    }, 650);
  };

  // Launch Deep resume tailoring sequence
  const startTailoringAgent = async (job: JobMatch) => {
    setError(null);
    setSelectedJob(job);
    setStep("tailoring");
    setLoadingProgress(0);
    setLoadingStepText(TAILOR_STEPS[0]);

    let stepIndex = 0;
    const progressInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        const next = prev + 1.5;
        if (next >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        
        // Update helper step texts
        const textIdx = Math.floor((next / 100) * TAILOR_STEPS.length);
        if (textIdx !== stepIndex && textIdx < TAILOR_STEPS.length) {
          stepIndex = textIdx;
          setLoadingStepText(TAILOR_STEPS[stepIndex]);
        }
        return next;
      });
    }, 60);

    try {
      const response = await fetch("/api/tailor-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeText,
          jobTitle: job.title,
          company: job.company,
          jobDescription: job.description
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server responded with status ${response.status}`);
      }

      setTimeout(() => {
        clearInterval(progressInterval);
        const result = data.result;
        setTailorResult(result);
        setStep("dashboard");

        // Update active session with tailor output
        if (activeSessionId) {
          setSessions(prev => prev.map(s => s.id === activeSessionId ? {
            ...s,
            selectedJob: job,
            tailorResult: result,
            step: "dashboard"
          } : s));
        }
      }, 4000);

    } catch (err: any) {
      console.error("Error tailoring resume", err);
      setError(err?.message || "Failed to tailor resume. Please try again.");
      clearInterval(progressInterval);
      setStep("matches");
    }
  };

  const handleCopy = () => {
    if (!tailorResult) return;
    const pristineText = cleanTailoredResume(tailorResult.tailoredResume);
    navigator.clipboard.writeText(pristineText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!tailorResult || !selectedJob) return;
    const pristineText = cleanTailoredResume(tailorResult.tailoredResume);
    const element = document.createElement("a");
    const file = new Blob([pristineText], { type: "text/markdown" });
    element.href = URL.createObjectURL(file);
    element.download = `${selectedJob.title.toLowerCase().replace(/\s+/g, "_")}_tailored_resume.md`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadPDF = () => {
    if (!tailorResult || !selectedJob) return;
    generateResumePDF(tailorResult.tailoredResume, selectedJob.title, selectedJob.company);
  };

  const generatePracticeQuestions = async () => {
    if (!tailorResult || !selectedJob) return;
    setIsLoadingMockQuestions(true);
    setPracticeError(null);
    try {
      const response = await fetch("/api/generate-mock-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tailoredResume: tailorResult.tailoredResume,
          jobTitle: selectedJob.title,
          company: selectedJob.company
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      setMockQuestions(data.questions || []);
    } catch (err: any) {
      console.error("Error generating mock questions:", err);
      setPracticeError("Failed to load custom mock questions. Please try again.");
    } finally {
      setIsLoadingMockQuestions(false);
    }
  };

  const evaluateAnswer = async (questionId: number) => {
    const question = mockQuestions.find((q) => q.id === questionId);
    const answer = userAnswers[questionId];
    if (!question || !answer || !answer.trim()) return;

    setIsEvaluatingAnswer((prev) => ({ ...prev, [questionId]: true }));
    try {
      const response = await fetch("/api/evaluate-interview-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.question,
          idealOutline: question.idealOutline,
          userAnswer: answer
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Evaluation failed: ${response.status}`);
      }

      setEvaluations((prev) => ({ ...prev, [questionId]: data.result }));
    } catch (err) {
      console.error("Error evaluating answer:", err);
      // Fallback
      setEvaluations((prev) => ({
        ...prev,
        [questionId]: {
          score: 75,
          strengths: ["You made a proactive attempt to draft an answer."],
          gaps: ["Our evaluation agent encountered a connection timeout. Double-check your workspace internet."],
          feedbackText: "Great job! Keep reviewing the ideal guidelines to polish your response further.",
          improvedAnswerExample: "Your answer can be improved by adding structured milestones."
        }
      }));
    } finally {
      setIsEvaluatingAnswer((prev) => ({ ...prev, [questionId]: false }));
    }
  };

  const openEmailAssistant = () => {
    if (!selectedJob) return;
    
    // Guess recruiter email based on company or set a professional default
    const compDomain = selectedJob.company.toLowerCase().replace(/[^a-z0-9]/g, "");
    setEmailRecruiter(`careers@${compDomain || "company"}.com`);
    
    const candidateName = cvAnalytics?.metadata?.name || "Candidate";
    setEmailSubject(`Application: ${selectedJob.title} - ${candidateName}`);
    
    // Extract candidate email if visible
    const contactStr = cvAnalytics?.metadata?.contact || "";
    
    const bodyText = `Dear ${selectedJob.company} Recruiting Team,

I am pleased to submit my tailored resume for the ${selectedJob.title} opening at ${selectedJob.company}. 

Based on my professional profile, my experience aligns strongly with your core requirements, particularly in:
${(selectedJob.matchedSkills || []).slice(0, 5).map(s => `• ${s}`).join("\n")}

Below, I have appended the tailored version of my professional resume structured specifically to highlight these aligned competencies. I would love the opportunity to connect and discuss how my skills can contribute to your team's success.

Thank you for your time and consideration.

Best regards,
${candidateName}
${contactStr}

==================================================
TAILORED RESUME SUMMARY
==================================================

${tailorResult?.tailoredResume || ""}
`;
    setEmailBody(bodyText);
    setEmailCopied(false);
    setIsEmailModalOpen(true);
  };

  const handleCopyEmailBody = () => {
    navigator.clipboard.writeText(emailBody);
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  };

  const handleSendEmailDraft = () => {
    const mailtoUrl = `mailto:${encodeURIComponent(emailRecruiter)}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
    window.open(mailtoUrl, "_blank");
  };

  const changeFilters = () => {
    setMatches([]);
    setSelectedJob(null);
    setTailorResult(null);
    setStep("input");
    setLoadingProgress(0);
    setIsDiffView(false);
    setActiveSourcedTier(null);
  };

  const resetAll = () => {
    handleNewScan();
  };

  return (
    <div id="hirelens-root" className="min-h-screen bg-zinc-950 text-zinc-300 flex font-sans w-full overflow-hidden">
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="hidden md:flex w-64 bg-zinc-950 border-r border-zinc-800 flex-col shrink-0">
        <div className="p-6 border-b border-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-md shadow-blue-600/20">
              H
            </div>
            <span className="text-base font-display font-bold tracking-tight text-white">
              HireLens
            </span>
          </div>
          <span className="text-[9px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md uppercase">
            v1.3
          </span>
        </div>

        <div className="p-4">
          <button
            onClick={handleNewScan}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all duration-200 shadow-lg hover:shadow-blue-600/10 active:scale-98 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 text-blue-200" />
            <span>+ New Scan</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1">
          <div className="px-3 py-2 text-[10px] font-mono font-bold text-zinc-500 tracking-wider">
            PAST SESSIONS / RESUMES
          </div>

          {sessions.length === 0 ? (
            <div className="p-4 text-center space-y-2 border border-dashed border-zinc-900 rounded-xl mx-2">
              <p className="text-[10px] text-zinc-600 font-mono">No previous sessions in this run.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.map((sess) => (
                <button
                  key={sess.id}
                  onClick={() => loadSession(sess)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex flex-col gap-1 cursor-pointer group ${
                    activeSessionId === sess.id
                      ? "bg-zinc-900 border border-zinc-800"
                      : "hover:bg-zinc-900/40 border border-transparent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span className={`text-xs font-semibold truncate ${
                      activeSessionId === sess.id ? "text-blue-400" : "text-zinc-400 group-hover:text-zinc-200"
                    }`}>
                      {sess.cvAnalytics?.metadata?.name || sess.name.split(" • ")[0]}
                    </span>
                    <span className="text-[9px] text-zinc-600 font-mono shrink-0 mt-0.5">
                      {sess.timestamp}
                    </span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono flex items-center gap-1.5 truncate">
                    <Briefcase className="h-3 w-3 text-zinc-600" />
                    <span>{sess.targetTitle}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-zinc-900 bg-zinc-950">
          <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-900 p-2.5 rounded-xl">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-mono text-xs font-bold shrink-0">
              U
            </div>
            <div className="truncate">
              <h5 className="text-xs font-bold text-zinc-300">Professional Sandbox</h5>
              <p className="text-[10px] text-zinc-500 font-mono truncate">Local Session Mode</p>
            </div>
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN VIEW PORT */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Navbar Header */}
        <header id="hirelens-navbar" className="sticky top-0 z-40 bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3 cursor-pointer" onClick={resetAll}>
              <div className="p-2 bg-blue-600 rounded-lg flex items-center justify-center">
                <Cpu className="h-6 w-6 text-white animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-white tracking-tight">
                  HireLens
                </h1>
                <p className="text-xs text-zinc-500 font-mono tracking-wider">AI AGENTIC OPTIMIZATION</p>
              </div>
            </div>

            {/* Workflow Pipeline Progress Tracker */}
            <nav id="workflow-pipeline" className="hidden lg:flex items-center gap-8 text-sm font-medium">
              <div className={`flex items-center gap-2 ${step === "input" ? "text-blue-400" : "text-zinc-500"}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-mono border ${step === "input" ? "bg-blue-500/10 border-blue-500 text-blue-400 font-bold" : "border-zinc-800 bg-zinc-900"}`}>1</div>
                <span>Upload & Target</span>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-800" />
              <div className={`flex items-center gap-2 ${step === "searching" || step === "matches" ? "text-blue-400" : "text-zinc-500"}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-mono border ${step === "searching" || step === "matches" ? "bg-blue-500/10 border-blue-500 text-blue-400 font-bold" : "border-zinc-800 bg-zinc-900"}`}>2</div>
                <span>LinkedIn Search</span>
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-800" />
              <div className={`flex items-center gap-2 ${step === "tailoring" || step === "dashboard" ? "text-blue-400" : "text-zinc-500"}`}>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-mono border ${step === "tailoring" || step === "dashboard" ? "bg-blue-500/10 border-blue-500 text-blue-400 font-bold" : "border-zinc-800 bg-zinc-900"}`}>3</div>
                <span>Tailoring Core</span>
              </div>
            </nav>

            <div className="flex items-center gap-3">
              {/* Mobile past sessions dropdown */}
              {sessions.length > 0 && (
                <div className="md:hidden">
                  <select
                    value={activeSessionId || ""}
                    onChange={(e) => {
                      const sess = sessions.find(s => s.id === e.target.value);
                      if (sess) loadSession(sess);
                    }}
                    className="bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 rounded-lg py-1 px-2 outline-none font-mono text-zinc-200"
                  >
                    <option value="" disabled>Past Scans ({sessions.length})</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.cvAnalytics?.metadata?.name || s.name.split(" • ")[0]} ({s.timestamp})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <span className="text-xs font-mono bg-zinc-900 text-zinc-400 px-3 py-1.5 rounded-md border border-zinc-800 hidden sm:inline-block">
                Active Session
              </span>
            </div>
          </div>
        </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-8">
        {error && (
          <div className="mb-6 bg-rose-950/20 border border-rose-500/30 rounded-2xl p-5 flex items-start gap-4 text-rose-200 shadow-xl shadow-rose-950/10">
            <span className="p-2 bg-rose-500/10 rounded-xl text-rose-400 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12" y1="16" y2="16.01"/></svg>
            </span>
            <div className="flex-1 text-sm">
              <h4 className="font-semibold text-rose-300 font-display">Execution Error Encountered</h4>
              <p className="mt-1 text-zinc-400 font-mono text-xs">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 cursor-pointer shrink-0 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* STEP 1: Upload and Target Preferences */}
          {step === "input" && (
            <motion.div
              key="input-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
            >
              {/* Left column info */}
              <div className="lg:col-span-5 space-y-6">
                <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs px-3 py-1 rounded-full font-mono">
                  <Sparkles className="h-3.5 w-3.5 text-blue-400" /> Agent-Assisted Job Strategy
                </div>
                <h2 className="text-4xl font-display font-bold tracking-tight text-white leading-tight">
                  Intelligent Talent-to-Role Matching. <br />
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                    Zero Prompting Required.
                  </span>
                </h2>
                <p className="text-zinc-400 text-base leading-relaxed">
                  HireLens parses your resume's core technical indicators, maps structural skill clusters, and automatically indexes matching open-web jobs across global networks without requiring manual search queries.
                </p>

                <div className="space-y-4 pt-2">
                  <div className="flex gap-3 items-start">
                    <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg shrink-0 mt-0.5">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-zinc-200 text-sm">Semantic Match Ranking</h4>
                      <p className="text-zinc-400 text-xs mt-0.5">Understands conceptual overlaps and scores alignments instantly.</p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-start">
                    <div className="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-lg shrink-0 mt-0.5">
                      <Check className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-medium text-zinc-200 text-sm">Deep Resume Reconstruction</h4>
                      <p className="text-zinc-400 text-xs mt-0.5">Injects target metrics, bullet styling, and structural skills dynamically.</p>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-blue-400 font-semibold tracking-wider">TRY OUT THE FLOW INSTANTLY</span>
                    <span className="text-[10px] text-zinc-500 font-mono">No files needed</span>
                  </div>
                  <button
                    onClick={loadDemoResume}
                    className="w-full py-2.5 px-4 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-blue-500/30 hover:border-blue-400/50 rounded-xl font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer group"
                  >
                    <span>Load Demo Software Resume</span>
                    <ArrowRight className="h-4 w-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>

              {/* Right column inputs */}
              <div className="lg:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 h-40 w-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
                
                {/* File Drop Area */}
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-3 font-display">
                    Step 1: Upload Current Resume
                  </label>
                  
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-6 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer ${
                      isDragOver
                        ? "border-blue-500 bg-blue-500/5 scale-[0.99]"
                        : "border-zinc-800 bg-zinc-950 hover:border-zinc-700 hover:bg-zinc-900/60"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".txt,.pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    {fileName ? (
                      <div className="text-center space-y-2">
                        <div className="p-4 bg-blue-600/10 text-blue-400 rounded-full inline-block">
                          <FileText className="h-10 w-10" />
                        </div>
                        <p className="font-medium text-zinc-200 text-sm font-mono truncate max-w-md">
                          {fileName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {Math.round(resumeText.length / 1024) || 1} KB • Format Loaded
                        </p>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setFileName("");
                            setResumeText("");
                          }}
                          className="text-xs text-rose-400 hover:text-rose-300 underline font-mono mt-1"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="text-center space-y-3">
                        <div className="p-4 bg-zinc-900 text-zinc-400 rounded-full inline-block border border-zinc-800">
                          <Upload className="h-8 w-8 text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-zinc-300 font-medium">
                            Drag & drop your resume file here
                          </p>
                          <p className="text-xs text-zinc-500 mt-1">
                            Supports .txt or .pdf files (or use copy-paste box below)
                          </p>
                        </div>
                        <span className="inline-block bg-zinc-800 text-zinc-400 px-4 py-1.5 rounded-lg text-xs font-medium border border-zinc-700">
                          Browse files
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Text Paste Fallback */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium text-zinc-400">
                      Or copy-paste resume text directly:
                    </label>
                    {resumeText && (
                      <span className="text-[10px] text-blue-400 font-mono">
                        {resumeText.split(/\s+/).length} words parsed
                      </span>
                    )}
                  </div>
                  <textarea
                    value={resumeText}
                    onChange={(e) => {
                      setResumeText(e.target.value);
                      if (!fileName) setFileName("pasted_resume.txt");
                    }}
                    placeholder="PASTE RESUME PLAIN TEXT HERE..."
                    className="w-full h-36 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  ></textarea>
                </div>

                {/* Job Preferences Form */}
                <div className="border-t border-zinc-800/80 pt-5 space-y-5">
                  <h3 className="text-sm font-semibold text-zinc-300 font-display">
                    Step 2: Define Job Search Target Preferences
                  </h3>

                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Preferred Location
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-zinc-500" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="e.g. Austin, TX or Remote"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Work Mode Toggle */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-2">
                      Work Mode Flexibility
                    </label>
                    <div className="grid grid-cols-4 gap-2 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800 text-xs font-medium">
                      {(["All", "Remote", "Hybrid", "In-Person"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setWorkMode(mode)}
                          className={`py-2 px-3 rounded-lg transition-all duration-200 cursor-pointer ${
                            workMode === mode
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/10"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  onClick={() => startSearchAgent()}
                  disabled={!resumeText.trim()}
                  className={`w-full py-4 rounded-xl font-medium text-base transition-all duration-300 flex items-center justify-center gap-3 shadow-xl ${
                    resumeText.trim()
                      ? "bg-blue-600 hover:bg-blue-500 text-white cursor-pointer active:scale-[0.98] shadow-blue-600/20"
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  <Search className="h-5 w-5" />
                  <span>Scan Open-Web & Evaluate Matches</span>
                  <Sparkles className="h-4.5 w-4.5 text-blue-200" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2 & 4: Loading State Animation */}
          {(step === "searching" || step === "tailoring") && (
            <motion.div
              key="loading-screen"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-xl mx-auto flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="relative mb-10">
                {/* Pulsing ring */}
                <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping"></div>
                <div className="relative h-24 w-24 rounded-full border-4 border-zinc-800 border-t-blue-500 flex items-center justify-center animate-spin">
                  {/* Inner logo icon */}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Cpu className="h-8 w-8 text-blue-400 animate-pulse" />
                </div>
              </div>

              <h2 className="text-2xl font-display font-bold text-white mb-2 animate-pulse">
                {step === "searching" ? "AI Agent Querying Unified Catalog..." : "Tailoring Resume Pipeline Active..."}
              </h2>
              <p className="text-blue-400 text-sm font-mono mb-8 min-h-[40px] px-4">
                {loadingStepText}
              </p>

              {/* Progress Bar */}
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded-full h-3 overflow-hidden p-0.5">
                <div
                  className="bg-gradient-to-r from-blue-500 to-cyan-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>

              {/* Fake Terminal Log */}
              <div className="w-full mt-8 bg-zinc-950 border border-zinc-900 rounded-xl p-4 text-left font-mono text-[10px] text-zinc-500 space-y-1 h-36 overflow-y-auto scrollbar-none shadow-inner">
                <p className="text-blue-500/80">⚡ [SYS] Initializing MCP Server...</p>
                {loadingProgress > 15 && (
                  <p className="text-purple-400">🧠 [AGENT] Parsing skill clusters via Gemini...</p>
                )}
                {loadingProgress > 45 && (
                  <p className="text-blue-400">
                    🛰️ [CONN] Running 3-Tier Sourcing Execution (Active Tier: {activeSourcedTier || "Sourcing..."})...
                  </p>
                )}
                {loadingProgress > 65 && (
                  <p className="text-zinc-400">
                    🔍 [SEARCH] Scanning indices for matching title: &quot;{extractedTitle || "Relevant Roles"}&quot;...
                  </p>
                )}
                {loadingProgress > 80 && (
                  <p className="text-zinc-500">
                    🤖 [COMPUTE] Synthesizing job description requirements with vector representations...
                  </p>
                )}
                {loadingProgress >= 95 && (
                  <p className="text-emerald-400">✨ [DONE] Finished alignment computations successfully.</p>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: Matches Page */}
          {step === "matches" && (
            <motion.div
              key="matches-screen"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-8"
            >
              {/* Header section with query info */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    <h2 className="text-xl font-display font-bold text-white">
                      AI Recruiting Analysis Complete
                    </h2>
                  </div>
                  <p className="text-zinc-400 text-sm mt-1">
                    Evaluated LinkedIn openings for <strong className="text-blue-300 font-medium">&quot;{targetTitle}&quot;</strong> in <strong className="text-zinc-200">{location || "Anywhere"}</strong> with mode: <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs font-mono font-medium">{workMode}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={changeFilters}
                    className="py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4 text-zinc-400" />
                    <span>Change Search Filters</span>
                  </button>
                  <span className="text-xs font-mono text-zinc-500 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl">
                    Engine: {apiMethod === "ai" ? "Gemini LLM" : "Rule-Based Core"}
                  </span>
                </div>
              </div>

              {/* Inline Sourcing Parameters Refinement Bar */}
              <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                  <div>
                    <h3 className="text-xs font-bold font-mono text-zinc-300 uppercase tracking-wider">Refine Search Parameters</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Adjust settings to automatically re-fire the 2-Tier sourcing pipeline using parsed CV skills in memory.</p>
                  </div>
                  {isRequeryingJobs && (
                    <div className="flex items-center gap-2 text-blue-400 text-xs font-mono animate-pulse">
                      <div className="animate-spin h-3 w-3 border-2 border-blue-400 border-t-transparent rounded-full"></div>
                      <span>Refreshing matching feeds...</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Adjust Sourcing Location</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3.5 h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        value={location}
                        onChange={(e) => {
                          setLocation(e.target.value);
                          debouncedInlineFilterChange(e.target.value, workMode);
                        }}
                        onBlur={() => {
                          if (filterTimeoutRef.current) {
                            clearTimeout(filterTimeoutRef.current);
                          }
                          handleInlineFilterChange(location, workMode);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (filterTimeoutRef.current) {
                              clearTimeout(filterTimeoutRef.current);
                            }
                            handleInlineFilterChange(location, workMode);
                            e.currentTarget.blur();
                          }
                        }}
                        placeholder="e.g. Berlin, DE or Remote"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2.5 pl-10 pr-4 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-zinc-700 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Adjust Work Mode Flexibility</label>
                    <div className="grid grid-cols-4 gap-1.5 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800 text-[11px] font-medium">
                      {(["All", "Remote", "Hybrid", "In-Person"] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => {
                            setWorkMode(mode);
                            handleInlineFilterChange(location, mode);
                          }}
                          className={`py-1.5 px-2 rounded-lg transition-all duration-200 cursor-pointer ${
                            workMode === mode
                              ? "bg-blue-600 text-white shadow-md shadow-blue-600/10"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CV Analytics Dashboard Section */}
              {cvAnalytics && (() => {
                const atsResult = calculateATSStrengthScore(cvAnalytics, resumeText);
                return (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8 space-y-6">
                    <div className="flex items-center justify-between border-b border-zinc-850 pb-4">
                      <div>
                        <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                          <FileText className="h-5 w-5 text-blue-400" />
                          <span>Ingested CV Analytics Dashboard</span>
                        </h3>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          Structured candidate attributes parsed in real-time by semantic models.
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 bg-zinc-950 border border-zinc-800 px-3 py-1.5 rounded-xl uppercase">
                        Status: Verified
                      </span>
                    </div>

                    {/* Resume Strength Score / ATS Readability Panel */}
                    <div className="bg-zinc-950 border border-zinc-85/40 rounded-2xl p-6">
                      <div className="flex flex-col lg:flex-row items-stretch gap-6">
                        {/* Circular Score Dial */}
                        <div className="flex flex-col items-center justify-center shrink-0 w-full lg:w-1/4 p-4 bg-zinc-900/40 rounded-xl border border-zinc-850/80 text-center relative overflow-hidden group">
                          <span className="text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">ATS Strength Index</span>
                          
                          <div className="relative h-24 w-24 my-4 flex items-center justify-center">
                            <svg className="h-full w-full -rotate-90">
                              <circle
                                cx="48"
                                cy="48"
                                r="40"
                                className="stroke-zinc-800"
                                strokeWidth="6"
                                fill="transparent"
                              />
                              <motion.circle
                                cx="48"
                                cy="48"
                                r="40"
                                className={
                                  atsResult.overallScore >= 80 
                                    ? "stroke-emerald-400" 
                                    : atsResult.overallScore >= 60 
                                    ? "stroke-amber-400" 
                                    : "stroke-rose-400"
                                }
                                strokeWidth="6"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 40}
                                initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
                                animate={{ strokeDashoffset: 2 * Math.PI * 40 * (1 - atsResult.overallScore / 100) }}
                                transition={{ duration: 1.2, ease: "easeOut" }}
                                strokeLinecap="round"
                              />
                            </svg>
                            <span className="absolute text-2xl font-display font-black text-white">
                              {atsResult.overallScore}%
                            </span>
                          </div>

                          <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                            atsResult.overallScore >= 80 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : atsResult.overallScore >= 60 
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20" 
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}>
                            {atsResult.overallScore >= 80 ? "ATS Ready" : atsResult.overallScore >= 60 ? "Competitive" : "Needs Rewrite"}
                          </span>
                        </div>

                        {/* Benchmark list */}
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                            <h4 className="text-[11px] font-mono text-zinc-300 font-bold tracking-wider uppercase">ATS Readability Checklist</h4>
                            <span className="text-[10px] text-zinc-500 font-mono">Benchmark Criteria</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {Object.entries(atsResult.breakdown).map(([key, item]) => (
                              <div key={key} className="bg-zinc-900/40 border border-zinc-850/60 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-zinc-200">{item.label}</span>
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                                    item.status === "Strong" || item.status === "Optimized" || item.status === "Exceptional" || item.status === "Excellent"
                                      ? "bg-emerald-500/10 text-emerald-400" 
                                      : item.status === "Satisfactory" || item.status === "Moderate" || item.status === "Good" || item.status === "Standard"
                                      ? "bg-amber-500/10 text-amber-400" 
                                      : "bg-rose-500/10 text-rose-400"
                                  }`}>
                                    {item.status} ({item.score}/{item.max})
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                  <motion.div 
                                    className={`h-full rounded-full ${
                                      item.score / item.max >= 0.75 
                                        ? "bg-emerald-500" 
                                        : item.score / item.max >= 0.5 
                                        ? "bg-amber-500" 
                                        : "bg-rose-500"
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(item.score / item.max) * 100}%` }}
                                    transition={{ duration: 1, delay: 0.2 }}
                                  ></motion.div>
                                </div>
                                <p className="text-[10px] text-zinc-400 leading-normal">{item.feedback}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {/* Card 1: Metadata */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                        className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-3 shadow-sm hover:border-zinc-700 transition-colors"
                      >
                        <span className="text-[10px] font-mono text-blue-400 font-bold tracking-widest uppercase">CANDIDATE METADATA</span>
                        <div>
                          <h4 className="text-base font-bold font-display text-zinc-100 truncate">
                            {cvAnalytics.metadata?.name || "Jane Doe"}
                          </h4>
                          <p className="text-xs text-zinc-400 font-mono mt-1 whitespace-pre-line leading-relaxed">
                            {cvAnalytics.metadata?.contact || "No Contact Info"}
                          </p>
                        </div>
                      </motion.div>

                      {/* Card 2: Skills */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.2 }}
                        className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-3 shadow-sm hover:border-zinc-700 transition-colors"
                      >
                        <span className="text-[10px] font-mono text-emerald-400 font-bold tracking-widest uppercase">CORE SKILLS & TECH</span>
                        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                          {cvAnalytics.skills?.map((skill, i) => (
                            <span key={i} className="text-[10px] bg-emerald-500/10 text-emerald-300 border border-emerald-500/15 px-2 py-0.5 rounded-lg font-medium">
                              {skill}
                            </span>
                          )) || <span className="text-xs text-zinc-500">None Extracted</span>}
                        </div>
                      </motion.div>

                      {/* Card 3: Certificates */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.3 }}
                        className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-3 shadow-sm hover:border-zinc-700 transition-colors"
                      >
                        <span className="text-[10px] font-mono text-amber-400 font-bold tracking-widest uppercase">CERTIFICATIONS & CREDENTIALS</span>
                        <ul className="space-y-2 text-xs text-zinc-300 max-h-36 overflow-y-auto custom-scrollbar">
                          {cvAnalytics.certificates?.map((cert, i) => (
                            <li key={i} className="flex items-start gap-1.5 leading-snug">
                              <Award className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>{cert}</span>
                            </li>
                          )) || <li className="text-zinc-500 text-xs">No certifications extracted</li>}
                        </ul>
                      </motion.div>

                      {/* Card 4: Projects */}
                      <motion.div
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.4 }}
                        className="bg-zinc-950 border border-zinc-850 rounded-2xl p-5 space-y-3 shadow-sm hover:border-zinc-700 transition-colors"
                      >
                        <span className="text-[10px] font-mono text-purple-400 font-bold tracking-widest uppercase">PROJECTS PORTFOLIO</span>
                        <div className="space-y-2 max-h-36 overflow-y-auto custom-scrollbar">
                          {cvAnalytics.projects?.map((proj, i) => (
                            <div key={i} className="border-l-2 border-purple-500/40 pl-2">
                              <h5 className="text-xs font-bold text-zinc-200 truncate">{proj.title}</h5>
                              <p className="text-[10px] text-zinc-500 line-clamp-2 mt-0.5 leading-normal">{proj.description}</p>
                            </div>
                          )) || <p className="text-xs text-zinc-500">No projects extracted</p>}
                        </div>
                      </motion.div>
                    </div>
                  </div>
                );
              })()}

              {/* Main lists */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Left side: Job matches feed */}
                <div className="xl:col-span-8 space-y-4">
                  <h3 className="text-lg font-bold font-display text-white flex items-center gap-2">
                    <Briefcase className="h-5 w-5 text-blue-400" />
                    <span>Analyzed Matches Rank List</span>
                    <span className="text-xs bg-blue-500/10 text-blue-400 px-2.5 py-1 rounded-full font-mono">
                      {matches.length} matches found
                    </span>
                  </h3>

                  {matches.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center space-y-4">
                      <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
                      <div>
                        <h4 className="text-lg font-semibold text-zinc-200">
                          {location ? "We don't have jobs available in this location right now." : "No Direct Matches Found"}
                        </h4>
                        <p className="text-zinc-400 text-sm max-w-md mx-auto mt-1">
                          {location 
                            ? `No active job postings were found in "${location}". Try searching for other regions, or selecting "All" work modes to expand your search.`
                            : "No openings in our active index match your exact filters. Try broadening your location or selecting \"All\" work modes to find more postings."}
                        </p>
                      </div>
                      <button
                        onClick={resetAll}
                        className="py-2.5 px-5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                      >
                        Adjust Search Preferences
                      </button>
                    </div>
                  ) : (
                    matches.map((job, idx) => (
                      <div
                        key={job.id}
                        className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 transition-all duration-300 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-500/45 relative group ${
                          selectedJob?.id === job.id
                            ? "ring-2 ring-blue-500/80 border-transparent bg-blue-950/15 shadow-xl shadow-blue-500/5"
                            : "shadow-md shadow-black/20"
                        }`}
                      >
                        {/* Match Score Ring (absolute corner placement) */}
                        <div className="absolute top-6 right-6 flex items-center gap-3">
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-500 font-mono tracking-wider block">MATCH FIT</span>
                            <span className="text-xl font-display font-extrabold text-white">{job.matchScore}%</span>
                          </div>
                          
                          {/* Radial Score Indicator */}
                          <div className="relative h-12 w-12 shrink-0">
                            <svg className="h-full w-full -rotate-90">
                              <circle
                                cx="24"
                                cy="24"
                                r="18"
                                className="stroke-zinc-800"
                                strokeWidth="3"
                                fill="transparent"
                              />
                              <circle
                                cx="24"
                                cy="24"
                                r="18"
                                className={
                                  job.matchScore >= 80
                                    ? "stroke-emerald-400"
                                    : job.matchScore >= 65
                                    ? "stroke-amber-400"
                                    : "stroke-blue-400"
                                }
                                strokeWidth="3.5"
                                fill="transparent"
                                strokeDasharray={2 * Math.PI * 18}
                                strokeDashoffset={2 * Math.PI * 18 * (1 - job.matchScore / 100)}
                              />
                            </svg>
                            <span className="absolute inset-0 flex items-center justify-center font-mono text-[10px] text-zinc-300 font-medium">
                              #{idx + 1}
                            </span>
                          </div>
                        </div>

                        {/* Company Badge / Details */}
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-white font-display font-bold text-lg shadow-lg shrink-0">
                            {job.company.charAt(0)}
                          </div>
                          <div className="space-y-1 pr-24">
                            <h4 className="text-lg font-bold text-zinc-100 font-display leading-tight group-hover:text-blue-300 transition-colors">
                              {job.title}
                            </h4>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 font-medium">
                              <span className="font-semibold text-zinc-300">{job.company}</span>
                              <span className="text-zinc-600">•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" /> {job.location}
                              </span>
                              <span className="text-zinc-600">•</span>
                              <span className="text-zinc-300 font-mono">{job.salary}</span>
                            </div>
                            
                            <div className="pt-1 flex items-center gap-2 flex-wrap">
                              <span className={`inline-block text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                                job.workMode === "Remote"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                  : job.workMode === "Hybrid"
                                  ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                  : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              }`}>
                                {job.workMode}
                              </span>
                              <span className={`inline-block text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                                job.source === "JSearch"
                                  ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                                  : job.source === "Arbeitnow"
                                  ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                                  : job.source === "Indeed"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : job.source === "LinkedIn"
                                  ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                                  : job.source === "ZipRecruiter"
                                  ? "bg-green-500/10 text-green-400 border-green-500/20"
                                  : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                              }`}>
                                {job.source}
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">Posted {job.posted}</span>
                            </div>
                          </div>
                        </div>

                        {/* Recruiter Summary statement */}
                        <div className="mt-4 p-4 bg-zinc-950/60 border border-zinc-800/60 rounded-xl text-xs text-zinc-300 leading-relaxed">
                          {job.analysisSummary}
                        </div>

                        {/* Skills Grid Comparison */}
                        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1.5">
                            <span className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1.5">
                              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> MATCHED SKILLS
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {job.matchedSkills.map((skill) => (
                                <span key={skill} className="text-[10px] bg-emerald-500/5 text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/10 font-medium">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> RECOMMENDED WORK ADDITIONS
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {job.missingSkills.map((skill) => (
                                <span key={skill} className="text-[10px] bg-amber-500/5 text-amber-300 px-2 py-0.5 rounded-lg border border-amber-500/10 font-medium">
                                  {skill}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Action section inside card */}
                        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <p className="text-[11px] text-zinc-500 font-mono flex items-center gap-1">
                            <BookOpen className="h-3.5 w-3.5 text-zinc-500" />
                            Click &quot;Deep Tailor&quot; to automatically bridge all skill gaps below
                          </p>

                          <div className="flex items-center gap-3">
                            <a
                              href={job.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-zinc-400 hover:text-white font-medium flex items-center gap-1 px-3 py-2 hover:bg-zinc-800 rounded-lg transition-colors border border-transparent hover:border-zinc-700"
                            >
                              <span>Direct Apply</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>

                            <button
                              onClick={() => startTailoringAgent(job)}
                              className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg hover:shadow-blue-600/10 cursor-pointer active:scale-95"
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Deep Tailor Resume</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Right side: Summary Insight panel */}
                <div className="xl:col-span-4 space-y-6">
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-5">
                    <h4 className="text-sm font-bold font-display text-white tracking-wider uppercase flex items-center gap-2 border-b border-zinc-800 pb-3">
                      <TrendingUp className="h-4 w-4 text-blue-400" />
                      <span>Agent Fit Dashboard</span>
                    </h4>

                    <div className="space-y-4">
                      <div>
                        <span className="text-xs text-zinc-500 font-mono">AVG FIT COEFFICIENT</span>
                        <div className="text-3xl font-display font-extrabold text-blue-300 mt-1">
                          {matches.length > 0
                            ? Math.round(matches.reduce((acc, m) => acc + m.matchScore, 0) / matches.length)
                            : 0}
                          %
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-1 font-mono">Based on semantic vector similarity scans.</p>
                      </div>

                      <div className="border-t border-zinc-800/80 pt-4">
                        <span className="text-xs text-zinc-500 font-mono">MATCH SPECTRUM</span>
                        <div className="mt-2 space-y-2 text-xs font-medium">
                          <div className="flex items-center justify-between">
                            <span className="text-emerald-400">High Match (80%+)</span>
                            <span className="text-zinc-300 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              {matches.filter((m) => m.matchScore >= 80).length} Roles
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-amber-400">Competitive Fit (65-79%)</span>
                            <span className="text-zinc-300 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              {matches.filter((m) => m.matchScore >= 65 && m.matchScore < 80).length} Roles
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-blue-400">Aligned Background (50-64%)</span>
                            <span className="text-zinc-300 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                              {matches.filter((m) => m.matchScore < 65).length} Roles
                            </span>
                          </div>
                        </div>
                      </div>

                      {matches.length > 0 && (
                        <div className="border-t border-zinc-800/80 pt-4 space-y-3">
                          <span className="text-[10px] text-zinc-500 font-mono font-bold tracking-wider uppercase block">MATCH FIT TREND (ACTIVE COHORT)</span>
                          <div className="h-44 w-full bg-zinc-950/40 p-2 border border-zinc-800/60 rounded-xl overflow-hidden">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                data={[...matches].reverse().map((m, idx) => ({
                                  name: m.company.length > 8 ? m.company.slice(0, 8) + ".." : m.company,
                                  fullCompany: m.company,
                                  title: m.title,
                                  score: m.matchScore,
                                }))}
                                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" />
                                <XAxis
                                  dataKey="name"
                                  stroke="#52525b"
                                  fontSize={9}
                                  tickLine={false}
                                  axisLine={false}
                                />
                                <YAxis
                                  domain={[0, 100]}
                                  stroke="#52525b"
                                  fontSize={9}
                                  tickLine={false}
                                  axisLine={false}
                                  ticks={[0, 25, 50, 75, 100]}
                                />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload;
                                      return (
                                        <div className="bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl shadow-xl max-w-[180px] pointer-events-none">
                                          <p className="font-bold text-[10px] text-zinc-100 truncate">{data.title}</p>
                                          <p className="text-[10px] text-zinc-400 truncate">{data.fullCompany}</p>
                                          <p className="text-[10px] text-blue-400 font-bold font-mono mt-1">Fit Index: {data.score}%</p>
                                        </div>
                                      );
                                    }
                                    return null;
                                  }}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="score"
                                  stroke="#3b82f6"
                                  strokeWidth={2}
                                  dot={{ r: 4, stroke: "#3b82f6", strokeWidth: 1.5, fill: "#09090b" }}
                                  activeDot={{ r: 6, stroke: "#60a5fa", strokeWidth: 2, fill: "#3b82f6" }}
                                />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}

                      <div className="p-4 bg-zinc-950/60 border border-zinc-800/60 rounded-xl space-y-2">
                        <h5 className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                          <HelpCircle className="h-3.5 w-3.5 text-blue-400" /> Why Tailor?
                        </h5>
                        <p className="text-[11px] text-zinc-400 leading-relaxed">
                          Standard Applicant Tracking Systems (ATS) scan for exact keyword density ratios in milliseconds. Select the role with the highest match index and hit <strong>Deep Tailor</strong> to rewrite your resume's framework automatically.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Final Tailoring Dashboard */}
          {step === "dashboard" && selectedJob && tailorResult && (
            <motion.div
              key="dashboard-screen"
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99 }}
              className="space-y-6"
            >
              {/* Back Bar & Header Actions */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep("matches")}
                    className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 rounded-xl transition-all cursor-pointer"
                  >
                    <RotateCcw className="h-4 w-4 text-zinc-400" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-blue-400 font-mono font-bold tracking-wider uppercase">OPTIMIZATION DASHBOARD</span>
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono">Ready</span>
                    </div>
                    <h3 className="text-xl font-bold font-display text-white">
                      Tailored for {selectedJob.title} @ {selectedJob.company}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <button
                    onClick={handleCopy}
                    id="btn-copy-markdown"
                    className="flex-1 md:flex-none py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer text-zinc-100"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-zinc-400" />}
                    <span>{copied ? "Copied!" : "Copy Markdown"}</span>
                  </button>

                  <button
                    onClick={handleDownload}
                    id="btn-download-markdown"
                    className="flex-1 md:flex-none py-2.5 px-4 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer text-zinc-100"
                  >
                    <FileText className="h-4 w-4 text-zinc-400" />
                    <span>Download Markdown</span>
                  </button>

                  <button
                    onClick={handleDownloadPDF}
                    id="btn-download-pdf"
                    className="flex-1 md:flex-none py-2.5 px-5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Download className="h-4 w-4 text-zinc-400" />
                    <span>Download Professional PDF</span>
                  </button>

                  <button
                    onClick={openEmailAssistant}
                    id="btn-email-resume"
                    className="flex-1 md:flex-none py-2.5 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:shadow-blue-600/15 cursor-pointer"
                  >
                    <Mail className="h-4 w-4" />
                    <span>Email Resume</span>
                  </button>
                </div>
              </div>

              {/* Two Column Workspace Split */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
                
                {/* Left Panel: Optimization Details, Skill Gaps, Interview Tactics */}
                <div className="xl:col-span-5 space-y-6">
                  {/* Job metadata display */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 space-y-3">
                    <span className="text-[10px] text-zinc-500 font-mono tracking-wider">TARGET POSITION DETAILS</span>
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center font-display font-bold text-base shrink-0 border border-blue-500/20">
                        {selectedJob.company.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-zinc-100 font-display text-base">{selectedJob.title}</h4>
                        <p className="text-xs text-zinc-400 font-medium">{selectedJob.company} • {selectedJob.location}</p>
                      </div>
                    </div>
                    
                    <div className="mt-2 flex items-center gap-3 text-xs pt-1 border-t border-zinc-800/60">
                      <span className="font-mono text-zinc-400">{selectedJob.salary}</span>
                      <span className="text-zinc-700">•</span>
                      <span className="bg-zinc-950 border border-zinc-800 text-blue-300 font-mono px-2 py-0.5 rounded text-[10px]">
                        {selectedJob.workMode}
                      </span>
                      <span className="text-zinc-700">•</span>
                      <span className={`border px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                        selectedJob.source === "JSearch"
                          ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                          : selectedJob.source === "Arbeitnow"
                          ? "bg-teal-500/10 text-teal-400 border-teal-500/20"
                          : selectedJob.source === "Indeed"
                          ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          : selectedJob.source === "LinkedIn"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                          : selectedJob.source === "ZipRecruiter"
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                      }`}>
                        {selectedJob.source}
                      </span>
                    </div>
                  </div>

                  {/* Tabs Area */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
                    <div className="flex border-b border-zinc-800 bg-zinc-950 p-1.5 gap-1">
                      <button
                        onClick={() => setActiveTab("changes")}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          activeTab === "changes"
                            ? "bg-zinc-900 text-blue-400 border border-zinc-800"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Optimization Log ({tailorResult.keyChanges.length})
                      </button>
                      <button
                        onClick={() => setActiveTab("skills")}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          activeTab === "skills"
                            ? "bg-zinc-900 text-blue-400 border border-zinc-800"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Skill Gaps Bridged ({tailorResult.skillGapFilled.length})
                      </button>
                      <button
                        onClick={() => setActiveTab("interview")}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          activeTab === "interview"
                            ? "bg-zinc-900 text-blue-400 border border-zinc-800"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Interview Tactics ({tailorResult.interviewTips.length})
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab("practice");
                          if (mockQuestions.length === 0) {
                            generatePracticeQuestions();
                          }
                        }}
                        className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                          activeTab === "practice"
                            ? "bg-zinc-900 text-blue-400 border border-zinc-800"
                            : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Practice Mode
                      </button>
                    </div>

                    <div className="p-6">
                      {activeTab === "changes" && (
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold font-display text-white mb-2 flex items-center gap-1.5">
                            <Award className="h-4.5 w-4.5 text-blue-400" />
                            <span>Structural Re-Alignments</span>
                          </h5>
                          <ul className="space-y-3.5">
                            {tailorResult.keyChanges.map((change, idx) => (
                              <li key={idx} className="flex gap-3 items-start">
                                <div className="h-5 w-5 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center justify-center shrink-0 mt-0.5 font-mono text-[10px] text-blue-400 font-bold">
                                  {idx + 1}
                                </div>
                                <p className="text-xs text-zinc-300 leading-relaxed">{change}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {activeTab === "skills" && (
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold font-display text-white mb-2 flex items-center gap-1.5">
                            <CheckCircle className="h-4.5 w-4.5 text-emerald-400" />
                            <span>Keywords Integrated into ATS Core</span>
                          </h5>
                          <div className="space-y-3">
                            {tailorResult.skillGapFilled.map((skill, idx) => (
                              <div key={idx} className="flex gap-2.5 items-center bg-zinc-950 border border-zinc-800 p-2.5 rounded-xl">
                                <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                                <span className="text-xs text-zinc-300 font-mono">{skill}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {activeTab === "interview" && (
                        <div className="space-y-4">
                          <h5 className="text-sm font-bold font-display text-white mb-2 flex items-center gap-1.5">
                            <Sparkles className="h-4.5 w-4.5 text-blue-400" />
                            <span>Custom Interview Talking Points</span>
                          </h5>
                          <ul className="space-y-4">
                            {tailorResult.interviewTips.map((tip, idx) => (
                              <li key={idx} className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1 relative overflow-hidden">
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500"></div>
                                <h6 className="text-xs font-bold font-mono text-blue-300">STRATEGY #{idx + 1}</h6>
                                <p className="text-xs text-zinc-400 leading-relaxed">{tip}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {activeTab === "practice" && (
                        <div className="space-y-5">
                          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                            <div>
                              <h5 className="text-sm font-bold font-display text-white flex items-center gap-1.5">
                                <Cpu className="h-4.5 w-4.5 text-violet-400" />
                                <span>Interactive Interview Practice</span>
                              </h5>
                              <p className="text-[11px] text-zinc-400 mt-0.5">Draft answers to tailor-made mock questions and receive real-time evaluations.</p>
                            </div>
                            <button
                              onClick={generatePracticeQuestions}
                              disabled={isLoadingMockQuestions}
                              className="text-[10px] font-mono font-bold text-violet-400 bg-violet-500/10 border border-violet-500/20 py-1 px-2.5 rounded hover:bg-violet-500/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isLoadingMockQuestions ? "Regenerating..." : "Regenerate Questions"}
                            </button>
                          </div>

                          {practiceError && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span>{practiceError}</span>
                            </div>
                          )}

                          {isLoadingMockQuestions ? (
                            <div className="space-y-4 py-8 text-center">
                              <div className="inline-block animate-spin h-6 w-6 border-2 border-violet-400 border-t-transparent rounded-full mb-2"></div>
                              <p className="text-xs text-zinc-400">Synthesizing 3 targeted role-specific questions for {selectedJob.title}...</p>
                            </div>
                          ) : mockQuestions.length === 0 ? (
                            <div className="text-center py-8 space-y-3">
                              <HelpCircle className="h-8 w-8 text-zinc-600 mx-auto" />
                              <p className="text-xs text-zinc-400">No mock questions loaded.</p>
                              <button
                                onClick={generatePracticeQuestions}
                                className="py-2 px-4 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white rounded-lg border border-zinc-700 transition-colors cursor-pointer"
                              >
                                Generate Questions
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {mockQuestions.map((q) => (
                                <div key={q.id} className="p-4 bg-zinc-950 border border-zinc-800/80 rounded-2xl space-y-4">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-mono font-bold bg-violet-500/10 text-violet-400 border border-violet-500/20 px-1.5 py-0.5 rounded">
                                        QUESTION {q.id}
                                      </span>
                                    </div>
                                    <h6 className="text-xs font-bold text-zinc-100 mt-2 leading-relaxed">{q.question}</h6>
                                    <p className="text-[11px] text-zinc-400 italic mt-1 leading-normal">
                                      <span className="font-semibold text-zinc-300">Rationale: </span>
                                      {q.rationale}
                                    </p>
                                  </div>

                                  <div className="space-y-1.5">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Target Points to Hit:</span>
                                    <ul className="grid grid-cols-1 gap-1.5">
                                      {q.idealOutline.map((point, index) => (
                                        <li key={index} className="flex gap-2 items-start text-[11px] text-zinc-400 leading-normal">
                                          <div className="h-1.5 w-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0"></div>
                                          <span>{point}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 block">Draft Your Answer:</label>
                                    <textarea
                                      rows={3}
                                      value={userAnswers[q.id] || ""}
                                      onChange={(e) => setUserAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                                      placeholder="Type your spoken answer or notes here..."
                                      className="w-full text-xs p-3 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-200 focus:outline-none focus:border-zinc-700 resize-none transition-colors custom-scrollbar"
                                    />
                                    <button
                                      onClick={() => evaluateAnswer(q.id)}
                                      disabled={isEvaluatingAnswer[q.id] || !userAnswers[q.id]?.trim()}
                                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs font-bold text-zinc-200 rounded-xl border border-zinc-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                                    >
                                      {isEvaluatingAnswer[q.id] ? (
                                        <>
                                          <div className="animate-spin h-3.5 w-3.5 border-2 border-zinc-400 border-t-transparent rounded-full"></div>
                                          <span>Evaluating Answer Structure...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Send className="h-3.5 w-3.5" />
                                          <span>Submit for Recruiter Review</span>
                                        </>
                                      )}
                                    </button>
                                  </div>

                                  {evaluations[q.id] && (
                                    <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-4 space-y-4">
                                      <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                                        <span className="text-xs font-bold text-zinc-300">Recruiter Evaluation</span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-[10px] text-zinc-400 font-mono">Response Match:</span>
                                          <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                                            evaluations[q.id].score >= 85 
                                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                              : evaluations[q.id].score >= 70
                                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                          }`}>
                                            {evaluations[q.id].score}%
                                          </span>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                        <div className="space-y-1.5">
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Strengths:</span>
                                          <ul className="space-y-1">
                                            {evaluations[q.id].strengths.map((str, i) => (
                                              <li key={i} className="flex gap-2 items-start text-[11px] text-zinc-300 leading-relaxed">
                                                <Check className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                                                <span>{str}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>

                                        <div className="space-y-1.5">
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">Gaps & Tips:</span>
                                          <ul className="space-y-1">
                                            {evaluations[q.id].gaps.map((gap, i) => (
                                              <li key={i} className="flex gap-2 items-start text-[11px] text-zinc-300 leading-relaxed">
                                                <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                                                <span>{gap}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        </div>
                                      </div>

                                      <p className="text-xs text-zinc-400 leading-relaxed italic bg-zinc-950 p-3 border border-zinc-850 rounded-xl">
                                        {evaluations[q.id].feedbackText}
                                      </p>

                                      <div className="space-y-1 bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-violet-400">Exemplary spoken response model:</span>
                                        <p className="text-[11px] text-zinc-300 leading-relaxed italic">{evaluations[q.id].improvedAnswerExample}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reset action block */}
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <h5 className="font-bold text-sm text-zinc-200">Start new tailoring search</h5>
                      <p className="text-zinc-500 text-xs">Run another copy against other positions.</p>
                    </div>
                    <button
                      onClick={resetAll}
                      className="py-2 px-3.5 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold rounded-lg border border-zinc-700 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Start Over</span>
                    </button>
                  </div>
                </div>

                {/* Right Panel: Scrollable Markdown Resume Output with Diff View Toggle */}
                <div className="xl:col-span-7 bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl relative">
                  <div className="bg-zinc-950 border-b border-zinc-800 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <span className="text-xs font-mono text-zinc-400 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-400" />
                      <span>TAILORED_RESUME.MD {isDiffView ? "• VISUAL DIFF VIEW" : "• LIVE MARKDOWN PREVIEW"}</span>
                    </span>
                    <div className="flex items-center gap-4">
                      {/* Diff View Toggle Button */}
                      <button
                        onClick={() => setIsDiffView(!isDiffView)}
                        className={`py-1.5 px-3 rounded-lg text-[10px] font-mono font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                          isDiffView
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-md shadow-emerald-500/5 hover:bg-emerald-500/20"
                            : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:border-zinc-700"
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Diff View: {isDiffView ? "ACTIVE" : "INACTIVE"}</span>
                      </button>
                      <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">Live Mode</span>
                    </div>
                  </div>

                  <div className="p-6 md:p-8 h-[650px] overflow-y-auto bg-zinc-950/40 custom-scrollbar">
                    <div className="bg-white text-zinc-900 font-serif shadow-2xl rounded-xl p-8 md:p-10 max-w-2xl mx-auto border border-zinc-200/80">
                      {isDiffView ? (
                        <div id="diff-view-content" className="text-zinc-800 font-serif text-xs md:text-sm leading-relaxed whitespace-pre-wrap select-all">
                          {computeWordDiff(resumeText, cleanTailoredResume(tailorResult.tailoredResume)).map((tok, i) => {
                            if (tok.type === "added") {
                              return (
                                <span
                                  key={i}
                                  className="bg-emerald-100 text-emerald-800 border-b-2 border-emerald-500 font-bold px-0.5 rounded mx-0.5 inline"
                                  title="Added keyword"
                                >
                                  {tok.value}
                                </span>
                              );
                            } else if (tok.type === "removed") {
                              return (
                                <span
                                  key={i}
                                  className="bg-rose-100 text-rose-800 line-through px-0.5 rounded mx-0.5 opacity-60 inline"
                                  title="Removed original text"
                                >
                                  {tok.value}
                                </span>
                              );
                            } else {
                              return <span key={i}>{tok.value}</span>;
                            }
                          })}
                        </div>
                      ) : (
                        <div className="markdown-body">
                          <Markdown
                            components={{
                              h1: ({node, ...props}) => <h1 className="text-2xl font-bold font-sans text-zinc-900 uppercase tracking-wider text-center border-b border-zinc-300 pb-3 mb-6 mt-2" {...props} />,
                              h2: ({node, ...props}) => <h2 className="text-xs font-bold font-sans text-zinc-800 uppercase tracking-widest border-b border-zinc-200 mt-6 mb-3 pb-1" {...props} />,
                              h3: ({node, ...props}) => <h3 className="text-sm font-bold font-sans text-zinc-800 mt-4 mb-1" {...props} />,
                              p: ({node, ...props}) => <p className="text-xs md:text-sm text-zinc-700 leading-relaxed my-2" {...props} />,
                              ul: ({node, ...props}) => <ul className="list-disc pl-5 my-3 space-y-1.5 text-xs md:text-sm text-zinc-700" {...props} />,
                              li: ({node, ...props}) => <li className="text-zinc-700" {...props} />,
                              hr: ({node, ...props}) => <hr className="border-zinc-200 my-6" {...props} />,
                              strong: ({node, ...props}) => <strong className="font-bold text-blue-900 bg-blue-100/80 px-1 py-0.5 rounded" {...props} />,
                            }}
                          >
                            {cleanTailoredResume(tailorResult.tailoredResume)}
                          </Markdown>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Email Assistant Modal overlay */}
        <AnimatePresence>
          {isEmailModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsEmailModalOpen(false)}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm"
              />

              {/* Modal Box */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] z-10"
              >
                {/* Header */}
                <div className="px-6 py-4 bg-zinc-950 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold font-display text-white">Email Resume Assistant</h4>
                      <p className="text-[10px] text-zinc-500 font-mono">Formulate & send tailored resume draft</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsEmailModalOpen(false)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Recruiter Email */}
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
                        Recruiter Email Address
                      </label>
                      <input
                        type="email"
                        value={emailRecruiter}
                        onChange={(e) => setEmailRecruiter(e.target.value)}
                        placeholder="e.g. careers@company.com"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>

                    {/* Candidate Name / Verified Contact */}
                    <div>
                      <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
                        Extracted Candidate Info
                      </label>
                      <div className="w-full bg-zinc-950/55 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-zinc-400 font-mono truncate">
                        {cvAnalytics?.metadata?.name || "Candidate Name"} ({cvAnalytics?.metadata?.contact || "No info"})
                      </div>
                    </div>
                  </div>

                  {/* Subject Field */}
                  <div>
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
                      Email Subject Line
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Email Subject"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  {/* Textarea Body */}
                  <div className="flex-1 flex flex-col">
                    <label className="block text-[10px] font-mono text-zinc-500 uppercase tracking-wider mb-1.5">
                      Email Cover Letter & Tailored Resume Draft
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      rows={12}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-300 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono leading-relaxed resize-none h-[280px]"
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-zinc-950 border-t border-zinc-850 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  <p className="text-[10px] text-zinc-500 leading-normal max-w-sm">
                    Clicking <strong>Send Draft</strong> will pre-fill this email inside your local mail application (Outlook, Gmail, Mail, etc.).
                  </p>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <button
                      onClick={handleCopyEmailBody}
                      className="py-2 px-4 bg-zinc-850 hover:bg-zinc-800 border border-zinc-850 text-zinc-100 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    >
                      {emailCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-zinc-400" />}
                      <span>{emailCopied ? "Copied Email!" : "Copy Email Text"}</span>
                    </button>

                    <button
                      onClick={handleSendEmailDraft}
                      className="py-2 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg hover:shadow-blue-600/10 cursor-pointer"
                    >
                      <Send className="h-3.5 w-3.5 text-blue-200" />
                      <span>Send Draft</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer copyright */}
      <footer className="border-t border-slate-900/80 bg-slate-950 px-6 py-5 text-center mt-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 font-mono">
          <p>© 2026 HireLens Platform. Decoupled AI Recruit Pipeline.</p>
          <p className="flex items-center gap-1.5">
            Powered by <strong className="text-indigo-400 font-medium">Gemini 2.5 Flash</strong> and full-stack Express engine.
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
}
