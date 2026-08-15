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
