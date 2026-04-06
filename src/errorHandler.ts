window.addEventListener('error', (event) => {
  console.error("GLOBAL_ERROR:", event.error);
  fetch('http://localhost:11434/api/generate', { method: 'POST', body: JSON.stringify({ error: event.error?.stack || event.message }) }).catch(()=>null);
});
