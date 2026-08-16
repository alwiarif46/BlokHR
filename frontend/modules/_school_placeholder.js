/**
 * Shared placeholder renderer for F-01 school shell routes (filled in by F-02+).
 * @param {string} title
 * @param {string} hint
 * @returns {(container: HTMLElement) => void}
 */
export function createSchoolPlaceholder(title, hint) {
  return function renderSchoolPlaceholder(container) {
    container.innerHTML =
      '<div class="mod-coming" data-school-placeholder="1">' +
      '<div class="mod-coming-icon">&#128218;</div>' +
      '<div class="mod-coming-title df">' +
      title +
      '</div>' +
      '<div class="mod-coming-sub mf">' +
      hint +
      '</div>' +
      '</div>';
  };
}
