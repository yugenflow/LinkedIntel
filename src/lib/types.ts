// ── Shared TypeScript interfaces ──

export interface ParsedResume {
  text: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  parsedAt: number;
}

export interface StorageData {
  resume: ParsedResume | null;
  showSalaryBadges: boolean;
  enableSmartConnect: boolean;
  matchCache: Record<string, MatchResult>;
}

export interface CategoryBreakdown {
  name: string;
  score: number;
  status: 'strong' | 'moderate' | 'weak';
  matched: string[];
  missing: string[];
}

export interface ResumeRecommendation {
  area: string;
  suggestion: string;
  example: string;
  priority: 'high' | 'medium' | 'low';
}

export interface MatchResult {
  matchPercent: number;
  status: 'strong' | 'moderate' | 'weak';
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  cachedAt: number;
  categories?: CategoryBreakdown[];
  recommendations?: ResumeRecommendation[];
}

export interface ProfileData {
  name: string;
  headline: string;
  about: string;
  recentActivity: string[];
  currentCompany: string;
  profileUrl: string;
}

export interface ConnectMessage {
  message: string;
  hashtags: string[];
  intent: IntentType;
}

export type IntentType = 'referral' | 'connect' | 'business';

export interface SalaryEntry {
  title: string;
  titleNormalized: string;
  company: string;
  location: string;
  salaryMin: number;
  salaryMax: number;
  currency: string;
  source: string;
}

export interface SalaryResult {
  found: boolean;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  matchType?: 'exact' | 'market_average';
  label: string;
}

export interface SalaryCardData {
  title: string;
  company: string;
  location: string;
  salary: SalaryResult;
}

export interface JobDescriptionData {
  title: string;
  company: string;
  description: string;
}

// ── Page data types for side panel ──

export type PageDataPayload =
  | { page: 'job-search'; salaryCards: SalaryCardData[] }
  | { page: 'job-detail'; jd: JobDescriptionData }
  | { page: 'profile'; profile: ProfileData }
  | { page: 'other' };

// ── Message types for service worker communication ──

export type MessageType =
  | { type: 'MATCH_RESUME_JD'; payload: { resumeText: string; jdText: string } }
  | { type: 'GENERATE_ICEBREAKER'; payload: { profile: ProfileData; intent: IntentType; resumeContext?: string } }
  | { type: 'GET_STORAGE'; payload: { keys: (keyof StorageData)[] } }
  | { type: 'SET_STORAGE'; payload: Partial<StorageData> }
  | { type: 'PAGE_DATA'; payload: PageDataPayload }
  | { type: 'REQUEST_SCRAPE' };

export interface MessageResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
