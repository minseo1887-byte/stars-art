const controls = [...document.querySelectorAll('[data-mode]')];
const leave = document.getElementById('leave-quiet');
const modes = {
  explore: { quiet: false },
  view: { quiet: true }
};

function setMode(id) {
  const { quiet } = modes[id];
  document.body.dataset.mode = id;
  document.body.classList.toggle('quiet', quiet);
  for (const control of controls) {
    control.setAttribute('aria-pressed', String(control.dataset.mode === id));
  }
  leave.hidden = !quiet;
  if (quiet) leave.focus();
  else controls.find(control => control.dataset.mode === id).focus();
}

for (const control of controls) {
  control.addEventListener('click', () => setMode(control.dataset.mode));
}
leave.addEventListener('click', () => setMode('explore'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !leave.hidden) setMode('explore');
});
