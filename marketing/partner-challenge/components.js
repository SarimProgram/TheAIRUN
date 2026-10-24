class PhoneArtwork extends HTMLElement {
  connectedCallback() {
    this.innerHTML = '<img class="source-phone" src="./phone-cutout.png" alt="Weekly training plan displayed on an iPhone" draggable="false" />';
  }
}

class PartnerChallengePoster extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
      <section class="poster" aria-label="Weekly training plan app screenshot">
        <div class="poster-bg" aria-hidden="true">
          <div class="glow glow-coral"></div>
          <div class="glow glow-teal"></div>
        </div>

        <header class="poster-copy">
          <div class="eyebrow">
            <span class="eyebrow-icon">📅</span>
            Training Plan
          </div>
          <h1>
            Your week,
            <em>mapped out.</em>
          </h1>
          <p>
            Every run. Every target.<br />
            One clear plan.
          </p>
        </header>

        <div class="phone-stage">
          <phone-artwork></phone-artwork>
        </div>
      </section>
    `;
  }
}

customElements.define('phone-artwork', PhoneArtwork);
customElements.define('partner-challenge-poster', PartnerChallengePoster);
