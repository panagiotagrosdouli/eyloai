import React from 'react';
import { BookOpen, FlaskConical, BarChart2, Users, Lightbulb, Globe, X } from 'lucide-react';

export const TEMPLATES = [
  {
    id: 'systematic_review',
    label: 'Systematic Review',
    icon: BookOpen,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
    description: 'Evidence synthesis following PRISMA guidelines',
    goal: 'Conduct a systematic review of the literature to synthesize evidence, identify research gaps, and produce a comprehensive, reproducible analysis.',
    milestones: `1. Define research question & eligibility criteria (PICO)
2. Register protocol (PROSPERO or similar)
3. Design and run database search strings (PubMed, Scopus, Web of Science)
4. Screen titles & abstracts (first pass)
5. Full-text screening & data extraction
6. Quality appraisal of included studies
7. Meta-analysis or narrative synthesis
8. Write up and submit manuscript`,
    tasks: `- Draft PICO framework and inclusion/exclusion criteria
- Register protocol on PROSPERO
- Run keyword searches in at least 3 databases
- Import references into Zotero/Mendeley and remove duplicates
- Complete title/abstract screening
- Perform full-text review
- Extract data into standardized table
- Assess risk of bias using appropriate tool
- Draft Results section
- Complete PRISMA flow diagram`,
  },
  {
    id: 'experimental_study',
    label: 'Experimental Study',
    icon: FlaskConical,
    color: 'text-green-400 bg-green-500/10 border-green-500/20',
    description: 'Controlled experiment with hypothesis testing',
    goal: 'Design and conduct a rigorous controlled experiment to test a hypothesis, collect primary data, and produce statistically validated findings.',
    milestones: `1. Define hypothesis and experimental design
2. Ethics approval (if applicable)
3. Develop materials, instruments, or lab protocols
4. Pilot study / feasibility test
5. Recruit participants or prepare samples
6. Data collection phase
7. Statistical analysis
8. Write and submit findings`,
    tasks: `- Formulate null and alternative hypotheses
- Choose experimental design (RCT, factorial, crossover, etc.)
- Submit ethics application
- Create data collection instruments or lab protocols
- Run pilot to check feasibility
- Recruit participants or prepare experimental materials
- Conduct experiment and collect raw data
- Clean and code dataset
- Run statistical tests (power analysis, significance testing)
- Interpret results and draft Discussion`,
  },
  {
    id: 'survey_study',
    label: 'Survey / Questionnaire Study',
    icon: BarChart2,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    description: 'Quantitative or mixed-methods survey research',
    goal: 'Design, distribute, and analyze a survey to collect primary data from a target population and produce generalizable quantitative or mixed-methods insights.',
    milestones: `1. Define research objectives and target population
2. Design and pilot questionnaire
3. Ethical approval and sampling strategy
4. Survey distribution
5. Data collection & quality checks
6. Statistical analysis (descriptive & inferential)
7. Reporting and manuscript writing`,
    tasks: `- Define research objectives and key variables
- Select validated scales or design new items
- Pilot questionnaire with 5-10 participants
- Obtain ethical clearance
- Choose sampling method and calculate required sample size
- Distribute survey (online, in-person)
- Monitor response rate and send reminders
- Clean data and check for missing values
- Run descriptive statistics and inferential tests
- Draft Results and Discussion sections`,
  },
  {
    id: 'collaborative_research',
    label: 'Collaborative Research',
    icon: Users,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    description: 'Multi-partner or interdisciplinary project',
    goal: 'Coordinate a multi-partner research collaboration, align expertise across institutions or disciplines, and deliver joint outputs including publications and/or shared datasets.',
    milestones: `1. Define collaboration scope, roles, and governance
2. Partnership agreements / MoU signed
3. Joint research design and data sharing plan
4. Assign work packages to partners
5. Midpoint review and integration meeting
6. Joint analysis and co-authorship
7. Dissemination: publications, conferences, reports`,
    tasks: `- Map required expertise and identify potential partners
- Draft collaboration agreement or MoU
- Define data sharing and IP arrangements
- Create shared project management workspace
- Hold kick-off meeting and assign work packages
- Set up regular progress-check cadence
- Collect and integrate data across sites
- Coordinate joint manuscript or report
- Submit to target journal or conference`,
  },
  {
    id: 'innovation_project',
    label: 'Innovation / Startup Project',
    icon: Lightbulb,
    color: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
    description: 'Research-to-market or TRL advancement',
    goal: 'Translate research findings into an innovative product, service, or startup, advancing the Technology Readiness Level (TRL) from concept to validated prototype or market entry.',
    milestones: `1. Problem validation and market research
2. Define value proposition and IP strategy
3. Prototype / MVP development
4. User testing and iteration
5. Business model canvas finalized
6. Funding / investment secured
7. Launch or pilot deployment`,
    tasks: `- Conduct problem interviews with target users (5-10)
- Analyze competitive landscape
- Define unique value proposition
- File provisional patent or IP disclosure (if applicable)
- Build MVP or proof-of-concept
- Run usability tests and collect feedback
- Complete Business Model Canvas
- Identify and apply to accelerators or grants
- Prepare pitch deck
- Launch pilot or beta program`,
  },
  {
    id: 'grant_proposal',
    label: 'Grant Proposal',
    icon: Globe,
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    description: 'Prepare and submit a competitive funding bid',
    goal: 'Research, write, and submit a compelling grant application to secure funding for a research or innovation project.',
    milestones: `1. Identify suitable funding calls and check eligibility
2. Form consortium / secure letters of support
3. Draft scientific narrative
4. Budget preparation and justification
5. Internal review and sign-off
6. Submission
7. Response to reviewer comments (if invited)`,
    tasks: `- Review call guidelines and evaluation criteria
- Check eligibility criteria and consortium requirements
- Draft project summary and objectives
- Write state-of-the-art and innovation sections
- Define work packages and Gantt chart
- Prepare detailed budget with justification
- Collect CVs and support letters from partners
- Complete risk management section
- Internal review round
- Final proofreading and submission`,
  },
];

export default function ProjectTemplates({ onSelect, onClose }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Choose a template to pre-fill</p>
        <button onClick={onClose} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
          <X size={11} /> Skip
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {TEMPLATES.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t)}
              className={`flex flex-col items-start gap-2 p-3 rounded-xl border text-left transition-all hover:opacity-90 ${t.color}`}
            >
              <Icon size={14} />
              <div>
                <p className="text-xs font-semibold leading-tight">{t.label}</p>
                <p className="text-[10px] opacity-70 leading-snug mt-0.5">{t.description}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
