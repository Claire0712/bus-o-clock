// Explanation only: Android/the browser still controls actual permission.
export function createLocationConsent(t) {
  let accepted = false, pending;
  return () => {
    if (accepted) return Promise.resolve(true);
    if (pending) return pending;
    pending = new Promise(resolve => {
      const previous = document.activeElement;
      const dialog = document.createElement('dialog');
      dialog.className = 'location-dialog';
      dialog.setAttribute('aria-labelledby', 'location-explanation-title');
      dialog.setAttribute('aria-describedby', 'location-explanation-copy');
      const title = document.createElement('h2'); title.id = 'location-explanation-title'; title.textContent = t('locationPurposeTitle');
      const copy = document.createElement('p'); copy.id = 'location-explanation-copy'; copy.textContent = t('locationPurpose');
      const actions = document.createElement('div'); actions.className = 'recovery-actions';
      for (const [key, value] of [['continueLocation', true], ['withoutLocation', false]]) {
        const button = document.createElement('button'); button.className = 'btn ' + (value ? 'primary' : 'secondary');
        button.textContent = t(key); button.onclick = () => { accepted = value; dialog.close(); };
        actions.append(button);
      }
      dialog.append(title, copy, actions); document.body.append(dialog);
      dialog.addEventListener('close', () => { dialog.remove(); pending = null; if (previous?.isConnected) previous.focus(); resolve(accepted); }, {once:true});
      dialog.showModal();
    });
    return pending;
  };
}
