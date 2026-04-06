import fs from 'fs';
const appFile = '/Users/nacho/Desktop/programapp/src/App.tsx';
let txt = fs.readFileSync(appFile, 'utf-8');

txt = txt.replace(/pink-/g, 'cyan-');
txt = txt.replace(/text-shadow-pink/g, 'text-shadow-cyan');
txt = txt.replace(/#ff2d78/g, '#00e5ff');
txt = txt.replace(/255,45,120/g, '0,229,255');

fs.writeFileSync(appFile, txt, 'utf-8');
console.log('App.tsx updated to cyan');
