**Software Design Document (SDD)** for **LinkedIntel**. This version incorporates the new naming convention and the updated technical requirements for supporting both PDF and Word document parsing.

---

# Software Design Document: LinkedIntel

**Project Name:** LinkedIntel
**Version:** 1.0 (MVP Final)
**Date:** January 29, 2026
**Status:** Approved for Development

---

## 1. Introduction

### 1.1 Purpose
**LinkedIntel** is a Chrome Extension designed to function as a high-level intelligence layer over the LinkedIn platform. It addresses three critical gaps in the modern recruitment and networking process:
1.  **Salary Opacity:** The lack of transparent pay data in job listings.
2.  **Matching Inefficiency:** The disconnect between LinkedIn’s algorithmic "profile match" and the hard constraints of a job description (e.g., specific years of experience).
3.  **Networking Friction:** The difficulty users face in drafting personalized, high-context connection requests.

### 1.2 Scope
The extension acts as a seamless overlay on the LinkedIn User Interface (UI). It processes data in real-time on:
*   **Job Feed/Search Results:** Injecting salary intelligence.
*   **Job Detail Pages:** Performing deep-dive resume gap analysis.
*   **User Profiles:** Generating AI-assisted networking messages.

---

## 2. System Architecture

### 2.1 High-Level Design
To ensure user privacy and application performance, LinkedIntel utilizes a **Hybrid Client-Server Architecture**.

1.  **Client (Chrome Extension):**
    *   Handles DOM manipulation (UI injection).
    *   **Document Processing Engine:** Parses Resume files (PDF and DOCX) locally within the browser to ensure raw files are not unnecessarily transmitted.
2.  **Middleware (Serverless API):**
    *   Acts as a proxy to external services to hide API keys.
    *   Sanitizes text data before forwarding to LLMs.
3.  **External Services:**
    *   **Salary Aggregators:** (AmbitionBox, Levels.fyi, Glassdoor).
    *   **LLM Provider:** (OpenAI GPT-4o-mini or Anthropic Haiku) for semantic matching and text generation.

### 2.2 Component Diagram
```mermaid
[User] -> [LinkedIntel Extension]
               |
               +-- [File Handler (PDF.js / Mammoth.js)] <--- [Upload Resume .pdf/.docx]
               |
               +-- [Content Script: Jobs Feed] ---------> [Salary API]
               |
               +-- [Content Script: Job Details] -------> [Match Engine (LLM)]
               |
               +-- [Content Script: Profile Page] ------> [Invite Generator (LLM)]
```

---

## 3. Core Feature Specifications

### 3.1 Feature 1: Salary Intel (The Pay Reveal)
**Goal:** Provide immediate salary visibility on the job search feed.
*   **Workflow:**
    1.  **Detection:** The extension detects job cards on `linkedin.com/jobs`.
    2.  **Extraction:** Scrapes `Job Title`, `Company Name`, and `Location`.
    3.  **Fetch:** Queries the backend for salary data.
    4.  **Injection:** A "Salary Badge" is inserted into the DOM next to the job title.
*   **Data Logic:**
    *   *Exact Match:* Company + Role + Location.
    *   *Fallback:* Role + Location (Market Average).

### 3.2 Feature 2: Reality Check (Resume vs. JD)
**Goal:** Determine if the user *actually* qualifies based on hard constraints, supporting multiple resume formats.
*   **Resume Ingestion:**
    *   **Supported Formats:** `.pdf`, `.doc`, `.docx`.
    *   **Parsing Logic:**
        *   **PDF:** Uses `pdf.js` library to extract text layers.
        *   **Word:** Uses `mammoth.js` (for .docx) to convert document XML to raw text string.
    *   *Storage:* Extracted text is stored locally in `chrome.storage.local`.
*   **Analysis Workflow:**
    1.  User views a Job Description (JD).
    2.  Extension extracts JD text.
    3.  **LLM Prompt:** *"Compare [Resume Text] vs [JD Text]. Focus on Years of Experience (YoE) and Top 3 Hard Skills. Return a Match % and a 'Reality Check' summary."*
*   **UI Output:** A status box above the job details:
    *   **Green:** "Strong Match (85%) - Your 4 years exp fits the 3+ requirement."
    *   **Red:** "Mismatch - Role requires 8 years. You have 4."

