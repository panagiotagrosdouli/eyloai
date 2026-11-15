from pathlib import Path
import re,json,subprocess
root=Path(__file__).resolve().parents[2]
import os
os.chdir(root)
sha=subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip()
files=subprocess.check_output(['git','ls-files'],text=True).splitlines()
source={f:Path(f).read_text(errors='replace') for f in files if Path(f).is_file() and Path(f).suffix in ['.js','.jsx','.mjs','.ts','.tsx','.sql','.yml','.yaml','.json','.md']}
routes=re.findall(r'<Route\s+path="([^"]+)"\s+element=\{([^\n]+)',source['src/App.jsx'])
inventory={'base_commit':sha,'method':'Static source scan; matches are review candidates, not behavioral acceptance','routes':[{'path':path,'element':element} for path,element in routes],'files':{}}
for f,s in source.items():
 if not (f.startswith(('src/','api/','server/','supabase/migrations/','.github/workflows/','tests/'))):continue
 inventory['files'][f]={'lines':len(s.splitlines()),'actions':[],'tables':[],'environment_variables':[]}
 entry=inventory['files'][f]
 for n,line in enumerate(s.splitlines(),1):
  if re.search(r'onClick=|onSubmit=|onChange=|<button|<form',line):entry['actions'].append({'line':n,'source':line.strip()[:400]})
 entry['sql_declarations']=[{'line':n,'source':line.strip()[:400]} for n,line in enumerate(s.splitlines(),1) if re.search(r'create (?:table|policy|trigger|index)|storage.buckets|foreign key',line,re.I)]
 entry['timestamp_contract_references']=[{'line':n,'source':line.strip()[:400]} for n,line in enumerate(s.splitlines(),1) if 'updated_date' in line and f.startswith(('src/','api/','server/','supabase/'))]
 entry['tables']=sorted(set(re.findall(r"\.from\(['\"]([^'\"]+)",s)))
 entry['environment_variables']=sorted(set(re.findall(r'(?:process\.env\.|import\.meta\.env\.)([A-Z][A-Z0-9_]*)',s)))
Path('docs/integration/full-site-source-inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
