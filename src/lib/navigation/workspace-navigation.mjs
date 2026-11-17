// Small, pure navigation model. Never display record IDs in breadcrumbs.
const SECTIONS = Object.freeze({
 '/projects':['My workspace','/home'], '/library':['Library','/projects'],
 '/files':['Files','/projects'], '/notes':['Notes','/projects'],
 '/life':['Tasks','/projects'], '/calendar':['Calendar','/projects'],
 '/ideas':['Ideas','/projects'], '/activity':['Activity history','/projects'],
 '/time-tracker':['Time tracker','/projects'], '/study-planner':['Study planner','/learn'],
 '/habits':['Habits','/learn'], '/flashcards':['Flashcards','/learn'],
 '/quiz-generator':['Quizzes','/learn'], '/learn':['Learn','/home'],
 '/tools':['All tools','/home'], '/automations':['Task automations','/tools'],
 '/research-journey':['Research journey','/tools'],
 '/research-gaps':['Research gap finder','/tools'],
 '/literature-review':['Literature review','/tools'],
 '/knowledge-graph':['Knowledge graph','/tools'],
 '/researchers':['Researchers','/search'],
 '/opportunities':['Funding and calls','/search'],
 '/history':['Search history','/search'],
 '/challenges':['Open challenges','/search'],
 '/meetings':['Meetings','/projects'], '/foryou':['For you','/projects'],
 '/radar':['Opportunity review','/tools'], '/briefing':['Executive briefing','/tools'],
 '/pitchdeck':['Pitch deck','/tools'], '/grant-builder':['Grant workspace','/tools'],
 '/institution':['Workspace analytics','/tools'],
 '/profile':['Profile','/home'], '/settings':['Settings','/home'],
 '/pricing':['Plans and access','/home'], '/notifications':['Notifications','/home'],
});
const SPECIAL = Object.freeze({
 thesis:'Thesis studio', spreadsheet:'Spreadsheet', budget:'Research budget',
 decisions:'Project decisions', research:'Research records',
 'research-landscape':'Research landscape', scenario:'Scenario planner',
 impact:'Impact review', team:'Team planner', voice:'Voice workspace',
 data:'Research Data Lab', 'professional-path':'Professional path'
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const readable = value => {
  const text = String(value || '').replace(/[-_]/g, ' ').trim().slice(0, 60);
  return !text || UUID.test(value) ? 'Item' : text[0].toUpperCase() + text.slice(1);
};
const label = path => path === '/home' ? 'Home'
  : path === '/search' ? 'Discover' : SECTIONS[path]?.[0] || readable(path.split('/').at(-1));
const result = (crumbs, backPath) => ({
  visible: true, crumbs, backPath, backLabel: label(backPath)
});
export function getWorkspaceNavigation(pathname) {
  const path = typeof pathname === 'string' ? pathname : '/home';
  if (path === '/home' || path === '/search') return {
    visible:false, crumbs:[], backPath:'/home', backLabel:'Home'
  };
  const project = /^\/projects\/([^/]+)(?:\/(.*))?$/.exec(path);
  if (project) {
    const projectPath = '/projects/' + project[1];
    const crumbs = [{label:'My workspace', path:'/projects'}];
    if (!project[2]) return result([...crumbs,{label:'Project',path:null}],'/projects');
    crumbs.push({label:'Project',path:projectPath});
    const parts = project[2].split('/');
    const name = parts[0] === 'workbench' && parts[1]
      ? readable(parts[1]) : SPECIAL[parts[0]] || readable(parts[0]);
    return result([...crumbs,{label:name,path:null}],projectPath);
  }
  if (path === '/life/goals') return result([
    {label:'Tasks',path:'/life'},{label:'Goals',path:null}
  ],'/life');
  if (path.startsWith('/tools/') || path.startsWith('/collaboration/')
      || path.startsWith('/labs/') || path.startsWith('/documents/')) {
    const part = path.split('/').at(-1);
    const name = path.startsWith('/documents/')
      ? part === 'new' ? 'New document' : 'Edit document'
      : SPECIAL[part] || readable(part);
    return result([{label:'All tools',path:'/tools'},{label:name,path:null}],'/tools');
  }
  if (path.startsWith('/workspace/')) {
    const part = path.split('/').at(-1);
    const discovery = part === 'careers' || part === 'literature-search';
    const parent = discovery ? '/search' : '/projects';
    const name = part === 'search' ? 'Search saved work'
      : part === 'careers' ? 'Research careers'
      : part === 'literature-search' ? 'Literature analysis' : readable(part);
    return result([{label:label(parent),path:parent},{label:name,path:null}],parent);
  }
  if (Object.hasOwn(SECTIONS,path)) {
    const [name,parent] = SECTIONS[path];
    return result(parent === '/home'
      ? [{label:name,path:null}]
      : [{label:label(parent),path:parent},{label:name,path:null}],parent);
  }
  return result([{label:readable(path.split('/').at(-1)),path:null}],'/home');
}
export function isSafeWorkspaceHref(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 2048
    && value.startsWith('/') && !value.startsWith('//')
    && !/[\\\u0000-\u001f]/.test(value);
}
export function advanceWorkspaceTrail(trail, path) {
  const prior = (Array.isArray(trail) ? trail : [])
    .filter(isSafeWorkspaceHref).slice(-12);
  if (!isSafeWorkspaceHref(path)) return prior;
  if (prior.at(-1) === path) return prior;
  const index = prior.lastIndexOf(path);
  return index >= 0 ? prior.slice(0,index+1) : [...prior,path].slice(-12);
}
