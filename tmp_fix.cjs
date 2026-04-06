const fs = require('fs');
const glob = require('glob'); // wait, I can just use fs.readdirSync
const path = require('path');

const tabsDir = 'src/components/tabs';
const files = fs.readdirSync(tabsDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const fp = path.join(tabsDir, file);
  let content = fs.readFileSync(fp, 'utf8');
  content = content.replace(/import React(, \{.*?\})? from 'react';\n/g, (match, p1) => {
    return p1 ? `import${p1} from 'react';\n` : '';
  });
  content = content.replace("export const TabPrompts = ({ ctx }: { ctx: AppContextProps }) => {", "export const TabPrompts = (_props: { ctx: AppContextProps }) => {");
  content = content.replace("export const TabUnion = ({ ctx }: { ctx: AppContextProps }) => {", "export const TabUnion = (_props: { ctx: AppContextProps }) => {");
  fs.writeFileSync(fp, content);
}

let uiFile = 'src/components/ui/HUDCorner.tsx';
let uiContent = fs.readFileSync(uiFile, 'utf8');
uiContent = uiContent.replace("import React from 'react';\n\n", "");
fs.writeFileSync(uiFile, uiContent);

let typesFile = 'src/components/tabs/types.ts';
let typesContent = fs.readFileSync(typesFile, 'utf8');
typesContent = typesContent.replace(", ArtefactoArchivo", "");
fs.writeFileSync(typesFile, typesContent);
