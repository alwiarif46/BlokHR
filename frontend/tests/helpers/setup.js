/**
 * Minimal DOM fixture for setup wizard integration tests.
 * Markup mirrors shell.html step structure (wzP0–wzP3).
 */
export function mountSetupWizardDom() {
  document.body.innerHTML = `
    <div id="toastContainer"></div>
    <div id="screenSetup" data-wz-theme="dark">
      <div class="wz-steps" id="wzSteps">
        <div class="wz-sn active" id="wzSn1"><span>1</span></div>
        <div class="wz-sl" id="wzSl1"></div>
        <div class="wz-sn" id="wzSn2"><span>2</span></div>
        <div class="wz-sl" id="wzSl2"></div>
        <div class="wz-sn" id="wzSn3"><span>3</span></div>
        <div class="wz-sl" id="wzSl3"></div>
        <div class="wz-sn" id="wzSn4"><span>4</span></div>
      </div>
      <div class="wz-labels" id="wzLabels">
        <div class="wz-lb active" id="wzLb1">Type</div>
        <div class="wz-lb" id="wzLb2">Branding</div>
        <div class="wz-lb" id="wzLb3">Auth</div>
        <div class="wz-lb" id="wzLb4">Plan</div>
      </div>
      <div class="wz-form">
        <div class="wz-panel active" id="wzP0">
          <h3 class="wz-vheading">What are you setting up?</h3>
          <button type="button" class="wz-vcard" id="wzCardHr" data-vertical="hr">
            <svg class="wz-vcard-icon" viewBox="0 0 24 24" aria-hidden="true"></svg>
            <span class="wz-vcard-title">Workforce</span>
          </button>
          <button type="button" class="wz-vcard" id="wzCardSchool" data-vertical="school">
            <svg class="wz-vcard-icon" viewBox="0 0 24 24" aria-hidden="true"></svg>
            <span class="wz-vcard-title">Campus</span>
          </button>
          <p class="wz-vwarn">This choice is permanent for this workspace and cannot be changed later.</p>
          <button class="wz-btn wz-btn-p" id="wzBtn0" disabled>
            <span class="btn-text">Continue</span>
          </button>
        </div>
        <div class="wz-panel" id="wzP1">
          <div id="wzSecIdentity">Company Identity</div>
          <div class="wz-fl"><span class="req">*</span> <span id="wzLblOrgName">Company Name</span></div>
          <input id="wzCompanyName" placeholder="Acme Corporation" />
          <input id="wzTagline" />
          <input id="wzLogoUrl" />
          <input id="wzTimezone" value="Asia/Kolkata" />
          <input id="wzEmailName" />
          <input type="color" id="wzColorPicker" value="#F5A623" />
          <input id="wzColorHex" value="#F5A623" />
          <div id="wzSwatch"></div>
          <div id="wzLogoLetter"></div>
          <img id="wzLogoImg" />
          <div id="wzErrName"></div>
          <button id="wzBtn1" disabled><span class="btn-text">Next</span></button>
        </div>
        <div class="wz-panel" id="wzP2">
          <div id="wzSecAuth">How your team signs in</div>
          <div id="wzLocalHint">Best for small teams — no SSO setup needed</div>
          <div id="wzLocalCard"></div>
          <div id="wzMagicCard"></div>
          <div id="wzMsCard"></div>
          <div id="wzGgCard"></div>
          <div id="wzSsoCollapse"></div>
          <button id="wzSsoToggle"></button>
          <div id="wzSsoBody" hidden></div>
          <input type="checkbox" id="wzAuthLocal" checked />
          <input type="checkbox" id="wzAuthMagic" />
          <input id="wzMsalClient" />
          <input id="wzMsalTenant" />
          <input id="wzGoogleClient" />
          <div id="wzErrAuth"></div>
          <button id="wzBack2">Back</button>
          <button id="wzBtn2"><span class="btn-text">Next</span></button>
        </div>
        <div class="wz-panel" id="wzP3">
          <div id="wzCloudPlan"></div>
          <div id="wzSelfHostLicense" hidden></div>
          <div id="wzStep3Title"></div>
          <div id="wzStep3Sub"></div>
          <input id="wzAdminEmail" type="email" />
          <textarea id="wzLicenseToken"></textarea>
          <div id="wzErrLicense"></div>
          <div id="wzErrAdmin"></div>
          <button id="wzBack3">Back</button>
          <button id="wzBtn3" disabled>
            <span class="btn-text" id="wzBtn3Text">Start trial</span>
          </button>
        </div>
        <div class="wz-success" id="wzSuccess">
          <span id="wzSuccessCo"></span>
        </div>
        <div id="wzConfetti"></div>
        <div id="wzTitle"></div>
        <div id="wzSubtitle"></div>
      </div>
    </div>
  `;
}
