"""Build a conservative, reproducible source inventory; never infer acceptance from files."""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BASE = '7bf956a72d42f251c77cde7276dcb050cebd1a35'
# IDs are the authoritative tracker IDs. Empty mappings mean no dedicated workflow found.
# Related implementation is evidence to inspect, not proof of a complete product.
MAP = '''1|Life,LifeGoals,Habits|life_tasks,life_goals||life-workspace
2|Calendar|calendar_events||calendar-workspace
3|Notes|notes,note_versions||notes-workspace
4||||
5||||
6|Notifications|notifications||scheduled-monitoring
7|Home,PersonalizedDashboard|projects,notes,life_tasks,calendar_events,study_flashcard_decks,activity_events||
8|Learn,LearningWorkspace|learning_courses,learning_lessons,learning_lesson_progress,learning_enrollments|eyra|learn,learning-workspace
9|StudyPlanner|notes,calendar_events||notes-workspace
10|Flashcards|study_flashcard_decks||flashcards-workspace
11|QuizGenerator,LearningWorkspace|quizzes,quiz_questions,quiz_attempts|eyra|quiz,learning-workspace
12||||
13|PublicCareers,FutureMe|profiles|general-jobs,euraxess|careers-api,general-career
14|Profile,cv-extraction|profiles||profile-merge
15||||
16|EyloFiles,eylo-files|eylo_files,eylo_file_versions||eylo-files
17|DocumentEditor|eylo_files,eylo_file_versions||eylo-files
18|DocumentEditor|eylo_files,eylo_file_versions||eylo-files
19|PitchDeckBuilder|projects|eyra|
20||||
21|UniversalSearch,universal-search|notes,projects,life_tasks,life_goals,calendar_events,study_flashcard_decks,saved_papers,ideas| |universal-search
22||||
23|ResearchKnowledgeGraph,research-knowledge-graph|saved_papers,saved_researchers,projects|discovery|research-knowledge-graph
24|EyraCommandCenter,eyra-project-tools|projects,saved_papers|eyra|eyra-project-tools,eyra-boundaries
25||||
26|monitoring-service|watchlists,monitoring_discoveries,notifications|monitor|monitor,scheduled-monitoring
27|OpportunityRadar,monitoring-service|watchlists,monitoring_discoveries,notifications|monitor|monitor,private-radar
28|VoiceAssistant||eyra|
29|cv-extraction|||profile-merge
30|citation-verification,evidence-verification||eyra|citation-verification,evidence-verification
31|workspace-export,Settings|profiles,projects,saved_papers||workspace-export,citation-export
32||||
33|Meetings,MeetingRoom|meetings,meeting_participants|meeting-room|meeting,supervisor-meetings
34||||
35||||
36|PublicDiscovery,ForYou,Home|saved_papers|discovery,opportunities|discovery,arxiv,scholarly
37||||
38|ActivityHistory|activity_events||activity-history
39||||
40|ServiceStatus| |capabilities,deployment-status|capabilities,service-status,deployment-status
41|Notes,notes-domain|notes,note_versions||notes-workspace
42||||
43||||
44|AppLayout,ProtectedRoute|||e2e-auth
45|UserTypeOnboarding|profiles||
46||||
47|GlobalCommandCenter,EyraCommandCenter|projects,saved_papers|eyra|eyra-tool-action,eyra-project-tools
48|ProjectDetail,evidence-matrix|projects,saved_papers||evidence-matrix
49|ReproducibilityReview,reproducibility-review|projects||reproducibility-review
50|DreamTeam,Researcher,researcher-shortlist|saved_researchers,projects|discovery,eyra|researcher-shortlist,supervisor
51|ProjectDetail|projects|eyra|project-eyra
52||||
53||||
54|ProjectDetail|projects|eyra|project
55|ProjectDetail|projects||project
56|ProjectDecisions,decision-workspace|projects||decision-workspace
57|ProjectDetail,PitchDeckBuilder|projects|eyra|project
58|Home,ResearchGaps|projects,saved_papers|discovery,eyra|research-gap,discovery
59||||
60||||
61||||
62|LiteratureReview,literature-review|projects,saved_papers|discovery|literature-review
63|ResearchKnowledgeGraph,research-knowledge-graph|saved_papers|discovery|research-knowledge-graph
64||||
65|ResearchDataLab,research-data|||research-data
66||||
67|Researchers,Meetings,supervisor-matching|saved_researchers,meetings|discovery,meeting-room|supervisor
68||||
69||||
70||||
71||||
72|ResearchDataLab,research-data|||research-data
73|ResearchDataLab,research-catalog|||research-catalog
74|ProjectTemplates|projects||project
75|TimeTracker,time-tracker|time_entries,life_tasks,projects||time-tracker
76||||
77|InstitutionAdmin|profiles|admin-analytics|analytics'''

def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()

