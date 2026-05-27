/** Runs in page context so DevTools can call noSuggestedDiag(). */
(function () {
  if (window.noSuggestedDiag) return;
  window.noSuggestedDiag = function () {
    document.dispatchEvent(new Event("no-suggested-diag", { bubbles: true }));
  };
})();