### 3.3 Feature 3: Smart Connect (The Icebreaker)
**Goal:** Remove writer's block when connecting with people.
*   **Workflow:**
    1.  User visits a profile (e.g., `linkedin.com/in/recruiter-name`).
    2.  Extension scrapes: *Headline, About Section, Recent Activity*.
    3.  User clicks the **"Draft Invite"** button injected by LinkedIntel.
    4.  **LLM Generation:** Creates a personalized <300 character message.
        *   *Example:* "Hi [Name], saw you're hiring for [Role]. With my background in [Skill] at [Current Co], I think I'd be a great fit. Would love to connect."

### 3.4 Feature 4: SMS Alerts (Future Scope)
*   **Status:** Deferred to V2.
*   **Concept:** Server-side cron job to scan for jobs and send SMS alerts daily. Not included in MVP.

---

## 4. User Interface (UI) Design

### 4.1 Design Philosophy
**"Seamless Integration"**
The UI must use LinkedIn's design language (Rounded corners, specific hex codes, font weights) so LinkedIntel looks like a native "Pro" feature of LinkedIn, not a cluttering add-on.

### 4.2 Key Visual Elements
*   **Primary Color:** LinkedIn Blue (`#0077B5`)
*   **Secondary Color:** LinkedIntel Teal (`#008080`) - Used to distinguish Extension features from native buttons.
*   **Typography:** System UI (`-apple-system`, `Segoe UI`, `Roboto`).

### 4.3 Interface States
1.  **The Salary Badge:** A pill-shaped tag.
    *   *Visual:* `[ 💰 ₹20L - ₹25L ]`
2.  **The Reality Check Widget:** A clean card with a colored left-border indicating status (Green/Red/Yellow).
3.  **The Extension Popup:**
    *   **Header:** LinkedIntel Logo.
    *   **Upload Area:** "Drop PDF or Word Doc here."
    *   **Status:** "Resume Active: `My_CV.docx`"

---

## 5. Technical Stack

### 5.1 Frontend (Chrome Extension)
*   **Framework:** React (Vite) or Vanilla JS (for lightweight DOM injection).
*   **Manifest:** V3.
*   **Styling:** TailwindCSS (scoped to avoid conflict with LinkedIn CSS).
*   **File Processing:**
    *   `pdf.js` (Mozilla) - For PDF text extraction.
    *   `mammoth.js` - For `.docx` text extraction.

### 5.2 Backend (Middleware)
*   **Runtime:** Node.js (Vercel Serverless Functions).
*   **Database:** Redis (optional, for caching salary results to reduce API costs).

### 5.3 AI & Data
*   **LLM:** OpenAI `gpt-4o-mini` (Cost-effective, high speed).
*   **Prompt Engineering:** Strict system prompts to return JSON objects for easy UI rendering.

---

## 6. Data Privacy & Security

1.  **Client-Side Processing:** Resume files are parsed within the browser. The binary file is *never* uploaded to our servers. Only the extracted text string is sent to the LLM for analysis, ensuring better privacy.
2.  **Anonymization:** The middleware strips email addresses and phone numbers from the resume text before sending it to the LLM API.
3.  **Encryption:** Communication between Extension and Middleware is over HTTPS (TLS 1.3).

---

## 7. Implementation Roadmap

| Phase | Duration | Deliverable |
| :--- | :--- | :--- |
| **Phase 1: Intel Core** | Weeks 1-2 | Scraper logic for Jobs Feed. Salary API integration. Injection of Salary Badge. |
| **Phase 2: Document Engine** | Weeks 3-4 | Build Popup UI. Implement `pdf.js` and `mammoth.js` to handle PDF/Word uploads. Store text in LocalStorage. |
| **Phase 3: Match & Connect** | Weeks 5-6 | Connect OpenAI API. Build "Reality Check" logic and "Smart Connect" profile scraper. |
| **Phase 4: UI/UX Polish** | Week 7 | Refine CSS to match LinkedIn. Handle edge cases (corrupt files, missing data). |

---

## 8. Edge Cases & Error Handling

*   **Corrupt Files:** If `mammoth.js` fails to read a `.docx` file, alert the user: *"File unreadable. Please try saving as PDF."*
*   **Old Word Formats:** If a user uploads a `.doc` (binary format pre-2007), prompt them to convert to `.docx` or PDF, as browser-based parsing for binary files is unstable.
*   **Zero-Salary Data:** If no salary data exists for a specific startup, display: *"Salary: Data Unavailable"* rather than a guess.
*   **LinkedIn DOM Changes:** Use flexible CSS selectors (e.g., `data-control-name` attributes) rather than rigid class names to prevent breakage when LinkedIn updates their site.