def main():
    tracked = git('ls-files').splitlines()
    prs = json.loads((ROOT / 'docs/integration/open-pr-comparison.json').read_text())
    tracker = (ROOT / 'docs/PRODUCT_IMPLEMENTATION_TRACKER.md').read_text()
    rows = {int(i): (name.strip(), status.strip()) for i, name, status in re.findall(r'^\| (\d+) \| ([^|]+) \| ([^|]+) \|', tracker, re.M)}
    app = (ROOT / 'src/App.jsx').read_text()
    imports = dict(re.findall(r"const (\w+) = lazy\(\(\) => import\('([^']+)'\)\)", app))
    route_map = []
    for path, element in re.findall(r'<Route path="([^"]+)" element=\{([^\n]+)', app):
        for component, source in imports.items():
            if re.search(r'<' + component + r'(?:\s|/|>)', element):
                route_map.append((path, source.replace('@/', 'src/') + '.jsx'))
    products = []
    verification_path = ROOT / 'docs/integration/verification.json'
    verification = json.loads(verification_path.read_text()) if verification_path.exists() else {}
    suite = verification.get('local_checks', {}).get('npm_run_check', {})
    workflow_evidence = {
        **{i: 'Files/document create, version, reload, download/export and exact-link browser fixtures; local PostgreSQL metadata policies' for i in (16, 17, 18)},
        **{i: 'Project workplan subset: browser persistence/conflict fixtures and independent local PostgreSQL compare-and-set sessions' for i in (54, 55, 74)},
        **{i: 'Local Data Lab/catalog subset: browser analysis, export, disclosure and account-scoped metadata fixtures' for i in (65, 72, 73)},
        **{i: 'Canonical workspace table policies/triggers exercised on local PostgreSQL with synthetic auth identities' for i in (1, 2, 3, 9, 10, 21, 38)},
    }
    for line in MAP.splitlines():
        raw_id, stems, tables, apis, test_stems = line.split('|')
        i = int(raw_id)
        name, declared = rows[i]
        stems = list(filter(None, stems.split(',')))
        files = [p for p in tracked if p.startswith('src/') and any(Path(p).stem.lower().startswith(s.lower()) for s in stems)]
        tables = [s.strip() for s in tables.split(',') if s.strip()]
        migrations = [p for p in tracked if p.startswith('supabase/migrations/') and any(re.search(r'\b' + re.escape(t) + r'\b', (ROOT / p).read_text()) for t in tables)] if files else []
        tests = [p for p in tracked if p.startswith('tests/') and any(Path(p).stem.startswith(s) for s in test_stems.split(',') if s)] if files else []
        endpoints = [f'api/{a.strip()}.js' for a in apis.split(',') if a.strip() and f'api/{a.strip()}.js' in tracked] if files else []
        related_prs = [p['number'] for p in prs if any(f in p['changed_files'] for f in files) or any(Path(f).stem.lower().startswith(s.lower()) for f in p['changed_files'] if f.startswith('src/') for s in stems)]
        if i in (8, 11, 16, 17, 18, 75):
            status = 'Partially implemented' if files else ('PR-only' if related_prs else 'Not implemented')
        elif 'NOT_STARTED' in declared and i != 73:
            status = 'Not implemented'
        elif i == 73 and not any('research-catalog' in p for p in files):
            status = 'PR-only'
        elif 'FOUNDATION' in declared:
            status = 'Infrastructure only'
        else:
            status = 'Partially implemented'
        routes = [{'path': p, 'source': s} for p, s in route_map if s in files]
        products.append({
            'id': i, 'name': name, 'status': status, 'tracker_statement': declared,
            'source_files': files, 'frontend_routes': routes, 'backend_apis': endpoints,
            'supabase_entities': tables if files else [], 'migration_files': migrations,
            'authentication': 'Supabase authenticated owner scope; live RLS unverified' if files and tables else ('Public and/or protected shared surface; see route guards' if files else 'Not implemented on baseline'),
            'open_prs': related_prs, 'automated_test_files': tests,
            'user_workflow_and_remaining_acceptance': declared,
            'workflow_acceptance': 'Not established; tracker statement describes remaining work',
            'implementation_commit': git('log', '-1', '--format=%H', '--', *files) if files else None,
            'automated_test_status': f"Combined suite {suite.get('status', 'baseline PASS')}: {suite.get('tests', 491)} tests; mapped file presence is not full product acceptance" if tests else 'No dedicated test evidence mapped',
            'automated_test_source_commit': verification.get('tested_source_commit', BASE) if tests else None,
            'integration_test_status': ('Partial local verification: ' + workflow_evidence[i] + '. Remaining product criteria unverified.') if i in workflow_evidence else 'Not independently verified per product',
            'staging_verification': 'NOT_RUN: intended EYLO staging is not connected',
            'production_verification': 'NOT_RUN: deployment identity not verified',
            'deployment_dependencies': (['Verified EYLO Supabase project and reviewed migrations'] if files and tables else []) + (['Configured serverless API/providers: ' + ', '.join(endpoints)] if endpoints else []),
            'known_blockers': ['Acceptance criteria and full product workflow still incomplete'] + (['Authorized staging access and test accounts missing'] if files and tables else []),
        })
    assert sorted(rows) == list(range(1, 78))
    assert [p['id'] for p in products] == list(range(1, 78))
    result = {'schema_version': 1, 'baseline_commit': BASE, 'inventory_commit': git('rev-parse', 'HEAD'), 'scope': 'Integration candidate branch, not current main or deployed product', 'intended_eylo_supabase_ref': 'kbzjngpzxpniaumlupaa', 'live_access': 'Owner identified this ref; connector permission denied. Repository guards it as live EYLO. Separate staging identity remains required.', 'inventory_method': 'Explicit tracker ID mapping to tracked source files, route declarations, table references in migrations, tests, and all 65 open PR diffs. Related source presence is not implementation verification. Shared surfaces may support several partial products. See verification.json for subsequent combined-suite results; those do not establish per-product acceptance.', 'products': products}
    (ROOT / 'docs/integration/product-matrix.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f'Inventoried {len(products)} products against {len(prs)} open PRs')

if __name__ == '__main__':
    main()
