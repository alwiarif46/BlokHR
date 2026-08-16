import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mountSetupWizardDom } from '../helpers/setup.js';

describe('Setup wizard — vertical step 0', () => {
  /** @type {typeof import('../../modules/setup_wizard/setup_wizard.js')} */
  let wizard;

  beforeEach(async () => {
    vi.resetModules();
    mountSetupWizardDom();
    const { initApi } = await import('../../shared/api.js');
    initApi({ mockMode: true });
    wizard = await import('../../modules/setup_wizard/setup_wizard.js');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders step-0 (Type) first', () => {
    wizard.initWizard({ setupComplete: false, currentStep: 1, branding: {} });
    expect(document.getElementById('wzP0').classList.contains('active')).toBe(true);
    expect(document.getElementById('wzP1').classList.contains('active')).toBe(false);
    expect(document.getElementById('wzLb1').classList.contains('active')).toBe(true);
    expect(document.getElementById('wzLb1').textContent).toBe('Type');
  });

  it('keeps Continue disabled until a vertical card is selected', () => {
    wizard.initWizard({ setupComplete: false, currentStep: 1, branding: {} });
    const btn = document.getElementById('wzBtn0');
    expect(btn.disabled).toBe(true);
    document.getElementById('wzCardSchool').click();
    expect(btn.disabled).toBe(false);
    expect(document.getElementById('wzCardSchool').classList.contains('selected')).toBe(true);
  });

  it('switches wizard copy to campus wording when School is selected', () => {
    wizard.initWizard({ setupComplete: false, currentStep: 1, branding: {} });
    document.getElementById('wzCardSchool').click();

    expect(document.getElementById('wzSecIdentity').textContent).toBe('Campus Identity');
    expect(document.getElementById('wzLblOrgName').textContent).toBe('Campus Name');
    expect(document.getElementById('wzErrName').textContent).toBe('Campus name is required');
    expect(document.getElementById('wzSecAuth').textContent).toBe('How your staff signs in');
    expect(document.getElementById('wzCompanyName').getAttribute('placeholder')).toBe(
      'Greenwood High School',
    );
    expect(document.getElementById('wzEmailName').getAttribute('placeholder')).toBe(
      'Defaults to campus name',
    );
  });

  it('keeps company wording for the HR vertical', () => {
    wizard.initWizard({ setupComplete: false, currentStep: 1, branding: {} });
    document.getElementById('wzCardHr').click();

    expect(document.getElementById('wzSecIdentity').textContent).toBe('Company Identity');
    expect(document.getElementById('wzLblOrgName').textContent).toBe('Company Name');
    expect(document.getElementById('wzSecAuth').textContent).toBe('How your team signs in');
    expect(document.getElementById('wzCompanyName').getAttribute('placeholder')).toBe(
      'Acme Corporation',
    );
  });

  it('reverts to company wording when switching back from School', () => {
    wizard.initWizard({ setupComplete: false, currentStep: 1, branding: {} });
    document.getElementById('wzCardSchool').click();
    document.getElementById('wzCardHr').click();

    expect(document.getElementById('wzLblOrgName').textContent).toBe('Company Name');
    expect(document.getElementById('wzCompanyName').getAttribute('placeholder')).toBe(
      'Acme Corporation',
    );
  });

  it('applies campus wording on reload of a locked school workspace', () => {
    wizard.initWizard({
      setupComplete: false,
      currentStep: 2,
      vertical: 'school',
      branding: {},
    });

    expect(document.getElementById('wzLblOrgName').textContent).toBe('Campus Name');
    expect(document.getElementById('wzSecIdentity').textContent).toBe('Campus Identity');
  });

  it('gates advance behind the confirm dialog', async () => {
    wizard.initWizard({ setupComplete: false, currentStep: 1, branding: {} });
    document.getElementById('wzCardHr').click();
    document.getElementById('wzBtn0').click();

    await vi.waitFor(() => {
      expect(document.getElementById('crudModalOverlay')).toBeTruthy();
      expect(document.getElementById('crudModalOverlay').classList.contains('open')).toBe(true);
    });

    expect(document.getElementById('wzP0').classList.contains('active')).toBe(true);

    document.querySelector('[data-confirm="no"]').click();
    await vi.waitFor(() => {
      expect(document.getElementById('crudModalOverlay').classList.contains('open')).toBe(false);
    });
    expect(document.getElementById('wzP0').classList.contains('active')).toBe(true);

    document.getElementById('wzBtn0').click();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-confirm="yes"]')).toBeTruthy();
    });
    document.querySelector('[data-confirm="yes"]').click();

    await vi.waitFor(() => {
      expect(document.getElementById('wzP1').classList.contains('active')).toBe(true);
    });
    expect(wizard.getWizardVertical()).toBe('hr');
  });

  it('includes vertical in the final step3 submit body', async () => {
    wizard.initWizard({ setupComplete: false, currentStep: 1, branding: {} });
    document.getElementById('wzCardSchool').click();
    document.getElementById('wzBtn0').click();
    await vi.waitFor(() => document.querySelector('[data-confirm="yes"]'));
    document.querySelector('[data-confirm="yes"]').click();
    await vi.waitFor(() => document.getElementById('wzP1').classList.contains('active'));

    document.getElementById('wzCompanyName').value = 'Greenwood High';
    document.getElementById('wzBtn1').disabled = false;
    document.getElementById('wzBtn1').click();
    await vi.waitFor(() => document.getElementById('wzP2').classList.contains('active'));

    document.getElementById('wzBtn2').click();
    await vi.waitFor(() => document.getElementById('wzP3').classList.contains('active'));

    document.getElementById('wzAdminEmail').value = 'admin@school.edu';
    document.getElementById('wzBtn3').disabled = false;
    document.getElementById('wzBtn3').click();

    await vi.waitFor(() => {
      expect(wizard.getMockStep3Body()).toBeTruthy();
    });
    expect(wizard.getMockStep3Body()).toMatchObject({
      adminEmail: 'admin@school.edu',
      vertical: 'school',
    });
  });

  it('skips step 0 when setup status already has a vertical', () => {
    wizard.initWizard({
      setupComplete: false,
      currentStep: 1,
      vertical: 'school',
      branding: {},
    });
    expect(document.getElementById('wzP0').classList.contains('active')).toBe(false);
    expect(document.getElementById('wzP1').classList.contains('active')).toBe(true);
    expect(wizard.getWizardVertical()).toBe('school');
    expect(document.getElementById('wzCardSchool').classList.contains('selected')).toBe(true);
    expect(document.getElementById('wzCardSchool').classList.contains('locked')).toBe(true);
  });
});
